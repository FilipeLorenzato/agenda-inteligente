// Regras da agenda que não dependem do celular: criação, ordenação, importação de feeds
// e cálculo de quando cada notificação deve disparar.

import type { Feed, Settings, Task, TaskDraft } from '../types';
import { addDays, formatOffset, formatRelativeDay, fromKey, startOfDay, toKey, toTime, withTime } from './dates';
import { cleanDescription, IcsEvent, splitCanvasTitle } from './ical';
import { guessCategory, priorityInfo, statusInfo } from './meta';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'sistema',
  defaultReminders: [10080, 1440], // 1 semana e 1 dia antes
  allDayTime: '08:00',
  dailyDigest: true,
  dailyDigestTime: '07:30',
  feeds: [],
  autoSync: true,
  onboarded: false,
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
    const existing = byExternal.get(externalId);

    if (existing) {
      if (existing.title !== title || existing.date !== date || existing.time !== time || existing.url !== ev.url || existing.course !== course) {
        const idx = result.findIndex((t) => t.id === existing.id);
        result[idx] = { ...existing, title, date, time, url: ev.url, course, feedName: feed.name, updatedAt: now.getTime() };
        updated++;
      }
      continue;
    }

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
          status: 'pendente',
          reminders: [...settings.defaultReminders],
          alarm: null,
          source: 'feed',
          externalId,
          feedName: feed.name,
          course,
          url: ev.url,
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
