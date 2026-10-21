import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capitalize, formatOffset, formatRelativeDay, fromKey, toKey, withTime } from '../lib/dates';
import { describeRepeat } from '../lib/logic';
import { PRIORITIES } from '../lib/meta';
import { parseTask, ParsedTask } from '../lib/parser';
import { pickDate, pickTime } from '../services/pickers';
import { abortListening, speechAvailable, speechErrorMessage, startListening, stopListening } from '../services/speech';
import { alpha, priorityColor, radius, useTheme } from '../theme';
import type { TaskDraft } from '../types';
import { Button, Chip, Row, Tap, Txt } from './ui';

interface Props {
  visible: boolean;
  /** Abrir já ouvindo (botão do microfone) ou com o teclado (botão +) */
  mode: 'voz' | 'texto';
  defaultReminders: number[];
  onClose(): void;
  onAdd(draft: TaskDraft): void;
  onMoreDetails(draft: TaskDraft): void;
}

type Phase = 'idle' | 'listening' | 'review';

const EXAMPLES = [
  '“Prova de SO sexta às 14h, urgente, me lembra uma semana e um dia antes”',
  '“Academia toda segunda e quarta às 7h”',
  '“Dentista amanhã às 3 da tarde com alarme”',
];

export function QuickAdd({ visible, mode, defaultReminders, onClose, onAdd, onMoreDetails }: Props) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [fromVoice, setFromVoice] = useState(false);
  const unsub = useRef<(() => void) | null>(null);
  const finalText = useRef('');
  const pulse = useRef(new Animated.Value(0)).current;
  const level = useRef(new Animated.Value(0)).current;
  const canSpeak = speechAvailable();

  const toDraft = useCallback(
    (r: ParsedTask, text: string, voice: boolean): TaskDraft => ({
      title: r.title,
      date: r.date,
      time: r.time,
      priority: r.priority,
      emoji: r.emoji,
      status: 'pendente',
      reminders: r.reminders ?? [...defaultReminders],
      alarm: r.alarm,
      repeat: r.repeat ?? undefined,
      source: voice ? 'voz' : 'manual',
      notes: voice ? `🎙️ “${text}”` : undefined,
    }),
    [defaultReminders],
  );

  const interpret = useCallback(
    (text: string, voice: boolean) => {
      const clean = text.trim();
      if (!clean) return;
      const r = parseTask(clean);
      setParsed(r);
      setDraft(toDraft(r, clean, voice));
      setFromVoice(voice);
      setPhase('review');
    },
    [toDraft],
  );

  const stopAll = useCallback(() => {
    unsub.current?.();
    unsub.current = null;
  }, []);

  const listen = useCallback(async () => {
    setError('');
    setTranscript('');
    finalText.current = '';
    Keyboard.dismiss();
    if (!canSpeak) {
      setError('O reconhecimento de voz não está disponível. Digite abaixo — ou use o 🎤 do teclado para ditar.');
      return;
    }
    try {
      stopAll();
      setPhase('listening');
      unsub.current = await startListening({
        onResult: (e) => {
          const t = e.results[0]?.transcript ?? '';
          setTranscript(t);
          if (e.isFinal) finalText.current = t;
        },
        onError: (e) => {
          const msg = speechErrorMessage(e.error);
          if (msg) setError(msg);
        },
        onVolume: (v) => {
          Animated.timing(level, { toValue: Math.max(0, Math.min(1, (v + 2) / 12)), duration: 110, useNativeDriver: true }).start();
        },
        onEnd: () => {
          stopAll();
          const text = finalText.current;
          if (text.trim()) interpret(text, true);
          else setPhase('idle');
        },
      });
    } catch (e) {
      setPhase('idle');
      setError(e instanceof Error ? e.message : 'Não foi possível usar o microfone');
    }
  }, [canSpeak, interpret, level, stopAll]);

  // Ao abrir: reseta e, no modo voz, já começa a ouvir
  useEffect(() => {
    if (!visible) {
      stopAll();
      abortListening();
      return;
    }
    setPhase('idle');
    setParsed(null);
    setDraft(null);
    setTyped('');
    setTranscript('');
    setError('');
    if (mode === 'voz') listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (phase !== 'listening') return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  const set = (patch: Partial<TaskDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const micScale = level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={[styles.backdrop, { backgroundColor: alpha('#000000', 0.45) }]} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: p.bg, paddingBottom: insets.bottom + 18 }]}>
        <View style={[styles.grabber, { backgroundColor: p.border }]} />

        {phase !== 'review' ? (
          <>
            <Txt variant="title" style={{ textAlign: 'center' }}>
              {phase === 'listening' ? 'Estou ouvindo…' : 'Adicionar rápido'}
            </Txt>
            <Txt variant="small" tone="muted" style={{ textAlign: 'center', marginTop: 4 }}>
              Fale ou digite do seu jeito — eu organizo a tarefa.
            </Txt>

            <View style={styles.micArea}>
              {phase === 'listening' ? (
                <Animated.View style={[styles.ring, { backgroundColor: p.accent, opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
              ) : null}
              <Animated.View style={{ transform: [{ scale: phase === 'listening' ? micScale : 1 }] }}>
                <Tap
                  onPress={phase === 'listening' ? stopListening : listen}
                  style={[styles.mic, { backgroundColor: phase === 'listening' ? p.urgent : p.accent }]}
                  accessibilityLabel={phase === 'listening' ? 'Parar de ouvir' : 'Falar uma tarefa'}
                >
                  {phase === 'listening' ? (
                    <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: '#FFFFFF' }} />
                  ) : (
                    <Text style={{ fontSize: 34 }}>🎙️</Text>
                  )}
                </Tap>
              </Animated.View>
            </View>

            {transcript ? (
              <Txt variant="subtitle" style={{ textAlign: 'center', minHeight: 44 }}>
                {transcript}
              </Txt>
            ) : (
              <View style={{ minHeight: 44 }}>
                {EXAMPLES.slice(0, 2).map((ex) => (
                  <Txt key={ex} variant="small" tone="faint" style={{ textAlign: 'center', fontStyle: 'italic' }}>
                    {ex}
                  </Txt>
                ))}
              </View>
            )}
            {error ? (
              <Txt variant="small" tone="urgent" style={{ textAlign: 'center', marginTop: 8 }}>
                {error}
              </Txt>
            ) : null}

            <View style={[styles.inputRow, { backgroundColor: p.surface, borderColor: p.border }]}>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                placeholder="ex.: lista de BD quinta 19h importante"
                placeholderTextColor={p.textFaint}
                style={[styles.input, { color: p.text }]}
                returnKeyType="done"
                autoFocus={mode === 'texto'}
                onSubmitEditing={() => interpret(typed, false)}
                onFocus={() => {
                  if (phase === 'listening') abortListening();
                }}
              />
              <Tap onPress={() => interpret(typed, false)} style={[styles.send, { backgroundColor: typed.trim() ? p.accent : p.surfaceAlt }]}>
                <Text style={{ color: typed.trim() ? p.onAccent : p.textFaint, fontWeight: '900', fontSize: 16 }}>➜</Text>
              </Tap>
            </View>
          </>
        ) : draft && parsed ? (
          <Review
            draft={draft}
            parsed={parsed}
            usedDefaults={parsed.reminders === null}
            fromVoice={fromVoice}
            set={set}
            onRetry={() => (fromVoice ? listen() : setPhase('idle'))}
            onMore={() => onMoreDetails(draft)}
            onAdd={() => onAdd(draft)}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function Review({
  draft,
  parsed,
  usedDefaults,
  fromVoice,
  set,
  onRetry,
  onMore,
  onAdd,
}: {
  draft: TaskDraft;
  parsed: ParsedTask;
  usedDefaults: boolean;
  fromVoice: boolean;
  set(patch: Partial<TaskDraft>): void;
  onRetry(): void;
  onMore(): void;
  onAdd(): void;
}) {
  const p = useTheme();
  const day = fromKey(draft.date);
  const color = priorityColor(p, draft.priority);
  const reminderTxt = draft.reminders.length ? draft.reminders.map(formatOffset).join(', ') : 'nenhum';

  return (
    <View>
      <Txt variant="label" tone="faint" style={{ textAlign: 'center' }}>
        {fromVoice ? '🎙️ Entendi assim' : '✍️ Entendi assim'}
      </Txt>

      <View style={[styles.preview, { backgroundColor: p.surface, borderColor: color }]}>
        <Row>
          <View style={[styles.previewEmoji, { backgroundColor: alpha(color, p.dark ? 0.22 : 0.13) }]}>
            <Text style={{ fontSize: 26 }}>{draft.emoji}</Text>
          </View>
          <TextInput
            value={draft.title}
            onChangeText={(title) => set({ title })}
            multiline
            style={{ flex: 1, color: p.text, fontSize: 19, fontWeight: '800', padding: 0 }}
          />
        </Row>

        <Row style={{ flexWrap: 'wrap', marginTop: 14 }}>
          <Chip
            emoji="📅"
            label={capitalize(formatRelativeDay(day))}
            selected
            compact
            onPress={async () => {
              const d = await pickDate(day);
              if (d) set({ date: toKey(d) });
            }}
          />
          <Chip
            emoji="🕑"
            label={draft.time ?? 'Dia inteiro'}
            selected={!!draft.time}
            compact
            onPress={async () => {
              const t = await pickTime(withTime(day, draft.time ?? '09:00'));
              if (t) set({ time: t });
            }}
          />
          <Chip
            emoji="⏰"
            label={draft.alarm === null ? 'Sem alarme' : draft.alarm === 0 ? 'Alarme' : `Alarme ${formatOffset(draft.alarm)} antes`}
            selected={draft.alarm !== null}
            compact
            onPress={() => set({ alarm: draft.alarm === null ? 0 : null })}
          />
          {draft.repeat ? <Chip emoji="🔁" label={describeRepeat(draft.repeat)} selected compact onPress={() => set({ repeat: undefined })} /> : null}
        </Row>

        <Row style={{ marginTop: 4 }}>
          {PRIORITIES.map((x) => (
            <Tap
              key={x.key}
              onPress={() => set({ priority: x.key })}
              style={[
                styles.prBtn,
                {
                  borderColor: draft.priority === x.key ? priorityColor(p, x.key) : p.border,
                  backgroundColor: draft.priority === x.key ? alpha(priorityColor(p, x.key), 0.14) : 'transparent',
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{x.emoji}</Text>
              <Txt variant="tiny" style={{ color: draft.priority === x.key ? priorityColor(p, x.key) : p.textFaint, marginTop: 2 }}>
                {x.label}
              </Txt>
            </Tap>
          ))}
        </Row>

        <Txt variant="small" tone="muted" style={{ marginTop: 12 }}>
          🔔 Notificar: {reminderTxt}
          {draft.reminders.length ? ' antes' : ''}
          {usedDefaults ? '  (padrão)' : ''}
        </Txt>
        {parsed.matched.length ? (
          <Txt variant="tiny" tone="faint" style={{ marginTop: 10 }}>
            Reconheci: {parsed.matched.map((m) => `“${m}”`).join(' · ')}
          </Txt>
        ) : null}
      </View>

      <Button label="Adicionar à agenda" emoji="✓" onPress={onAdd} style={{ marginTop: 16 }} />
      <Row style={{ marginTop: 8 }}>
        <Button label={fromVoice ? 'Falar de novo' : 'Voltar'} emoji={fromVoice ? '🎙️' : '↩️'} kind="ghost" onPress={onRetry} style={{ flex: 1, marginRight: 8 }} />
        <Button label="Mais detalhes" emoji="✏️" kind="soft" onPress={onMore} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
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
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  micArea: { height: 150, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  mic: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 18,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  preview: { borderWidth: 2, borderRadius: radius.lg, padding: 16, marginTop: 12 },
  previewEmoji: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  prBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, marginRight: 6 },
});
