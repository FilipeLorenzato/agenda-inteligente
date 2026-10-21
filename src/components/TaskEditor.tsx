import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capitalize, formatLongDate, formatOffset, fromKey, toKey, withTime } from '../lib/dates';
import { cleanCourseName } from '../lib/ical';
import { describeRepeat, formatMinutes, newId } from '../lib/logic';
import { CATEGORIES, courseStyle, PRIORITIES, REMINDER_PRESETS, STATUSES } from '../lib/meta';
import { useStore } from '../state/store';
import { pickDate, pickTime } from '../services/pickers';
import { alpha, priorityColor, radius, useTheme } from '../theme';
import type { RepeatFreq, TaskDraft } from '../types';
import { Button, Chip, Row, SectionLabel, Tap, Txt } from './ui';

interface Props {
  visible: boolean;
  initial: TaskDraft | null;
  isNew: boolean;
  onClose(): void;
  onSave(draft: TaskDraft): void;
  onDelete?(scope: 'esta' | 'proximas'): void;
  onFocus?(): void;
}

const WEEK_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const REPEAT_OPTIONS: { key: RepeatFreq | 'nao'; label: string; emoji: string }[] = [
  { key: 'nao', label: 'Não repete', emoji: '➖' },
  { key: 'diaria', label: 'Todo dia', emoji: '📆' },
  { key: 'semanal', label: 'Semanal', emoji: '🔁' },
  { key: 'mensal', label: 'Todo mês', emoji: '🗓️' },
];

const UNITS: { key: string; label: string; mult: number }[] = [
  { key: 'min', label: 'min', mult: 1 },
  { key: 'h', label: 'horas', mult: 60 },
  { key: 'd', label: 'dias', mult: 1440 },
  { key: 'w', label: 'semanas', mult: 10080 },
];
const ALARM_PRESETS = [0, 5, 15, 30, 60, 120];

export function TaskEditor({ visible, initial, isNew, onClose, onSave, onDelete, onFocus }: Props) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const [d, setD] = useState<TaskDraft | null>(initial);
  const [customOpen, setCustomOpen] = useState(false);
  const [customNum, setCustomNum] = useState('2');
  const [customUnit, setCustomUnit] = useState('h');
  const [newSub, setNewSub] = useState('');
  const { settings } = useStore();

  useEffect(() => {
    setD(initial);
    setCustomOpen(false);
    setNewSub('');
  }, [initial, visible]);

  if (!d) return null;
  const set = (patch: Partial<TaskDraft>) => setD((prev) => (prev ? { ...prev, ...patch } : prev));
  const day = fromKey(d.date);

  const toggleReminder = (min: number) => {
    const has = d.reminders.includes(min);
    set({ reminders: has ? d.reminders.filter((m) => m !== min) : [...d.reminders, min].sort((a, b) => b - a) });
  };
  const addCustom = () => {
    const n = parseInt(customNum, 10);
    const unit = UNITS.find((u) => u.key === customUnit) ?? UNITS[1];
    if (!n || n < 1) return;
    const min = n * unit.mult;
    if (!d.reminders.includes(min)) set({ reminders: [...d.reminders, min].sort((a, b) => b - a) });
    setCustomOpen(false);
  };
  const customs = d.reminders.filter((m) => !REMINDER_PRESETS.includes(m));

  const subs = d.subtasks ?? [];
  const addSub = () => {
    const t = newSub.trim();
    if (!t) return;
    set({ subtasks: [...subs, { id: newId(), title: t, done: false }] });
    setNewSub('');
  };
  const setRepeat = (key: RepeatFreq | 'nao') => {
    if (key === 'nao') return set({ repeat: undefined });
    set({ repeat: key === 'semanal' ? { freq: 'semanal', days: d.repeat?.days?.length ? d.repeat.days : [day.getDay()] } : { freq: key } });
  };
  const toggleWeekday = (w: number) => {
    const days = d.repeat?.days ?? [];
    const next = days.includes(w) ? days.filter((x) => x !== w) : [...days, w].sort((a, b) => a - b);
    if (next.length) set({ repeat: { freq: 'semanal', days: next } });
  };
  const course = cleanCourseName(d.course);
  const cs = course ? courseStyle(course, settings.courseStyles) : null;

  const save = () => {
    const title = d.title.trim();
    if (!title) {
      Alert.alert('Falta o título', 'Dê um nome para a tarefa 🙂');
      return;
    }
    onSave({ ...d, title });
  };

  const confirmDelete = () => {
    if (!onDelete) return;
    if (d.seriesId) {
      Alert.alert('Excluir tarefa que se repete', 'Quer excluir só esta ou também as próximas?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Só esta', onPress: () => onDelete('esta') },
        { text: 'Esta e as próximas', style: 'destructive', onPress: () => onDelete('proximas') },
      ]);
      return;
    }
    const msg =
      d.source === 'feed'
        ? 'Ela volta na próxima sincronização do Canvas. Se já fez, prefira marcar como ✅ Concluída.'
        : d.studyFor
          ? 'O bloco de estudo desta prova não será criado de novo.'
          : 'Essa ação não pode ser desfeita.';
    Alert.alert('Excluir tarefa?', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => onDelete('esta') },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.root, { backgroundColor: p.bg, paddingTop: insets.top }]}>
        <Row style={[styles.header, { borderBottomColor: p.border }]}>
          <Tap onPress={onClose} style={[styles.close, { backgroundColor: p.surfaceAlt }]} accessibilityLabel="Fechar">
            <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>✕</Text>
          </Tap>
          <Txt variant="subtitle" style={{ flex: 1, textAlign: 'center' }}>
            {isNew ? 'Nova tarefa' : 'Editar tarefa'}
          </Txt>
          <Tap onPress={save} style={[styles.save, { backgroundColor: p.accent }]}>
            <Text style={{ color: p.onAccent, fontWeight: '800' }}>Salvar</Text>
          </Tap>
        </Row>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.titleBox, { backgroundColor: p.surface, borderColor: p.border }]}>
            <Text style={{ fontSize: 30, marginRight: 10 }}>{d.emoji}</Text>
            <TextInput
              value={d.title}
              onChangeText={(title) => set({ title })}
              placeholder="O que você precisa fazer?"
              placeholderTextColor={p.textFaint}
              style={[styles.titleInput, { color: p.text }]}
              multiline
              autoFocus={isNew && !d.title}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ paddingRight: 20 }}>
            {CATEGORIES.map((c) => (
              <Tap
                key={c.emoji}
                onPress={() => set({ emoji: c.emoji })}
                style={[
                  styles.emojiChoice,
                  { borderColor: d.emoji === c.emoji ? p.accent : p.border, backgroundColor: d.emoji === c.emoji ? p.accentSoft : p.surface },
                ]}
              >
                <Text style={{ fontSize: 20 }}>{c.emoji}</Text>
                <Txt variant="tiny" tone="muted" style={{ marginTop: 2, fontSize: 9 }}>
                  {c.label.split(' ')[0]}
                </Txt>
              </Tap>
            ))}
          </ScrollView>

          <SectionLabel>Quando</SectionLabel>
          <Row>
            <Tap
              onPress={async () => {
                const picked = await pickDate(day);
                if (picked) set({ date: toKey(picked) });
              }}
              style={[styles.field, { flex: 1.6, backgroundColor: p.surface, borderColor: p.border }]}
            >
              <Txt variant="tiny" tone="faint">📅 DATA</Txt>
              <Txt variant="body" style={{ fontWeight: '700', marginTop: 2 }}>{capitalize(formatLongDate(day))}</Txt>
            </Tap>
            <View style={{ width: 10 }} />
            <Tap
              onPress={async () => {
                const picked = await pickTime(withTime(day, d.time ?? '09:00'));
                if (picked) set({ time: picked });
              }}
              style={[styles.field, { flex: 1, backgroundColor: p.surface, borderColor: p.border }]}
            >
              <Txt variant="tiny" tone="faint">🕑 HORÁRIO</Txt>
              <Txt variant="body" style={{ fontWeight: '700', marginTop: 2 }}>{d.time ?? 'Dia inteiro'}</Txt>
            </Tap>
          </Row>
          <Row style={{ marginTop: 10, justifyContent: 'space-between' }}>
            <Txt variant="small" tone="muted">☀️ Dia inteiro (sem horário)</Txt>
            <Switch
              value={!d.time}
              onValueChange={(v) => set({ time: v ? undefined : '09:00' })}
              trackColor={{ true: p.accent, false: p.border }}
              thumbColor={p.surface}
            />
          </Row>

          <SectionLabel>Importância</SectionLabel>
          <Row style={{ flexWrap: 'wrap' }}>
            {PRIORITIES.map((pr) => (
              <Chip
                key={pr.key}
                emoji={pr.emoji}
                label={pr.label}
                selected={d.priority === pr.key}
                color={priorityColor(p, pr.key)}
                onPress={() => set({ priority: pr.key })}
              />
            ))}
          </Row>

          <SectionLabel>Status</SectionLabel>
          <Row style={{ flexWrap: 'wrap' }}>
            {STATUSES.map((s) => (
              <Chip
                key={s.key}
                emoji={s.emoji}
                label={s.label}
                selected={d.status === s.key}
                color={s.key === 'concluida' ? p.done : s.key === 'andamento' ? p.high : p.textMuted}
                onPress={() => set({ status: s.key })}
              />
            ))}
          </Row>

          <SectionLabel>Notificar antes do prazo</SectionLabel>
          <Row style={{ flexWrap: 'wrap' }}>
            {REMINDER_PRESETS.map((m) => (
              <Chip key={m} label={formatOffset(m)} selected={d.reminders.includes(m)} onPress={() => toggleReminder(m)} compact />
            ))}
            {customs.map((m) => (
              <Chip key={`c${m}`} label={`${formatOffset(m)}  ✕`} selected onPress={() => toggleReminder(m)} compact />
            ))}
            <Chip label="＋ Outro" onPress={() => setCustomOpen((v) => !v)} compact />
          </Row>
          {customOpen ? (
            <View style={[styles.customBox, { backgroundColor: p.surface, borderColor: p.border }]}>
              <Row>
                <TextInput
                  value={customNum}
                  onChangeText={(t) => setCustomNum(t.replace(/\D/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  style={[styles.numInput, { color: p.text, borderColor: p.border, backgroundColor: p.bg }]}
                />
                <Row style={{ flexWrap: 'wrap', flex: 1, marginLeft: 10 }}>
                  {UNITS.map((u) => (
                    <Chip key={u.key} label={u.label} selected={customUnit === u.key} onPress={() => setCustomUnit(u.key)} compact />
                  ))}
                </Row>
              </Row>
              <Button label="Adicionar lembrete" kind="soft" onPress={addCustom} style={{ marginTop: 4 }} />
            </View>
          ) : null}
          <Txt variant="small" tone="faint" style={{ marginTop: 2 }}>
            {d.reminders.length
              ? `Você será avisado ${d.reminders.length === 1 ? 'uma vez' : `${d.reminders.length} vezes`}${d.time ? '' : ` (tarefas de dia inteiro usam o horário de referência dos Ajustes)`}.`
              : 'Sem lembretes para esta tarefa.'}
          </Txt>

          <SectionLabel>Alarme</SectionLabel>
          <View style={[styles.alarmBox, { backgroundColor: d.alarm !== null ? alpha(p.accent, 0.1) : p.surface, borderColor: d.alarm !== null ? p.accent : p.border }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Txt variant="subtitle">⏰ Tocar alarme</Txt>
                <Txt variant="small" tone="muted">Som de alarme e vibração longa, mesmo no “Não perturbe”.</Txt>
              </View>
              <Switch
                value={d.alarm !== null}
                onValueChange={(v) => set({ alarm: v ? 0 : null })}
                trackColor={{ true: p.accent, false: p.border }}
                thumbColor={p.surface}
              />
            </Row>
            {d.alarm !== null ? (
              <Row style={{ flexWrap: 'wrap', marginTop: 12 }}>
                {ALARM_PRESETS.map((m) => (
                  <Chip key={m} label={m === 0 ? 'Na hora' : `${formatOffset(m)} antes`} selected={d.alarm === m} onPress={() => set({ alarm: m })} compact />
                ))}
              </Row>
            ) : null}
          </View>

          <SectionLabel right={subs.length ? <Txt variant="small" tone="muted">{subs.filter((x) => x.done).length}/{subs.length}</Txt> : undefined}>
            Etapas
          </SectionLabel>
          <View style={[styles.subBox, { backgroundColor: p.surface, borderColor: p.border }]}>
            {subs.map((sub, i) => (
              <Row key={sub.id} style={[styles.subRow, i > 0 && { borderTopWidth: 1, borderTopColor: p.border }]}>
                <Tap
                  onPress={() => set({ subtasks: subs.map((x) => (x.id === sub.id ? { ...x, done: !x.done } : x)) })}
                  style={[styles.check, { borderColor: sub.done ? p.done : p.textFaint, backgroundColor: sub.done ? p.done : 'transparent' }]}
                  accessibilityLabel={sub.done ? 'Desmarcar etapa' : 'Marcar etapa'}
                >
                  {sub.done ? <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 13 }}>✓</Text> : null}
                </Tap>
                <TextInput
                  value={sub.title}
                  onChangeText={(title) => set({ subtasks: subs.map((x) => (x.id === sub.id ? { ...x, title } : x)) })}
                  style={[styles.subInput, { color: sub.done ? p.textMuted : p.text, textDecorationLine: sub.done ? 'line-through' : 'none' }]}
                />
                <Tap onPress={() => set({ subtasks: subs.filter((x) => x.id !== sub.id) })} hitSlop={8} style={{ padding: 6 }}>
                  <Text style={{ color: p.textFaint, fontSize: 14 }}>✕</Text>
                </Tap>
              </Row>
            ))}
            <Row style={[styles.subRow, subs.length > 0 && { borderTopWidth: 1, borderTopColor: p.border }]}>
              <Text style={{ color: p.accent, fontSize: 18, fontWeight: '800', width: 24, textAlign: 'center', marginRight: 10 }}>＋</Text>
              <TextInput
                value={newSub}
                onChangeText={setNewSub}
                onSubmitEditing={addSub}
                placeholder="Adicionar etapa (ex.: pesquisa, código, relatório)"
                placeholderTextColor={p.textFaint}
                returnKeyType="done"
                blurOnSubmit={false}
                style={[styles.subInput, { color: p.text }]}
              />
              {newSub.trim() ? (
                <Tap onPress={addSub} style={[styles.subAdd, { backgroundColor: p.accent }]}>
                  <Text style={{ color: p.onAccent, fontWeight: '800', fontSize: 12 }}>OK</Text>
                </Tap>
              ) : null}
            </Row>
          </View>

          <SectionLabel>Repetir</SectionLabel>
          <Row style={{ flexWrap: 'wrap' }}>
            {REPEAT_OPTIONS.map((o) => (
              <Chip
                key={o.key}
                emoji={o.emoji}
                label={o.label}
                compact
                selected={(d.repeat?.freq ?? 'nao') === o.key}
                onPress={() => setRepeat(o.key)}
              />
            ))}
          </Row>
          {d.repeat?.freq === 'semanal' ? (
            <Row style={{ marginBottom: 6 }}>
              {WEEK_LETTERS.map((l, w) => {
                const on = d.repeat?.days?.includes(w);
                return (
                  <Tap
                    key={w}
                    onPress={() => toggleWeekday(w)}
                    style={[styles.weekday, { backgroundColor: on ? p.accent : p.surface, borderColor: on ? p.accent : p.border }]}
                  >
                    <Text style={{ color: on ? p.onAccent : p.textMuted, fontWeight: '800' }}>{l}</Text>
                  </Tap>
                );
              })}
            </Row>
          ) : null}
          {d.repeat ? (
            <Txt variant="small" tone="faint">
              🔁 {describeRepeat(d.repeat)}. As próximas ocorrências aparecem na agenda com as mesmas configurações.
            </Txt>
          ) : null}

          <SectionLabel>Notas</SectionLabel>
          <TextInput
            value={d.notes ?? ''}
            onChangeText={(notes) => set({ notes })}
            placeholder="Detalhes, links, sala…"
            placeholderTextColor={p.textFaint}
            multiline
            style={[styles.notes, { color: p.text, backgroundColor: p.surface, borderColor: p.border }]}
          />

          {cs && course && d.source !== 'feed' ? (
            <View style={[styles.feedBox, { backgroundColor: alpha(cs.color, 0.12) }]}>
              <Txt variant="small" style={{ color: cs.color }}>{cs.emoji} {course}</Txt>
            </View>
          ) : null}
          {d.submitted ? (
            <View style={[styles.feedBox, { backgroundColor: alpha(p.done, 0.14) }]}>
              <Txt variant="small" style={{ color: p.done, fontWeight: '700' }}>📤 Entrega confirmada pelo Canvas</Txt>
            </View>
          ) : null}
          {d.source === 'feed' ? (
            <View style={[styles.feedBox, { backgroundColor: p.surfaceAlt }]}>
              {cs && course ? <Txt variant="subtitle" style={{ color: cs.color, marginBottom: 4 }}>{cs.emoji} {course}</Txt> : null}
              <Txt variant="small" tone="muted">
                🔗 Importada de {d.feedName ?? 'um calendário'}. Título e data são atualizados automaticamente; status, importância e lembretes ficam como você escolher.
              </Txt>
              {d.url ? <Button label="Abrir no Canvas" emoji="🎓" kind="soft" onPress={() => Linking.openURL(d.url as string)} style={{ marginTop: 10 }} /> : null}
            </View>
          ) : null}

          {!isNew && onFocus && d.status !== 'concluida' ? (
            <Button
              label={d.focusMinutes ? `Focar nesta tarefa · ${formatMinutes(d.focusMinutes)} até agora` : 'Focar nesta tarefa (Pomodoro)'}
              emoji="⏱️"
              kind="soft"
              onPress={onFocus}
              style={{ marginTop: 22 }}
            />
          ) : null}
          {!isNew && onDelete ? <Button label="Excluir tarefa" emoji="🗑️" kind="danger" onPress={confirmDelete} style={{ marginTop: 12 }} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  save: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
  titleBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, padding: 14 },
  titleInput: { flex: 1, fontSize: 20, fontWeight: '700', padding: 0 },
  emojiChoice: { width: 60, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', marginRight: 8 },
  field: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  customBox: { borderWidth: 1, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  numInput: { width: 64, borderWidth: 1, borderRadius: 12, fontSize: 20, fontWeight: '800', textAlign: 'center', paddingVertical: 8 },
  alarmBox: { borderWidth: 1.5, borderRadius: radius.lg, padding: 14 },
  notes: { minHeight: 90, borderWidth: 1, borderRadius: radius.md, padding: 14, fontSize: 15, textAlignVertical: 'top' },
  feedBox: { borderRadius: radius.md, padding: 14, marginTop: 18 },
  subBox: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12 },
  subRow: { paddingVertical: 8 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  subInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  subAdd: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginLeft: 6 },
  weekday: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
});
