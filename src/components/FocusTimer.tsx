// Timer de foco (Pomodoro): 25 min de foco + 5 de pausa (ajustável), com aviso no celular
// mesmo com o app fechado e registro do tempo estudado por tarefa e disciplina.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinutes } from '../lib/logic';
import { cancelNotification, scheduleFocusEnd } from '../services/notifications';
import { useStore } from '../state/store';
import { alpha, radius, useTheme } from '../theme';
import type { ActiveFocus } from '../types';
import { Button, Chip, Row, Tap, Txt } from './ui';

const PRESETS: [number, number][] = [
  [25, 5],
  [50, 10],
  [15, 3],
];

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function remainingOf(f: ActiveFocus, now = Date.now()): number {
  return f.endAt ? f.endAt - now : f.remainingMs;
}

interface Props {
  visible: boolean;
  /** Tarefa escolhida ao abrir (usada ao iniciar um foco novo) */
  taskId?: string;
  onClose(): void;
}

export function FocusTimer({ visible, taskId, onClose }: Props) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { tasks, settings, updateSettings, logFocus } = useStore();
  const active = settings.activeFocus;
  const [, setTick] = useState(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  const task = tasks.find((t) => t.id === (active?.taskId ?? taskId));

  const begin = useCallback(
    async (phase: 'foco' | 'pausa', minutes: number, cycles: number, forTask?: string) => {
      const endAt = Date.now() + minutes * 60000;
      const title = tasks.find((t) => t.id === forTask)?.title;
      const notificationId = await scheduleFocusEnd(new Date(endAt), phase, title);
      updateSettings({ activeFocus: { taskId: forTask, phase, endAt, remainingMs: minutes * 60000, phaseMinutes: minutes, cycles, notificationId } });
    },
    [tasks, updateSettings],
  );

  // Fase terminou: registra o foco e emenda a pausa (ou encerra depois da pausa)
  const finishPhase = useCallback(
    (f: ActiveFocus) => {
      if (f.phase === 'foco') {
        logFocus(f.taskId, f.phaseMinutes);
        const cycles = f.cycles + 1;
        const pause = cycles % 4 === 0 ? settings.breakMinutes * 3 : settings.breakMinutes;
        begin('pausa', pause, cycles, f.taskId);
      } else {
        updateSettings({
          activeFocus: { ...f, phase: 'foco', endAt: null, remainingMs: settings.focusMinutes * 60000, phaseMinutes: settings.focusMinutes, notificationId: undefined },
        });
      }
    },
    [begin, logFocus, settings.breakMinutes, settings.focusMinutes, updateSettings],
  );

  // Relógio: roda sempre que há um timer ativo (mesmo com a janela fechada)
  useEffect(() => {
    if (!active?.endAt) return;
    const id = setInterval(() => {
      const f = activeRef.current;
      if (!f?.endAt) return;
      if (f.endAt - Date.now() <= 0) finishPhase(f);
      else setTick((x) => x + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [active?.endAt, finishPhase]);

  const pause = () => {
    if (!active?.endAt) return;
    cancelNotification(active.notificationId);
    updateSettings({ activeFocus: { ...active, endAt: null, remainingMs: active.endAt - Date.now(), notificationId: undefined } });
  };
  const resume = async () => {
    if (!active || active.endAt) return;
    const endAt = Date.now() + active.remainingMs;
    const notificationId = await scheduleFocusEnd(new Date(endAt), active.phase, task?.title);
    updateSettings({ activeFocus: { ...active, endAt, notificationId } });
  };
  const stop = () => {
    if (!active) return onClose();
    cancelNotification(active.notificationId);
    if (active.phase === 'foco') {
      const elapsed = Math.floor((active.phaseMinutes * 60000 - remainingOf(active)) / 60000);
      logFocus(active.taskId, elapsed);
    }
    updateSettings({ activeFocus: null });
    onClose();
  };
  const skipPause = () => {
    if (!active) return;
    cancelNotification(active.notificationId);
    begin('foco', settings.focusMinutes, active.cycles, active.taskId);
  };

  const running = !!active?.endAt;
  const phase = active?.phase ?? 'foco';
  const total = (active?.phaseMinutes ?? settings.focusMinutes) * 60000;
  const remaining = active ? remainingOf(active) : total;
  const progress = Math.max(0, Math.min(1, 1 - remaining / total));
  const color = phase === 'foco' ? p.accent : p.done;
  const studied = task?.focusMinutes ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: alpha('#000000', 0.5) }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: p.bg, paddingBottom: insets.bottom + 18 }]}>
        <View style={[styles.grabber, { backgroundColor: p.border }]} />
        <Txt variant="label" tone="faint" style={{ textAlign: 'center' }}>
          {phase === 'foco' ? '⏱️ Modo foco' : '☕ Pausa'}
          {active?.cycles ? `  ·  ${active.cycles} ${active.cycles === 1 ? 'ciclo' : 'ciclos'}` : ''}
        </Txt>
        <Txt variant="subtitle" numberOfLines={2} style={{ textAlign: 'center', marginTop: 6 }}>
          {task ? `${task.emoji} ${task.title}` : 'Foco livre'}
        </Txt>

        <View style={[styles.ring, { borderColor: alpha(color, 0.18) }]}>
          <View style={[styles.ringInner, { backgroundColor: alpha(color, p.dark ? 0.16 : 0.08) }]}>
            <Text style={{ fontSize: 54, fontWeight: '900', color: p.text, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{fmt(remaining)}</Text>
            <Txt variant="small" tone="muted">{running ? (phase === 'foco' ? 'focando…' : 'descansando…') : active ? 'pausado' : 'pronto para começar'}</Txt>
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: p.surfaceAlt }]}>
          <View style={[styles.fill, { backgroundColor: color, width: `${progress * 100}%` }]} />
        </View>

        {!active ? (
          <>
            <Row style={{ justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
              {PRESETS.map(([f, b]) => (
                <Chip
                  key={f}
                  label={`${f} + ${b} min`}
                  compact
                  selected={settings.focusMinutes === f && settings.breakMinutes === b}
                  onPress={() => updateSettings({ focusMinutes: f, breakMinutes: b })}
                />
              ))}
            </Row>
            <Button label="Começar foco" emoji="▶️" onPress={() => begin('foco', settings.focusMinutes, 0, taskId)} style={{ marginTop: 8 }} />
          </>
        ) : (
          <Row style={{ marginTop: 18 }}>
            <Button label="Encerrar" emoji="⏹️" kind="ghost" onPress={stop} style={{ flex: 1 }} />
            {phase === 'pausa' ? (
              <Button label="Pular pausa" emoji="⏭️" kind="soft" onPress={skipPause} style={{ flex: 1, marginHorizontal: 8 }} />
            ) : null}
            {running ? (
              <Button label="Pausar" emoji="⏸️" kind="soft" onPress={pause} style={{ flex: 1.2, marginLeft: phase === 'pausa' ? 0 : 8 }} />
            ) : (
              <Button label={active.remainingMs === active.phaseMinutes * 60000 ? 'Começar' : 'Continuar'} emoji="▶️" onPress={resume} style={{ flex: 1.2, marginLeft: phase === 'pausa' ? 0 : 8 }} />
            )}
          </Row>
        )}

        <Txt variant="tiny" tone="faint" style={{ textAlign: 'center', marginTop: 14 }}>
          {studied ? `Você já focou ${formatMinutes(studied)} nesta tarefa. ` : ''}O celular avisa quando o tempo acabar, mesmo com o app fechado.
        </Txt>
      </View>
    </Modal>
  );
}

/** Pílula flutuante mostrando o timer ativo quando a janela está fechada */
export function FocusPill({ onPress }: { onPress(): void }) {
  const p = useTheme();
  const { settings, tasks } = useStore();
  const [, setTick] = useState(0);
  const active = settings.activeFocus;
  useEffect(() => {
    if (!active?.endAt) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [active?.endAt]);
  if (!active) return null;
  const task = tasks.find((t) => t.id === active.taskId);
  const color = active.phase === 'foco' ? p.accent : p.done;
  return (
    <Tap onPress={onPress} style={[styles.pill, { backgroundColor: color, shadowColor: color }]}>
      <Text style={{ fontSize: 14, marginRight: 6 }}>{active.phase === 'foco' ? '⏱️' : '☕'}</Text>
      <Text style={{ color: p.onAccent, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{fmt(remainingOf(active))}</Text>
      {task ? (
        <Text numberOfLines={1} style={{ color: p.onAccent, fontWeight: '600', marginLeft: 8, maxWidth: 140, opacity: 0.85 }}>
          {task.title}
        </Text>
      ) : null}
      {!active.endAt ? <Text style={{ color: p.onAccent, marginLeft: 6 }}>⏸️</Text> : null}
    </Tap>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  ring: { width: 230, height: 230, borderRadius: 115, borderWidth: 12, alignSelf: 'center', marginTop: 18, padding: 10 },
  ringInner: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 18, marginHorizontal: 30 },
  fill: { height: 8, borderRadius: 4 },
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 112,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
