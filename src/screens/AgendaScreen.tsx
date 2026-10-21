import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Row, Tap, Txt } from '../components/ui';
import { MonthCalendar } from '../components/MonthCalendar';
import { TaskCard } from '../components/TaskCard';
import { capitalize, formatLongDate, fromKey, toKey } from '../lib/dates';
import { tasksByDay } from '../lib/logic';
import { useStore } from '../state/store';
import { alpha, radius, useTheme } from '../theme';
import type { Task } from '../types';

function greeting(h: number): string {
  if (h < 5) return 'Boa madrugada 🌌';
  if (h < 12) return 'Bom dia ☀️';
  if (h < 18) return 'Boa tarde 🌤️';
  return 'Boa noite 🌙';
}

interface Props {
  selected: string;
  onSelect(key: string): void;
  onOpenTask(task: Task): void;
  onNewOnDay(key: string): void;
}

export function AgendaScreen({ selected, onSelect, onOpenTask, onNewOnDay }: Props) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, settings, cycleStatus, updateSettings } = useStore();
  const now = new Date();
  const todayKey = toKey(now);
  const sel = fromKey(selected);
  const [view, setView] = useState({ y: sel.getFullYear(), m: sel.getMonth() });

  const byDay = useMemo(() => tasksByDay(tasks), [tasks]);
  const dayTasks = byDay.get(selected) ?? [];
  const openToday = (byDay.get(todayKey) ?? []).filter((t) => t.status !== 'concluida').length;
  const urgent = tasks.filter((t) => t.status !== 'concluida' && t.priority === 'urgente' && t.date >= todayKey).length;
  const doing = tasks.filter((t) => t.status === 'andamento').length;
  const doneOfDay = dayTasks.filter((t) => t.status === 'concluida').length;

  const shift = (delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const goToday = () => {
    setView({ y: now.getFullYear(), m: now.getMonth() });
    onSelect(todayKey);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 150 }}
      showsVerticalScrollIndicator={false}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Txt variant="label" tone="faint">{formatLongDate(now)}</Txt>
          <Txt variant="display" style={{ marginTop: 4 }}>{greeting(now.getHours())}</Txt>
        </View>
        <Tap
          onPress={() => updateSettings({ theme: p.dark ? 'claro' : 'escuro' })}
          style={[styles.themeBtn, { backgroundColor: p.surface, borderColor: p.border }]}
          accessibilityLabel={p.dark ? 'Mudar para o modo claro' : 'Mudar para o modo noturno'}
        >
          <Text style={{ fontSize: 20 }}>{p.dark ? '☀️' : '🌙'}</Text>
        </Tap>
      </Row>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18 }}>
        <Stat emoji="📍" value={openToday} label="para hoje" color={p.accent} />
        <Stat emoji="🔥" value={urgent} label={urgent === 1 ? 'urgente' : 'urgentes'} color={p.urgent} />
        <Stat emoji="🚧" value={doing} label="em andamento" color={p.high} />
      </ScrollView>

      <Card style={{ marginTop: 16, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8 }}>
        <MonthCalendar
          year={view.y}
          month={view.m}
          selected={selected}
          today={todayKey}
          byDay={byDay}
          onSelect={(k) => {
            onSelect(k);
            const d = fromKey(k);
            if (d.getMonth() !== view.m) setView({ y: d.getFullYear(), m: d.getMonth() });
          }}
          onShift={shift}
          onToday={goToday}
        />
      </Card>

      <Row style={{ justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="title">{selected === todayKey ? 'Hoje' : capitalize(formatLongDate(sel))}</Txt>
          <Txt variant="small" tone="muted">
            {dayTasks.length === 0
              ? 'Nada marcado'
              : `${dayTasks.length} ${dayTasks.length === 1 ? 'tarefa' : 'tarefas'}${doneOfDay ? ` · ${doneOfDay} ✅` : ''}`}
          </Txt>
        </View>
        <Tap onPress={() => onNewOnDay(selected)} style={[styles.addDay, { backgroundColor: p.accentSoft }]}>
          <Text style={{ color: p.accent, fontWeight: '800' }}>＋ Tarefa</Text>
        </Tap>
      </Row>

      {dayTasks.length === 0 ? (
        <Tap onPress={() => onNewOnDay(selected)} style={[styles.empty, { borderColor: p.border }]}>
          <Text style={{ fontSize: 34 }}>🌱</Text>
          <Txt variant="subtitle" style={{ marginTop: 8 }}>Dia livre</Txt>
          <Txt variant="small" tone="muted" style={{ textAlign: 'center', marginTop: 4 }}>
            Toque aqui ou no 🎙️ para adicionar algo neste dia.
          </Txt>
        </Tap>
      ) : (
        dayTasks.map((t) => (
          <TaskCard key={t.id} task={t} allDayTime={settings.allDayTime} onPress={() => onOpenTask(t)} onCycleStatus={() => cycleStatus(t.id)} />
        ))
      )}
    </ScrollView>
  );
}

function Stat({ emoji, value, label, color }: { emoji: string; value: number; label: string; color: string }) {
  const p = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: alpha(color, p.dark ? 0.16 : 0.1), borderColor: alpha(color, 0.25) }]}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={{ color, fontSize: 22, fontWeight: '900', marginLeft: 8 }}>{value}</Text>
      <Txt variant="small" tone="muted" style={{ marginLeft: 6 }}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  themeBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    marginRight: 10,
  },
  addDay: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.lg, alignItems: 'center', padding: 26 },
});
