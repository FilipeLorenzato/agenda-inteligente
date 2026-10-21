import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { addDays, capitalize, MONTHS_SHORT, WEEKDAYS_SHORT } from '../lib/dates';
import { weekLoad } from '../lib/logic';
import { priorityInfo } from '../lib/meta';
import { alpha, priorityColor, radius, useTheme } from '../theme';
import type { Task } from '../types';
import { Tap, Txt } from './ui';

interface Props {
  anchor: Date;
  tasks: Task[];
  selected: string;
  today: string;
  onSelect(key: string): void;
  onShift(weeks: number): void;
  onToday(): void;
}

/** Linha do tempo da semana: barra de carga por dia (soma da importância das tarefas abertas) */
export const WeekView = memo(function WeekView({ anchor, tasks, selected, today, onSelect, onShift, onToday }: Props) {
  const p = useTheme();
  const days = weekLoad(tasks, anchor);
  const max = Math.max(8, ...days.map((d) => d.load));
  const total = days.reduce((n, d) => n + d.open.length, 0);
  const heaviest = days.reduce((a, d) => (d.load > a.load ? d : a), days[0]);
  const first = days[0].date;
  const last = days[6].date;
  const range =
    first.getMonth() === last.getMonth()
      ? `${first.getDate()}–${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`
      : `${first.getDate()} ${MONTHS_SHORT[first.getMonth()]} – ${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`;
  const isThisWeek = days.some((d) => d.key === today);

  return (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{isThisWeek ? 'Esta semana' : capitalize(range)}</Txt>
          <Txt variant="small" tone="muted">
            {total === 0 ? 'Semana livre 🌴' : `${total} ${total === 1 ? 'tarefa aberta' : 'tarefas abertas'}${heaviest.load > 0 ? ` · dia mais cheio: ${WEEKDAYS_SHORT[heaviest.date.getDay()]}` : ''}`}
          </Txt>
        </View>
        {!isThisWeek ? (
          <Tap onPress={onToday} style={[styles.todayBtn, { backgroundColor: p.accentSoft }]}>
            <Text style={{ color: p.accent, fontWeight: '800', fontSize: 13 }}>Hoje</Text>
          </Tap>
        ) : null}
        <Tap onPress={() => onShift(-1)} style={[styles.arrow, { borderColor: p.border }]} accessibilityLabel="Semana anterior">
          <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>‹</Text>
        </Tap>
        <Tap onPress={() => onShift(1)} style={[styles.arrow, { borderColor: p.border }]} accessibilityLabel="Próxima semana">
          <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>›</Text>
        </Tap>
      </View>

      <View style={styles.cols}>
        {days.map((d) => {
          const isSel = d.key === selected;
          const isToday = d.key === today;
          const h = d.load ? 14 + (d.load / max) * 96 : 4;
          const top = d.open.reduce<Task | null>((a, t) => (!a || priorityInfo(t.priority).weight > priorityInfo(a.priority).weight ? t : a), null);
          const barColor = top ? priorityColor(p, top.priority) : p.border;
          return (
            <Tap key={d.key} onPress={() => onSelect(d.key)} style={styles.col} accessibilityLabel={`${WEEKDAYS_SHORT[d.date.getDay()]} ${d.date.getDate()}: ${d.open.length} tarefas`}>
              <Txt variant="tiny" tone={isToday ? 'accent' : 'faint'}>{WEEKDAYS_SHORT[d.date.getDay()].toUpperCase()}</Txt>
              <View style={[styles.dayNum, isSel && { backgroundColor: p.accent }, !isSel && isToday && { borderWidth: 2, borderColor: p.accent }]}>
                <Text style={{ fontWeight: '800', fontSize: 14, color: isSel ? p.onAccent : isToday ? p.accent : p.text }}>{d.date.getDate()}</Text>
              </View>
              <View style={styles.barArea}>
                <View style={[styles.bar, { height: h, backgroundColor: d.load ? alpha(barColor, 0.85) : p.surfaceAlt }]} />
              </View>
              <View style={styles.emojis}>
                {d.open.slice(0, 3).map((t) => (
                  <Text key={t.id} style={{ fontSize: 13, lineHeight: 17 }}>
                    {t.emoji}
                  </Text>
                ))}
                {d.open.length > 3 ? <Txt variant="tiny" tone="faint">+{d.open.length - 3}</Txt> : null}
                {d.done > 0 && d.open.length === 0 ? <Text style={{ fontSize: 12, color: p.done, fontWeight: '900' }}>✓</Text> : null}
              </View>
            </Tap>
          );
        })}
      </View>
    </View>
  );
});

export function shiftWeek(d: Date, weeks: number): Date {
  return addDays(d, weeks * 7);
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, marginRight: 4 },
  arrow: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  cols: { flexDirection: 'row' },
  col: { width: '14.2857%', alignItems: 'center' },
  dayNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  barArea: { height: 112, justifyContent: 'flex-end', marginTop: 8 },
  bar: { width: 16, borderRadius: 8 },
  emojis: { alignItems: 'center', marginTop: 6, minHeight: 56 },
});
