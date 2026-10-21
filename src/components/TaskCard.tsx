import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatCountdown, formatRelativeDay, fromKey } from '../lib/dates';
import { dueDate } from '../lib/logic';
import { priorityInfo, statusInfo } from '../lib/meta';
import { alpha, priorityColor, radius, useTheme } from '../theme';
import type { Task } from '../types';
import { Tap, Txt } from './ui';

interface Props {
  task: Task;
  allDayTime: string;
  showDate?: boolean;
  onPress(): void;
  onCycleStatus(): void;
}

export const TaskCard = memo(function TaskCard({ task, allDayTime, showDate, onPress, onCycleStatus }: Props) {
  const p = useTheme();
  const pr = priorityInfo(task.priority);
  const st = statusInfo(task.status);
  const color = priorityColor(p, task.priority);
  const done = task.status === 'concluida';
  const due = dueDate(task, allDayTime);
  const now = new Date();
  const overdue = !done && due < now;

  const meta: string[] = [];
  if (showDate) meta.push(formatRelativeDay(fromKey(task.date), now));
  meta.push(task.time ? `🕑 ${task.time}` : '☀️ Dia inteiro');
  const origin = task.course ? `🎓 ${task.course}` : task.source === 'feed' && task.feedName ? `🔗 ${task.feedName}` : null;

  const statusBg = task.status === 'concluida' ? alpha(p.done, 0.16) : task.status === 'andamento' ? alpha(p.high, 0.16) : p.surfaceAlt;

  return (
    <Tap onPress={onPress} style={[styles.card, { backgroundColor: p.surface, borderColor: p.border, opacity: done ? 0.62 : 1 }]}>
      <View style={[styles.strip, { backgroundColor: color }]} />
      <View style={[styles.emoji, { backgroundColor: alpha(color, p.dark ? 0.2 : 0.12) }]}>
        <Text style={{ fontSize: 22 }}>{task.emoji}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {task.priority === 'urgente' || task.priority === 'alta' ? <Text style={styles.prEmoji}>{pr.emoji}</Text> : null}
          <Txt
            variant="subtitle"
            numberOfLines={2}
            style={[{ flexShrink: 1 }, done && { textDecorationLine: 'line-through', color: p.textMuted }]}
          >
            {task.title}
          </Txt>
        </View>
        <Txt variant="small" tone="muted" numberOfLines={1} style={{ marginTop: 3 }}>
          {meta.join('  ·  ')}
        </Txt>
        {origin ? (
          <Txt variant="tiny" tone="faint" numberOfLines={1} style={{ marginTop: 2 }}>
            {origin}
          </Txt>
        ) : null}
        <View style={styles.badges}>
          {overdue ? (
            <View style={[styles.badge, { backgroundColor: alpha(p.urgent, 0.14) }]}>
              <Txt variant="tiny" style={{ color: p.urgent }}>⚠️ Atrasada</Txt>
            </View>
          ) : !done ? (
            <View style={[styles.badge, { backgroundColor: p.surfaceAlt }]}>
              <Txt variant="tiny" tone="muted">{formatCountdown(due, now)}</Txt>
            </View>
          ) : null}
          {task.reminders.length > 0 && !done ? (
            <View style={[styles.badge, { backgroundColor: p.surfaceAlt }]}>
              <Txt variant="tiny" tone="muted">🔔 {task.reminders.length}</Txt>
            </View>
          ) : null}
          {task.alarm !== null && !done ? (
            <View style={[styles.badge, { backgroundColor: alpha(p.accent, 0.14) }]}>
              <Txt variant="tiny" tone="accent">⏰ Alarme</Txt>
            </View>
          ) : null}
        </View>
      </View>

      <Tap
        onPress={onCycleStatus}
        hitSlop={10}
        accessibilityLabel={`Status: ${st.label}. Toque para mudar`}
        style={[styles.status, { backgroundColor: statusBg }]}
      >
        <Text style={{ fontSize: 18 }}>{st.emoji}</Text>
        <Txt variant="tiny" tone="muted" style={{ marginTop: 2, fontSize: 9 }}>
          {task.status === 'andamento' ? 'Fazendo' : st.label}
        </Txt>
      </Tap>
    </Tap>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingRight: 10,
    paddingLeft: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  strip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  emoji: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  prEmoji: { fontSize: 15, marginRight: 5, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, marginRight: 6, marginTop: 2 },
  status: { width: 58, paddingVertical: 8, borderRadius: 14, alignItems: 'center', marginLeft: 8 },
});
