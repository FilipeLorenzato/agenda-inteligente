// Rode com: npx tsx --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTask } from '../src/lib/parser';
import { parseIcs, splitCanvasTitle, normalizeFeedUrl } from '../src/lib/ical';
import { DEFAULT_SETTINGS, makeTask, mergeFeedEvents, planForTask, planDigests, upcomingSections } from '../src/lib/logic';
import type { Feed, Task } from '../src/types';

const NOW = new Date(2026, 9, 21, 10, 0); // quarta, 21/10/2026 10:00

test('voz: prova com dia da semana, horário, prioridade e lembretes', () => {
  const r = parseTask('prova de sistemas operacionais sexta às 14h urgente, me lembra uma semana antes e um dia antes', NOW);
  assert.equal(r.title, 'Prova de sistemas operacionais');
  assert.equal(r.date, '2026-10-23');
  assert.equal(r.time, '14:00');
  assert.equal(r.priority, 'urgente');
  assert.equal(r.emoji, '📝');
  assert.deepEqual(r.reminders, [10080, 1440]);
});

test('voz: "dia 30 às 23:59"', () => {
  const r = parseTask('entregar trabalho de PAA dia 30 às 23:59', NOW);
  assert.equal(r.title, 'Entregar trabalho de PAA');
  assert.equal(r.date, '2026-10-30');
  assert.equal(r.time, '23:59');
  assert.equal(r.reminders, null);
});

test('voz: período do dia, alarme e "da tarde"', () => {
  const a = parseTask('reunião com o grupo amanhã de manhã', NOW);
  assert.equal(a.date, '2026-10-22');
  assert.equal(a.time, '09:00');
  const b = parseTask('dentista 25/11 às 3 da tarde com alarme', NOW);
  assert.equal(b.title, 'Dentista');
  assert.equal(b.date, '2026-11-25');
  assert.equal(b.time, '15:00');
  assert.equal(b.alarm, 0);
  const c = parseTask('estudar deadlock hoje à noite sem pressa', NOW);
  assert.equal(c.title, 'Estudar deadlock');
  assert.equal(c.time, '19:00');
  assert.equal(c.priority, 'baixa');
});

test('voz: alarme com antecedência e "e meia"', () => {
  const r = parseTask('academia às 7 e meia da manhã com alarme 30 minutos antes', NOW);
  assert.equal(r.title, 'Academia');
  assert.equal(r.time, '07:30');
  assert.equal(r.alarm, 30);
  assert.equal(r.date, '2026-10-22'); // 7:30 de hoje já passou -> amanhã
});

test('voz: "segunda prova" não vira segunda-feira', () => {
  const r = parseTask('segunda prova de BD na quinta-feira às 7h', NOW);
  assert.equal(r.title, 'Segunda prova de BD');
  assert.equal(r.date, '2026-10-22');
});

test('voz: data por extenso e lembretes em horas', () => {
  const r = parseTask('apresentação do seminário dia 5 de novembro às 10h, avisa 2 dias antes e 1 hora antes', NOW);
  assert.equal(r.date, '2026-11-05');
  assert.deepEqual(r.reminders, [2880, 60]);
});

test('voz: sem data nem horário fica para hoje, dia inteiro', () => {
  const r = parseTask('comprar pão', NOW);
  assert.equal(r.title, 'Comprar pão');
  assert.equal(r.date, '2026-10-21');
  assert.equal(r.time, undefined);
});

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTSTART:20261024T025900Z',
  'SUMMARY:TP1 - Hierarquia de memória [Arquitetura de Computadores III - 2026/2]',
  'UID:event-assignment-123',
  'URL:https://pucminas.instructure.com/courses/1/assignments/123',
  'DESCRIPTION:Entregar o relatório\\, em PDF.',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261105',
  'SUMMARY:Feriado acadêmico',
  'UID:event-calendar-event-9',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20250101T120000Z',
  'SUMMARY:Evento antigo',
  'UID:old',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('iCal: lê eventos do Canvas (UTC -> horário local, dia inteiro)', () => {
  const evs = parseIcs(ICS);
  assert.equal(evs.length, 3);
  assert.equal(evs[0].allDay, false);
  assert.equal(evs[0].start.toISOString(), '2026-10-24T02:59:00.000Z');
  assert.equal(evs[0].description, 'Entregar o relatório, em PDF.');
  assert.equal(evs[1].allDay, true);
  assert.deepEqual(splitCanvasTitle(evs[0].summary), {
    title: 'TP1 - Hierarquia de memória',
    course: 'Arquitetura de Computadores III - 2026/2',
  });
  assert.equal(normalizeFeedUrl('webcal://x.com/feed.ics'), 'https://x.com/feed.ics');
});

test('feed: importa, ignora antigos e preserva o que o usuário mudou', () => {
  const feed: Feed = { id: 'canvas', name: 'Canvas PUC', url: 'x', emoji: '🎓' };
  const first = mergeFeedEvents([], parseIcs(ICS), feed, DEFAULT_SETTINGS, NOW);
  assert.equal(first.added, 2);
  const tp = first.tasks.find((t) => t.title.startsWith('TP1')) as Task;
  assert.deepEqual(tp.reminders, [10080, 1440]);
  assert.equal(tp.course, 'Arquitetura de Computadores III - 2026/2');

  const edited = first.tasks.map((t) => (t.id === tp.id ? { ...t, status: 'andamento' as const, priority: 'urgente' as const } : t));
  const moved = ICS.replace('20261024T025900Z', '20261025T025900Z');
  const second = mergeFeedEvents(edited, parseIcs(moved), feed, DEFAULT_SETTINGS, NOW);
  assert.equal(second.added, 0);
  assert.equal(second.updated, 1);
  const tp2 = second.tasks.find((t) => t.id === tp.id) as Task;
  assert.equal(tp2.status, 'andamento');
  assert.equal(tp2.priority, 'urgente');
  assert.notEqual(tp2.date, tp.date);
});

test('notificações: 1 semana e 1 dia antes, alarme e nada para concluídas', () => {
  const task = makeTask({
    title: 'Prova de SO', date: '2026-11-03', time: '14:00', priority: 'urgente', emoji: '📝',
    status: 'pendente', reminders: [10080, 1440, 0], alarm: 60, source: 'manual',
  });
  const plan = planForTask(task, DEFAULT_SETTINGS, NOW);
  assert.equal(plan.length, 4);
  const times = plan.map((p) => `${p.kind}@${p.at.getDate()}/${p.at.getMonth() + 1} ${p.at.getHours()}:${p.at.getMinutes()}`);
  assert.deepEqual(times, ['lembrete@27/10 14:0', 'lembrete@2/11 14:0', 'lembrete@3/11 14:0', 'alarme@3/11 13:0']);
  assert.match(plan[0].body, /^Falta 1 semana/);
  assert.equal(planForTask({ ...task, status: 'concluida' }, DEFAULT_SETTINGS, NOW).length, 0);
  // lembrete que já passou não é agendado
  const soon = { ...task, date: '2026-10-22' };
  assert.equal(planForTask(soon, DEFAULT_SETTINGS, NOW).filter((p) => p.kind === 'lembrete').length, 2);
});

test('resumo diário e seções da tela Próximas', () => {
  const mk = (title: string, date: string, status: Task['status'] = 'pendente') =>
    makeTask({ title, date, priority: 'media', emoji: '📚', status, reminders: [], alarm: null, source: 'manual' });
  const tasks = [mk('Atrasada', '2026-10-19'), mk('Feita antiga', '2026-10-18', 'concluida'), mk('Hoje', '2026-10-21'), mk('Amanhã', '2026-10-22'), mk('Longe', '2026-12-01')];
  const digest = planDigests(tasks, DEFAULT_SETTINGS, NOW);
  assert.equal(digest[0].at.getDate(), 22); // 07:30 de hoje já passou
  const sections = upcomingSections(tasks, NOW).map((s) => s.key);
  assert.deepEqual(sections, ['atrasadas', 'hoje', 'amanha', 'depois']);
});
