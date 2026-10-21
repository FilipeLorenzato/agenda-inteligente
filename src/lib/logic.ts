// Regras da agenda que não dependem do celular: criação, ordenação, importação de feeds
// e cálculo de quando cada notificação deve disparar.

import type { Feed, FocusEntry, Repeat, Settings, Task, TaskDraft } from '../types';
import { addDays, addMonths, formatOffset, formatRelativeDay, fromKey, startOfDay, toKey, toTime, withTime } from './dates';
import { cleanCourseName, cleanDescription, IcsEvent, parseCanvasIds, splitCanvasTitle } from './ical';
import { EXAM_EMOJI, guessCategory, priorityInfo, statusInfo, STUDY_EMOJI } from './meta';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'sistema',
  defaultReminders: [10080, 1440], // 1 semana e 1 dia antes
  allDayTime: '08:00',
  dailyDigest: true,
  dailyDigestTime: '07:30',
  feeds: [],
  autoSync: true,
  onboarded: false,
  courseStyles: {},
  studyBlocks: true,
  studyDaysBefore: 3,
  dismissedStudy: [],
  focusMinutes: 25,
  breakMinutes: 5,
  focusLog: [],
  activeFocus: null,
};

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function makeTask(draft: TaskDraft, now = Date.now()): Task {
  return { ...draft, id: newId(), createdAt: now, updatedAt: now };
}

/** Momento do prazo: data + horário (ou o horário de referência, se for dia inteiro) */
export function dueDate(task: Pick<Task, 'date' | 'time'>, allDayTime: string): Date {
  return withTime(fromKey(task.date), task.time ?? allDayTime);
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const doneA = a.status === 'concluida' ? 1 : 0;
    const doneB = b.status === 'concluida' ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    const ta = a.time ?? '';
    const tb = b.time ?? '';
    if (ta !== tb) return ta < tb ? -1 : 1; // dia inteiro primeiro
    return priorityInfo(b.priority).weight - priorityInfo(a.priority).weight;
  });
}

export function tasksByDay(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of sortTasks(tasks)) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return map;
}

// ------------------------------------------------------------------
// Importação de feeds iCal (Canvas etc.)
// ------------------------------------------------------------------

export interface MergeResult {
  tasks: Task[];
  added: number;
  updated: number;
}

/**
 * Junta os eventos do feed às tarefas existentes.
 * - Título, data, horário e link vêm sempre do feed (fonte da verdade).
 * - Status, prioridade, emoji, lembretes e alarme escolhidos por você são preservados.
 * - Eventos com mais de 7 dias no passado são ignorados.
 */
export function mergeFeedEvents(
  tasks: Task[],
  events: IcsEvent[],
  feed: Feed,
  settings: Settings,
  now: Date = new Date(),
  options: { markPastDone?: boolean } = {},
): MergeResult {
  const byExternal = new Map(tasks.filter((t) => t.externalId).map((t) => [t.externalId as string, t]));
  const cutoff = addDays(startOfDay(now), -7);
  const result = [...tasks];
  let added = 0;
  let updated = 0;

  for (const ev of events) {
    if (ev.start < cutoff) continue;
    const externalId = `${feed.id}:${ev.uid}`;
    const { title, course } = splitCanvasTitle(ev.summary);
    const date = toKey(ev.start);
    const time = ev.allDay ? undefined : toTime(ev.start);
    const ids = parseCanvasIds(ev.uid, ev.url);
    const existing = byExternal.get(externalId);

    if (existing) {
      if (
        existing.title !== title ||
        existing.date !== date ||
        existing.time !== time ||
        existing.url !== ev.url ||
        existing.course !== course ||
        existing.canvasAssignmentId !== ids.assignmentId ||
        existing.canvasCourseId !== ids.courseId
      ) {
        const idx = result.findIndex((t) => t.id === existing.id);
        result[idx] = {
          ...existing,
          title,
          date,
          time,
          url: ev.url,
          course,
          feedName: feed.name,
          canvasCourseId: ids.courseId,
          canvasAssignmentId: ids.assignmentId,
          updatedAt: now.getTime(),
        };
        updated++;
      }
      continue;
    }
    const past = ev.start.getTime() < now.getTime();

    const cat = guessCategory(title);
    result.push(
      makeTask(
        {
          title,
          notes: cleanDescription(ev.description),
          date,
          time,
          priority: cat.priority ?? 'media',
          emoji: cat.emoji === '🗓️' ? feed.emoji : cat.emoji,
          status: options.markPastDone && past ? 'concluida' : 'pendente',
          reminders: [...settings.defaultReminders],
          alarm: null,
          source: 'feed',
          externalId,
          feedName: feed.name,
          course,
          url: ev.url,
          canvasCourseId: ids.courseId,
          canvasAssignmentId: ids.assignmentId,
        },
        now.getTime(),
      ),
    );
    added++;
  }
  return { tasks: result, added, updated };
}

// ------------------------------------------------------------------
// Plano de notificações
// ------------------------------------------------------------------

export type NotificationKind = 'lembrete' | 'alarme' | 'resumo';

export interface PlannedNotification {
  taskId?: string;
  kind: NotificationKind;
  at: Date;
  title: string;
  body: string;
}

/** Só agendamos o que cai nos próximos N dias; o resto é agendado nas próximas aberturas/sincronizações. */
export const SCHEDULE_WINDOW_DAYS = 45;
/** Limite de segurança do Android (máx. ~500 alarmes por app) */
export const MAX_SCHEDULED = 300;

function describeDue(task: Task, due: Date, now: Date): string {
  const day = formatRelativeDay(due, now);
  const dayTxt = day === 'Hoje' || day === 'Amanhã' ? day.toLowerCase() : day;
  return task.time ? `${dayTxt} às ${task.time}` : `${dayTxt} (dia inteiro)`;
}

export function planForTask(task: Task, settings: Settings, now: Date = new Date()): PlannedNotification[] {
  if (task.status === 'concluida') return [];
  const due = dueDate(task, settings.allDayTime);
  const limit = addDays(now, SCHEDULE_WINDOW_DAYS);
  const pr = priorityInfo(task.priority);
  const st = statusInfo(task.status);
  const head = `${pr.emoji} ${task.emoji} ${task.title}`;
  const extra = [task.course, task.status === 'andamento' ? `${st.emoji} ${st.label}` : null].filter(Boolean).join(' · ');
  const plan: PlannedNotification[] = [];

  for (const off of Array.from(new Set(task.reminders))) {
    const at = new Date(due.getTime() - off * 60000);
    if (at.getTime() <= now.getTime() + 5000 || at > limit) continue;
    const when = describeDue(task, due, at);
    const txt = formatOffset(off);
    const lead = off === 0 ? 'É agora' : `${txt.startsWith('1 ') ? 'Falta' : 'Faltam'} ${txt}`;
    plan.push({
      taskId: task.id,
      kind: 'lembrete',
      at,
      title: head,
      body: `${lead} · ${when}${extra ? `\n${extra}` : ''}`,
    });
  }

  if (task.alarm !== null) {
    const at = new Date(due.getTime() - task.alarm * 60000);
    if (at.getTime() > now.getTime() + 5000 && at <= limit) {
      plan.push({
        taskId: task.id,
        kind: 'alarme',
        at,
        title: `⏰ ${task.title}`,
        body: task.alarm === 0 ? `Agora · ${describeDue(task, due, at)}` : `Em ${formatOffset(task.alarm)} · ${describeDue(task, due, at)}`,
      });
    }
  }
  return plan;
}

/** Resumo diário: "Hoje: 3 tarefas — 🔥 Prova de SO 14:00, ..." para os próximos 7 dias */
export function planDigests(tasks: Task[], settings: Settings, now: Date = new Date()): PlannedNotification[] {
  if (!settings.dailyDigest) return [];
  const out: PlannedNotification[] = [];
  const byDay = tasksByDay(tasks.filter((t) => t.status !== 'concluida'));
  for (let i = 0; i < 7; i++) {
    const day = addDays(startOfDay(now), i);
    const at = withTime(day, settings.dailyDigestTime);
    if (at.getTime() <= now.getTime() + 5000) continue;
    const list = byDay.get(toKey(day)) ?? [];
    if (!list.length) continue;
    const lines = list.slice(0, 4).map((t) => `${priorityInfo(t.priority).emoji} ${t.title}${t.time ? ` · ${t.time}` : ''}`);
    if (list.length > 4) lines.push(`+ ${list.length - 4} outras`);
    out.push({
      kind: 'resumo',
      at,
      title: `☀️ Hoje: ${list.length} ${list.length === 1 ? 'tarefa' : 'tarefas'}`,
      body: lines.join('\n'),
    });
  }
  return out;
}

export function planAll(tasks: Task[], settings: Settings, now: Date = new Date()): PlannedNotification[] {
  const all = [...tasks.flatMap((t) => planForTask(t, settings, now)), ...planDigests(tasks, settings, now)];
  all.sort((a, b) => a.at.getTime() - b.at.getTime());
  return all.slice(0, MAX_SCHEDULED);
}

// ------------------------------------------------------------------
// Agrupamento da tela "Próximas"
// ------------------------------------------------------------------

export interface Section {
  key: string;
  title: string;
  tasks: Task[];
}

export function upcomingSections(tasks: Task[], now: Date = new Date()): Section[] {
  const today = toKey(now);
  const tomorrow = toKey(addDays(now, 1));
  const weekEnd = toKey(addDays(now, 7));
  const groups: Section[] = [
    { key: 'atrasadas', title: '⚠️ Atrasadas', tasks: [] },
    { key: 'hoje', title: '📍 Hoje', tasks: [] },
    { key: 'amanha', title: '🌅 Amanhã', tasks: [] },
    { key: 'semana', title: '📆 Próximos 7 dias', tasks: [] },
    { key: 'depois', title: '🔭 Mais adiante', tasks: [] },
  ];
  for (const t of sortTasks(tasks)) {
    if (t.date < today) {
      if (t.status !== 'concluida') groups[0].tasks.push(t);
    } else if (t.date === today) groups[1].tasks.push(t);
    else if (t.date === tomorrow) groups[2].tasks.push(t);
    else if (t.date <= weekEnd) groups[3].tasks.push(t);
    else groups[4].tasks.push(t);
  }
  return groups.filter((g) => g.tasks.length);
}

// ------------------------------------------------------------------
// Disciplinas
// ------------------------------------------------------------------

/** Disciplinas presentes nas tarefas, das com mais tarefas abertas para as com menos */
export function listCourses(tasks: Task[]): string[] {
  const count = new Map<string, number>();
  for (const t of tasks) {
    const c = cleanCourseName(t.course);
    if (!c) continue;
    count.set(c, (count.get(c) ?? 0) + (t.status === 'concluida' ? 0.01 : 1));
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

export function matchesCourse(task: Task, course: string | null): boolean {
  if (!course) return true;
  return cleanCourseName(task.course) === course;
}

/** Marca como concluídas as tarefas abertas cujo prazo já passou */
export function markOverdueDone(tasks: Task[], settings: Settings, now: Date = new Date(), ids?: Set<string>): Task[] {
  return tasks.map((t) =>
    t.status !== 'concluida' && (!ids || ids.has(t.id)) && dueDate(t, settings.allDayTime) < now
      ? { ...t, status: 'concluida', updatedAt: now.getTime() }
      : t,
  );
}

// ------------------------------------------------------------------
// Blocos de estudo antes das provas
// ------------------------------------------------------------------

export function isExam(t: Task): boolean {
  return t.emoji === EXAM_EMOJI && t.source !== 'estudo';
}

/**
 * Cria "📖 Estudar para <prova>" alguns dias antes de cada prova futura importada do Canvas
 * (ou marcada como prova). Move o bloco se a prova mudar de data. Não recria blocos excluídos.
 */
export function ensureStudyBlocks(tasks: Task[], settings: Settings, now: Date = new Date()): Task[] {
  if (!settings.studyBlocks) return tasks;
  const today = toKey(now);
  const result = [...tasks];
  const blocks = new Map(result.filter((t) => t.studyFor).map((t) => [t.studyFor as string, t]));
  for (const exam of tasks) {
    if (!isExam(exam) || exam.source !== 'feed' || exam.status === 'concluida') continue;
    if (exam.date <= today) continue;
    if (settings.dismissedStudy.includes(exam.id)) continue;
    let studyDate = toKey(addDays(fromKey(exam.date), -settings.studyDaysBefore));
    if (studyDate < today) studyDate = today;
    const existing = blocks.get(exam.id);
    const title = `Estudar para ${exam.title}`;
    if (existing) {
      if (existing.status !== 'concluida' && (existing.date !== studyDate || existing.title !== title || existing.course !== exam.course)) {
        const i = result.findIndex((t) => t.id === existing.id);
        result[i] = { ...existing, date: studyDate, title, course: exam.course, updatedAt: now.getTime() };
      }
      continue;
    }
    result.push(
      makeTask(
        {
          title,
          notes: `Bloco de estudo criado automaticamente ${settings.studyDaysBefore} ${settings.studyDaysBefore === 1 ? 'dia' : 'dias'} antes da prova.`,
          date: studyDate,
          priority: exam.priority === 'urgente' ? 'urgente' : 'alta',
          emoji: STUDY_EMOJI,
          status: 'pendente',
          reminders: [0],
          alarm: null,
          source: 'estudo',
          studyFor: exam.id,
          course: exam.course,
          subtasks: [
            { id: newId(), title: 'Revisar a matéria', done: false },
            { id: newId(), title: 'Fazer exercícios', done: false },
            { id: newId(), title: 'Anotar dúvidas', done: false },
          ],
        },
        now.getTime(),
      ),
    );
  }
  return result;
}

// ------------------------------------------------------------------
// Tarefas que se repetem
// ------------------------------------------------------------------

/** Quantos dias à frente as ocorrências de uma série ficam criadas */
export const SERIES_HORIZON_DAYS = 56;

export function nextOccurrence(from: string, repeat: Repeat): string {
  const d = fromKey(from);
  if (repeat.freq === 'diaria') return toKey(addDays(d, 1));
  if (repeat.freq === 'mensal') return toKey(addMonths(d, 1));
  const days = repeat.days?.length ? [...repeat.days].sort((a, b) => a - b) : [d.getDay()];
  for (let i = 1; i <= 7; i++) {
    const n = addDays(d, i);
    if (days.includes(n.getDay())) return toKey(n);
  }
  return toKey(addDays(d, 7));
}

export function describeRepeat(repeat?: Repeat): string {
  if (!repeat) return 'Não repete';
  if (repeat.freq === 'diaria') return 'Todo dia';
  if (repeat.freq === 'mensal') return 'Todo mês';
  const names = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const days = repeat.days ?? [];
  if (days.length === 7) return 'Todo dia';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((x) => days.includes(x))) return 'Dias úteis';
  return days.length ? `Toda ${days.map((x) => names[x]).join(', ')}` : 'Toda semana';
}

/** Cria as próximas ocorrências de cada série até o horizonte (idempotente). */
export function expandSeries(tasks: Task[], now: Date = new Date(), horizonDays = SERIES_HORIZON_DAYS): Task[] {
  const horizon = toKey(addDays(now, horizonDays));
  const latest = new Map<string, Task>();
  for (const t of tasks) {
    if (!t.seriesId || !t.repeat) continue;
    const cur = latest.get(t.seriesId);
    if (!cur || t.date > cur.date) latest.set(t.seriesId, t);
  }
  if (!latest.size) return tasks;
  const result = [...tasks];
  for (const tpl of latest.values()) {
    const rule = tpl.repeat as Repeat;
    let date = tpl.date;
    for (let guard = 0; guard < 400; guard++) {
      date = nextOccurrence(date, rule);
      if (date > horizon || (rule.until && date > rule.until)) break;
      result.push(
        makeTask(
          {
            ...stripMeta(tpl),
            date,
            status: 'pendente',
            focusMinutes: undefined,
            subtasks: tpl.subtasks?.map((s) => ({ ...s, id: newId(), done: false })),
          },
          now.getTime(),
        ),
      );
    }
  }
  return result;
}

function stripMeta(t: Task): TaskDraft {
  const { id, createdAt, updatedAt, ...draft } = t;
  void id;
  void createdAt;
  void updatedAt;
  return draft;
}

/** Novo id de série para uma tarefa recém-criada com repetição */
export function startSeries(task: Task): Task {
  return task.repeat ? { ...task, seriesId: task.seriesId ?? task.id } : task;
}

/** Encerra a série antes de `date` (usado em "excluir esta e as próximas") */
export function endSeriesBefore(tasks: Task[], seriesId: string, date: string): Task[] {
  const until = toKey(addDays(fromKey(date), -1));
  return tasks
    .filter((t) => !(t.seriesId === seriesId && t.date >= date))
    .map((t) => (t.seriesId === seriesId && t.repeat ? { ...t, repeat: { ...t.repeat, until } } : t));
}

/** Aplica uma alteração a esta ocorrência e às próximas da série */
export function updateSeriesFrom(tasks: Task[], from: Task, patch: Partial<Task>, now: Date = new Date()): Task[] {
  const { date, status, subtasks, focusMinutes, ...rest } = patch;
  void status;
  void focusMinutes;
  const ruleChanged = 'repeat' in patch && JSON.stringify(patch.repeat ?? null) !== JSON.stringify(from.repeat ?? null);
  let result = tasks.map((t) => {
    if (t.id === from.id) return { ...t, ...patch, updatedAt: now.getTime() };
    if (t.seriesId === from.seriesId && t.date > from.date) {
      return { ...t, ...rest, subtasks: subtasks ? subtasks.map((s) => ({ ...s, done: false })) : t.subtasks, updatedAt: now.getTime() };
    }
    return t;
  });
  if (ruleChanged || (date && date !== from.date)) {
    // regra ou data mudou: recria as próximas ocorrências a partir desta
    const anchor = result.find((t) => t.id === from.id) as Task;
    result = result.filter((t) => !(t.seriesId === from.seriesId && t.id !== from.id && t.date > from.date && t.status !== 'concluida'));
    if (anchor.repeat) {
      const seriesId = newId();
      result = result.map((t) => (t.id === anchor.id ? { ...t, seriesId } : t));
      // encerra a série antiga antes desta ocorrência
      result = result.map((t) => (t.seriesId === from.seriesId && t.repeat ? { ...t, repeat: { ...t.repeat, until: toKey(addDays(fromKey(from.date), -1)) } } : t));
      result = expandSeries(result, now);
    }
  }
  return result;
}

// ------------------------------------------------------------------
// Visão da semana
// ------------------------------------------------------------------

export interface DayLoad {
  key: string;
  date: Date;
  open: Task[];
  done: number;
  /** soma dos pesos de importância das tarefas abertas */
  load: number;
}

export function weekDays(anchor: Date): Date[] {
  const start = addDays(startOfDay(anchor), -anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekLoad(tasks: Task[], anchor: Date): DayLoad[] {
  const byDay = tasksByDay(tasks);
  return weekDays(anchor).map((date) => {
    const key = toKey(date);
    const list = byDay.get(key) ?? [];
    const open = list.filter((t) => t.status !== 'concluida');
    return { key, date, open, done: list.length - open.length, load: open.reduce((n, t) => n + priorityInfo(t.priority).weight, 0) };
  });
}

// ------------------------------------------------------------------
// Entregas no Canvas
// ------------------------------------------------------------------

/** Marca como concluídas (e "entregues") as tarefas cujas entregas o Canvas confirmou */
export function applySubmissions(tasks: Task[], submitted: Set<string>, now: Date = new Date()): { tasks: Task[]; changed: number } {
  let changed = 0;
  const result = tasks.map((t) => {
    if (!t.canvasAssignmentId || !submitted.has(t.canvasAssignmentId)) return t;
    if (t.submitted && t.status === 'concluida') return t;
    changed++;
    return { ...t, submitted: true, status: 'concluida' as const, updatedAt: now.getTime() };
  });
  return { tasks: result, changed };
}

// ------------------------------------------------------------------
// Tempo de estudo (Pomodoro)
// ------------------------------------------------------------------

export function addFocus(log: FocusEntry[], entry: FocusEntry, now: Date = new Date()): FocusEntry[] {
  const keepFrom = toKey(addDays(now, -120));
  return [...log.filter((e) => e.day >= keepFrom), entry];
}

export function focusStats(log: FocusEntry[], now: Date = new Date()): { week: number; today: number; byCourse: { course: string; minutes: number }[] } {
  const days = weekDays(now).map(toKey);
  const today = toKey(now);
  const byCourse = new Map<string, number>();
  let week = 0;
  let todayMin = 0;
  for (const e of log) {
    if (e.day === today) todayMin += e.minutes;
    if (!days.includes(e.day)) continue;
    week += e.minutes;
    const c = e.course || 'Outras tarefas';
    byCourse.set(c, (byCourse.get(c) ?? 0) + e.minutes);
  }
  return {
    week,
    today: todayMin,
    byCourse: [...byCourse.entries()].map(([course, minutes]) => ({ course, minutes })).sort((a, b) => b.minutes - a.minutes),
  };
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}
