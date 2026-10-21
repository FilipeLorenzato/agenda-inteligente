// Widget da tela inicial: tarefas de hoje e próximas entregas, com atalho para falar uma tarefa.
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { formatRelativeDay, fromKey, toKey, WEEKDAYS, MONTHS_SHORT } from '../lib/dates';
import { sortTasks } from '../lib/logic';
import { priorityInfo } from '../lib/meta';
import type { Task } from '../types';

export const WIDGET_NAME = 'Agenda';

const C = {
  bg: '#1C1922',
  row: '#26222D',
  text: '#F2EEF7',
  muted: '#A79FB3',
  accent: '#9D8BFF',
  onAccent: '#14111A',
  urgent: '#FF6B6E',
  high: '#FFB23F',
  normal: '#9D8BFF',
  low: '#4CC38A',
} as const;

const prColor = (t: Task) => (t.priority === 'urgente' ? C.urgent : t.priority === 'alta' ? C.high : t.priority === 'baixa' ? C.low : C.normal);

export function widgetItems(tasks: Task[], now: Date = new Date(), max = 4): { list: Task[]; overdue: number; today: number } {
  const today = toKey(now);
  const open = tasks.filter((t) => t.status !== 'concluida');
  const overdue = open.filter((t) => t.date < today).length;
  const upcoming = sortTasks(open.filter((t) => t.date >= today));
  return { list: upcoming.slice(0, max), overdue, today: upcoming.filter((t) => t.date === today).length };
}

export function AgendaWidget({ tasks, max = 4 }: { tasks: Task[]; max?: number }) {
  const now = new Date();
  const { list, overdue, today } = widgetItems(tasks, now, max);
  const header = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS_SHORT[now.getMonth()]}`;
  const summary = today === 0 ? 'Nada para hoje 🌱' : `${today} ${today === 1 ? 'tarefa' : 'tarefas'} hoje`;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 24,
        padding: 14,
        flexDirection: 'column',
      }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={header.toUpperCase()} style={{ fontSize: 11, color: C.muted, fontWeight: '700' }} />
          <TextWidget
            text={overdue ? `${summary} · ⚠️ ${overdue} atrasada${overdue > 1 ? 's' : ''}` : summary}
            style={{ fontSize: 15, color: C.text, fontWeight: '800' }}
            maxLines={1}
          />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'agenda://nova?modo=voz' }}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text="🎙️" style={{ fontSize: 18 }} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', marginTop: 10 }}>
        {list.length === 0 ? (
          <TextWidget text="Tudo em dia! Toque no 🎙️ para adicionar." style={{ fontSize: 13, color: C.muted }} />
        ) : (
          list.map((t) => {
            const day = formatRelativeDay(fromKey(t.date), now);
            const when = `${day}${t.time ? ` · ${t.time}` : ''}`;
            return (
              <FlexWidget
                key={t.id}
                clickAction="OPEN_URI"
                clickActionData={{ uri: `agenda://tarefa/${t.id}` }}
                style={{
                  width: 'match_parent',
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: C.row,
                  borderRadius: 12,
                  paddingVertical: 7,
                  paddingHorizontal: 10,
                  marginBottom: 6,
                }}
              >
                <FlexWidget style={{ width: 4, height: 26, borderRadius: 2, backgroundColor: prColor(t), marginRight: 8 }} />
                <TextWidget text={t.emoji} style={{ fontSize: 16, marginRight: 8 }} />
                <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
                  <TextWidget
                    text={`${t.priority === 'urgente' || t.priority === 'alta' ? priorityInfo(t.priority).emoji + ' ' : ''}${t.title}`}
                    style={{ fontSize: 13, color: C.text, fontWeight: '700' }}
                    maxLines={1}
                  />
                  <TextWidget text={when} style={{ fontSize: 11, color: C.muted }} maxLines={1} />
                </FlexWidget>
              </FlexWidget>
            );
          })
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
