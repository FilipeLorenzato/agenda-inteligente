import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, Row, SectionLabel, Tap, Txt } from '../components/ui';
import { formatCountdown, formatOffset, withTime } from '../lib/dates';
import { newId } from '../lib/logic';
import { REMINDER_PRESETS } from '../lib/meta';
import { fetchFeed } from '../services/feeds';
import { sendTestNotification } from '../services/notifications';
import { pickTime } from '../services/pickers';
import { useStore } from '../state/store';
import { alpha, radius, useTheme } from '../theme';
import type { ThemeMode } from '../types';

export function SettingsScreen({ notify }: { notify(msg: string): void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, syncNow, syncing, tasks, notificationsAllowed, askNotifications } = useStore();
  const [feedName, setFeedName] = useState('Canvas PUC Minas');
  const [feedUrl, setFeedUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [feedMsg, setFeedMsg] = useState('');

  const toggleDefault = (m: number) => {
    const has = settings.defaultReminders.includes(m);
    updateSettings({
      defaultReminders: has ? settings.defaultReminders.filter((x) => x !== m) : [...settings.defaultReminders, m].sort((a, b) => b - a),
    });
  };

  const connect = async () => {
    if (!feedUrl.trim()) return;
    setChecking(true);
    setFeedMsg('');
    try {
      const events = await fetchFeed({ url: feedUrl });
      updateSettings({
        feeds: [...settings.feeds, { id: newId(), name: feedName.trim() || 'Calendário', url: feedUrl.trim(), emoji: '🎓' }],
      });
      setFeedUrl('');
      const r = await syncNow();
      setFeedMsg(`✅ Conectado! ${events.length} eventos no feed · ${r?.added ?? 0} tarefas novas.`);
      notify('Calendário conectado 🎓');
    } catch (e) {
      setFeedMsg(`⚠️ ${e instanceof Error ? e.message : 'Não foi possível ler o link'}`);
    } finally {
      setChecking(false);
    }
  };

  const runSync = async () => {
    const r = await syncNow();
    if (!r) return;
    notify(r.errors.length ? `⚠️ ${r.errors[0]}` : `🔄 ${r.added} novas · ${r.updated} atualizadas`);
  };

  const removeFeed = (id: string, name: string) => {
    Alert.alert(`Desconectar ${name}?`, 'As tarefas já importadas continuam na agenda.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: () => updateSettings({ feeds: settings.feeds.filter((f) => f.id !== id) }) },
    ]);
  };

  const themes: { key: ThemeMode; label: string; emoji: string }[] = [
    { key: 'sistema', label: 'Automático', emoji: '📱' },
    { key: 'claro', label: 'Claro', emoji: '☀️' },
    { key: 'escuro', label: 'Noturno', emoji: '🌙' },
  ];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 150 }}
      keyboardShouldPersistTaps="handled"
    >
      <Txt variant="label" tone="faint">Do seu jeito</Txt>
      <Txt variant="display" style={{ marginTop: 4 }}>Ajustes ⚙️</Txt>

      {/* ---------------- Canvas / calendários ---------------- */}
      <SectionLabel
        right={
          settings.feeds.length ? (
            <Tap onPress={runSync} style={[styles.smallBtn, { backgroundColor: p.accentSoft }]}>
              {syncing ? <ActivityIndicator size="small" color={p.accent} /> : <Text style={{ color: p.accent, fontWeight: '800', fontSize: 12 }}>🔄 Sincronizar</Text>}
            </Tap>
          ) : undefined
        }
      >
        Canvas e outros calendários
      </SectionLabel>

      {settings.feeds.map((f) => (
        <Card key={f.id} style={{ marginBottom: 10, paddingVertical: 14 }}>
          <Row>
            <Text style={{ fontSize: 26, marginRight: 12 }}>{f.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Txt variant="subtitle">{f.name}</Txt>
              <Txt variant="small" tone={f.lastError ? 'urgent' : 'muted'} numberOfLines={2}>
                {f.lastError
                  ? `⚠️ ${f.lastError}`
                  : f.lastSync
                    ? `Sincronizado ${formatCountdown(new Date(f.lastSync))} · ${tasks.filter((t) => t.externalId?.startsWith(`${f.id}:`)).length} tarefas`
                    : 'Aguardando primeira sincronização'}
              </Txt>
            </View>
            <Tap onPress={() => removeFeed(f.id, f.name)} hitSlop={10} style={{ padding: 6 }}>
              <Text style={{ fontSize: 16 }}>🗑️</Text>
            </Tap>
          </Row>
        </Card>
      ))}

      <Card>
        <Txt variant="subtitle">＋ Conectar um calendário</Txt>
        <Txt variant="small" tone="muted" style={{ marginTop: 4 }}>
          No Canvas (pelo navegador): Calendário → “Feed do calendário” (canto inferior direito) → copie o link e cole aqui. Também funciona com o endereço iCal secreto do Google Agenda.
        </Txt>
        <TextInput
          value={feedName}
          onChangeText={setFeedName}
          placeholder="Nome (ex.: Canvas PUC Minas)"
          placeholderTextColor={p.textFaint}
          style={[styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.bg }]}
        />
        <TextInput
          value={feedUrl}
          onChangeText={setFeedUrl}
          placeholder="https://pucminas.instructure.com/feeds/calendars/user_….ics"
          placeholderTextColor={p.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.bg }]}
        />
        {feedMsg ? (
          <Txt variant="small" style={{ marginTop: 8, color: feedMsg.startsWith('✅') ? p.done : p.urgent }}>
            {feedMsg}
          </Txt>
        ) : null}
        <Button
          label={checking ? 'Verificando…' : 'Conectar e importar'}
          emoji="🎓"
          onPress={connect}
          disabled={checking || !feedUrl.trim()}
          style={{ marginTop: 12 }}
        />
        <Row style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Txt variant="small" style={{ fontWeight: '700' }}>Sincronizar automaticamente</Txt>
            <Txt variant="tiny" tone="faint">Ao abrir o app e a cada ~6 h em segundo plano</Txt>
          </View>
          <Switch value={settings.autoSync} onValueChange={(v) => updateSettings({ autoSync: v })} trackColor={{ true: p.accent, false: p.border }} thumbColor={p.surface} />
        </Row>
      </Card>

      {/* ---------------- Notificações ---------------- */}
      <SectionLabel>Notificações</SectionLabel>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="subtitle">{notificationsAllowed ? '🔔 Ativadas' : '🔕 Desativadas'}</Txt>
          {!notificationsAllowed ? <Button label="Ativar" kind="soft" onPress={askNotifications} style={{ paddingVertical: 8 }} /> : null}
        </Row>

        <Txt variant="small" style={{ fontWeight: '700', marginTop: 16, marginBottom: 8 }}>
          Lembretes padrão para tarefas novas
        </Txt>
        <Row style={{ flexWrap: 'wrap' }}>
          {REMINDER_PRESETS.map((m) => (
            <Chip key={m} label={formatOffset(m)} selected={settings.defaultReminders.includes(m)} onPress={() => toggleDefault(m)} compact />
          ))}
        </Row>
        <Txt variant="tiny" tone="faint">Cada tarefa pode ter os seus próprios lembretes na tela de edição.</Txt>

        <Tap
          onPress={async () => {
            const t = await pickTime(withTime(new Date(), settings.allDayTime));
            if (t) updateSettings({ allDayTime: t });
          }}
          style={[styles.rowBtn, { borderColor: p.border }]}
        >
          <View style={{ flex: 1 }}>
            <Txt variant="small" style={{ fontWeight: '700' }}>☀️ Horário das tarefas de dia inteiro</Txt>
            <Txt variant="tiny" tone="faint">Usado para calcular os lembretes delas</Txt>
          </View>
          <Txt variant="subtitle" tone="accent">{settings.allDayTime}</Txt>
        </Tap>

        <Row style={[styles.rowBtn, { borderColor: p.border }]}>
          <View style={{ flex: 1 }}>
            <Txt variant="small" style={{ fontWeight: '700' }}>📋 Resumo do dia</Txt>
            <Txt variant="tiny" tone="faint">Uma notificação com as tarefas de hoje</Txt>
          </View>
          {settings.dailyDigest ? (
            <Tap
              onPress={async () => {
                const t = await pickTime(withTime(new Date(), settings.dailyDigestTime));
                if (t) updateSettings({ dailyDigestTime: t });
              }}
              style={{ marginRight: 10 }}
            >
              <Txt variant="subtitle" tone="accent">{settings.dailyDigestTime}</Txt>
            </Tap>
          ) : null}
          <Switch value={settings.dailyDigest} onValueChange={(v) => updateSettings({ dailyDigest: v })} trackColor={{ true: p.accent, false: p.border }} thumbColor={p.surface} />
        </Row>

        <Row style={{ marginTop: 16 }}>
          <Button
            label="Testar lembrete"
            emoji="🔔"
            kind="soft"
            style={{ flex: 1, marginRight: 8 }}
            onPress={() => sendTestNotification('lembrete').then(() => notify('Chega em 5 segundos…'))}
          />
          <Button
            label="Testar alarme"
            emoji="⏰"
            kind="soft"
            style={{ flex: 1 }}
            onPress={() => sendTestNotification('alarme').then(() => notify('Toca em 5 segundos…'))}
          />
        </Row>
        <View style={[styles.tip, { backgroundColor: alpha(p.high, 0.12) }]}>
          <Txt variant="small" tone="muted">
            💡 Para os avisos chegarem na hora certa, deixe a bateria do app sem restrições: Configurações → Apps → Agenda Inteligente → Bateria → “Sem restrições”.
          </Txt>
          <Button label="Abrir configurações do app" kind="ghost" onPress={() => Linking.openSettings()} style={{ paddingVertical: 8, marginTop: 4 }} />
        </View>
      </Card>

      {/* ---------------- Aparência ---------------- */}
      <SectionLabel>Aparência</SectionLabel>
      <Row style={{ flexWrap: 'wrap' }}>
        {themes.map((t) => (
          <Chip key={t.key} emoji={t.emoji} label={t.label} selected={settings.theme === t.key} onPress={() => updateSettings({ theme: t.key })} />
        ))}
      </Row>

      <Txt variant="tiny" tone="faint" style={{ textAlign: 'center', marginTop: 28 }}>
        Agenda Inteligente 1.0 · {tasks.length} tarefas salvas no celular
      </Txt>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, minWidth: 40, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: radius.sm + 2, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginTop: 10 },
  rowBtn: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 14, marginTop: 14 },
  tip: { borderRadius: radius.md, padding: 12, marginTop: 14 },
});
