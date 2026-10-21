import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { capitalize, MONTHS, monthGrid, toKey, WEEKDAYS_LETTER } from '../lib/dates';
import { priorityInfo } from '../lib/meta';
import { alpha, priorityColor, radius, useTheme } from '../theme';
import type { Task } from '../types';
import { Tap, Txt } from './ui';

interface Props {
  year: number;
  month: number;
  selected: string;
  today: string;
  byDay: Map<string, Task[]>;
  onSelect(key: string): void;
  onShift(delta: number): void;
  onToday(): void;
}

export const MonthCalendar = memo(function MonthCalendar({ year, month, selected, today, byDay, onSelect, onShift, onToday }: Props) {
  const p = useTheme();
  const days = monthGrid(year, month);
  // Esconde a última semana se ela for toda do mês seguinte
  const visible = days[35].getMonth() !== month ? days.slice(0, 35) : days;

  return (
    <View>
      <View style={styles.header}>
        <Txt variant="title">
          {capitalize(MONTHS[month])} <Txt variant="title" tone="faint">{year}</Txt>
        </Txt>
        <View style={styles.headerActions}>
          <Tap onPress={onToday} style={[styles.todayBtn, { backgroundColor: p.accentSoft }]}>
            <Text style={{ color: p.accent, fontWeight: '800', fontSize: 13 }}>Hoje</Text>
          </Tap>
          <Tap onPress={() => onShift(-1)} style={[styles.arrow, { borderColor: p.border }]} accessibilityLabel="Mês anterior">
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>‹</Text>
          </Tap>
          <Tap onPress={() => onShift(1)} style={[styles.arrow, { borderColor: p.border }]} accessibilityLabel="Próximo mês">
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>›</Text>
          </Tap>
        </View>
      </View>

      <View style={styles.week}>
        {WEEKDAYS_LETTER.map((l, i) => (
          <View key={i} style={styles.cell}>
            <Txt variant="tiny" tone="faint" style={{ textAlign: 'center' }}>
              {l}
            </Txt>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {visible.map((d) => {
          const key = toKey(d);
          const inMonth = d.getMonth() === month;
          const isSel = key === selected;
          const isToday = key === today;
          const list = byDay.get(key) ?? [];
          const open = list.filter((t) => t.status !== 'concluida');
          const allDone = list.length > 0 && open.length === 0;
          const top = open.reduce<Task | null>(
            (acc, t) => (!acc || priorityInfo(t.priority).weight > priorityInfo(acc.priority).weight ? t : acc),
            null,
          );
          const flag = top && (top.priority === 'urgente' || top.priority === 'alta') ? priorityInfo(top.priority).emoji : null;
          return (
            <Tap key={key} onPress={() => onSelect(key)} style={styles.cell} accessibilityLabel={`Dia ${d.getDate()}, ${list.length} tarefas`}>
              <View
                style={[
                  styles.dayCircle,
                  isSel && { backgroundColor: p.accent },
                  !isSel && isToday && { borderWidth: 2, borderColor: p.accent },
                ]}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: isSel || isToday ? '800' : '600',
                    color: isSel ? p.onAccent : !inMonth ? p.textFaint : isToday ? p.accent : p.text,
                    opacity: inMonth ? 1 : 0.55,
                  }}
                >
                  {d.getDate()}
                </Text>
                {flag ? <Text style={styles.flag}>{flag}</Text> : null}
              </View>
              <View style={styles.dots}>
                {allDone ? (
                  <Text style={{ fontSize: 9, color: p.done, fontWeight: '900' }}>✓</Text>
                ) : (
                  open.slice(0, 3).map((t) => (
                    <View key={t.id} style={[styles.dot, { backgroundColor: priorityColor(p, t.priority) }]} />
                  ))
                )}
                {open.length > 3 ? <View style={[styles.dot, { backgroundColor: alpha(p.textFaint, 0.6) }]} /> : null}
              </View>
            </Tap>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, marginRight: 8 },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  week: { flexDirection: 'row', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
  dayCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  flag: { position: 'absolute', top: -5, right: -6, fontSize: 11 },
  dots: { flexDirection: 'row', height: 8, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 1.5 },
});
