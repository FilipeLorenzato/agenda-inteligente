import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TaskCard } from '../components/TaskCard';
import { Button, Card, Chip, Row, Txt } from '../components/ui';
import { upcomingSections } from '../lib/logic';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import type { Task } from '../types';

type Filter = 'abertas' | 'andamento' | 'concluidas' | 'todas';

export function UpcomingScreen({ onOpenTask }: { onOpenTask(task: Task): void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, settings, cycleStatus, notificationsAllowed, askNotifications } = useStore();
  const [filter, setFilter] = useState<Filter>('abertas');

  const sections = useMemo(() => {
    const filtered = tasks.filter((t) =>
      filter === 'abertas' ? t.status !== 'concluida' : filter === 'andamento' ? t.status === 'andamento' : filter === 'concluidas' ? t.status === 'concluida' : true,
    );
    return upcomingSections(filtered);
  }, [tasks, filter]);

  const total = sections.reduce((n, s) => n + s.tasks.length, 0);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 150 }}>
      <Txt variant="label" tone="faint">O que está chegando</Txt>
      <Txt variant="display" style={{ marginTop: 4 }}>Próximas 🔔</Txt>

      {!notificationsAllowed ? (
        <Card style={{ marginTop: 16, borderColor: p.high }}>
          <Txt variant="subtitle">🔕 Notificações desligadas</Txt>
          <Txt variant="small" tone="muted" style={{ marginTop: 4 }}>
            Sem permissão, o celular não consegue te avisar das tarefas nem tocar alarmes.
          </Txt>
          <Button label="Ativar notificações" emoji="🔔" onPress={askNotifications} style={{ marginTop: 12 }} />
        </Card>
      ) : null}

      <Row style={{ flexWrap: 'wrap', marginTop: 16 }}>
        <Chip label="Abertas" emoji="⏳" selected={filter === 'abertas'} onPress={() => setFilter('abertas')} compact />
        <Chip label="Fazendo" emoji="🚧" selected={filter === 'andamento'} onPress={() => setFilter('andamento')} compact />
        <Chip label="Concluídas" emoji="✅" selected={filter === 'concluidas'} onPress={() => setFilter('concluidas')} compact />
        <Chip label="Todas" selected={filter === 'todas'} onPress={() => setFilter('todas')} compact />
      </Row>

      {total === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 48 }}>
          <Text style={{ fontSize: 46 }}>{filter === 'concluidas' ? '🏁' : '🏖️'}</Text>
          <Txt variant="subtitle" style={{ marginTop: 10 }}>
            {filter === 'concluidas' ? 'Nada concluído ainda' : 'Tudo em dia!'}
          </Txt>
          <Txt variant="small" tone="muted" style={{ marginTop: 4, textAlign: 'center' }}>
            {filter === 'abertas' ? 'Nenhuma tarefa pendente pela frente.' : 'Nenhuma tarefa neste filtro.'}
          </Txt>
        </View>
      ) : (
        sections.map((s) => (
          <View key={s.key} style={{ marginTop: 18 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <Txt variant="subtitle" style={s.key === 'atrasadas' ? { color: p.urgent } : undefined}>
                {s.title}
              </Txt>
              <Txt variant="small" tone="faint">{s.tasks.length}</Txt>
            </Row>
            {s.tasks.map((t) => (
              <TaskCard key={t.id} task={t} allDayTime={settings.allDayTime} showDate onPress={() => onOpenTask(t)} onCycleStatus={() => cycleStatus(t.id)} />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}
