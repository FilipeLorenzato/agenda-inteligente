// Seções extras da tela de Ajustes: entregas do Canvas, disciplinas, blocos de estudo, foco e backup.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, Row, SectionLabel, Tap, Txt } from '../components/ui';
import { formatCountdown } from '../lib/dates';
import { cleanCourseName } from '../lib/ical';
import { focusStats, formatMinutes, listCourses } from '../lib/logic';
import { COURSE_COLORS, COURSE_EMOJIS, courseStyle, defaultCourseStyle } from '../lib/meta';
import { exportBackup, pickBackup } from '../services/backupFiles';
import { canvasBase, getCanvasToken, setCanvasToken, testCanvasToken } from '../services/canvasApi';
import { useStore } from '../state/store';
import { alpha, radius, useTheme } from '../theme';

type Notify = (msg: string) => void;

// ------------------------------------------------------------------
// Conferir entregas no Canvas (token opcional)
// ------------------------------------------------------------------
export function CanvasTokenCard({ notify }: { notify: Notify }) {
  const p = useTheme();
  const { settings, updateSettings, syncNow, tasks } = useStore();
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const base = canvasBase(settings.feeds);
  const submitted = tasks.filter((t) => t.submitted).length;

  useEffect(() => {
    getCanvasToken().then((t) => setHasToken(!!t));
  }, []);

  if (!settings.feeds.length || !base) return null;

  const save = async () => {
    if (!token.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const name = await testCanvasToken(base, token.trim());
      await setCanvasToken(token.trim());
      updateSettings({ canvasUser: name, lastSubmissionCheck: undefined });
      setHasToken(true);
      setToken('');
      const r = await syncNow();
      setMsg(`✅ Conectado como ${name}. ${r?.submitted ?? 0} entregas confirmadas.`);
      notify('📤 Entregas do Canvas conectadas');
    } catch (e) {
      setMsg(`⚠️ ${e instanceof Error ? e.message : 'Não foi possível usar o token'}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert('Remover token do Canvas?', 'O app deixa de conferir suas entregas. As tarefas continuam.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await setCanvasToken(null);
          updateSettings({ canvasUser: undefined, lastSubmissionCheck: undefined });
          setHasToken(false);
        },
      },
    ]);
  };

  return (
    <Card style={{ marginTop: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Txt variant="subtitle">📤 Saber o que já entreguei</Txt>
          <Txt variant="small" tone="muted" style={{ marginTop: 2 }}>
            {hasToken
              ? `Ativo${settings.canvasUser ? ` · ${settings.canvasUser}` : ''} · ${submitted} entregas confirmadas${settings.lastSubmissionCheck ? ` · conferido ${formatCountdown(new Date(settings.lastSubmissionCheck))}` : ''}`
              : 'Opcional: com um token do Canvas, o app marca ✅ sozinho o que você já entregou.'}
          </Txt>
        </View>
        {hasToken === null ? <ActivityIndicator color={p.accent} /> : null}
      </Row>

      {hasToken ? (
        <Row style={{ marginTop: 12 }}>
          <Button label="Conferir agora" emoji="🔄" kind="soft" onPress={() => syncNow().then((r) => notify(`📤 ${r?.submitted ?? 0} novas entregas confirmadas`))} style={{ flex: 1, marginRight: 8 }} />
          <Button label="Remover" kind="ghost" onPress={remove} style={{ flex: 0.7 }} />
        </Row>
      ) : hasToken === false ? (
        <>
          {!open ? (
            <Button label="Configurar" emoji="🔑" kind="soft" onPress={() => setOpen(true)} style={{ marginTop: 12 }} />
          ) : (
            <View style={{ marginTop: 10 }}>
              <Txt variant="small" tone="muted">
                1. No Canvas pelo navegador: Conta → Configurações.{'\n'}2. Em “Integrações aprovadas”, toque em “+ Novo token de acesso”.{'\n'}3. Dê um nome (ex.: Agenda), gere e copie o token.{'\n'}4. Cole aqui. Ele fica guardado com segurança só no seu celular.
              </Txt>
              <Button label="Abrir configurações do Canvas" kind="ghost" onPress={() => Linking.openURL(`${base}/profile/settings`)} style={{ paddingVertical: 8 }} />
              <TextInput
                value={token}
                onChangeText={setToken}
                placeholder="Cole o token aqui"
                placeholderTextColor={p.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                style={[styles.input, { color: p.text, borderColor: p.border, backgroundColor: p.bg }]}
              />
              <Button label={busy ? 'Verificando…' : 'Salvar e conferir'} emoji="📤" onPress={save} disabled={busy || !token.trim()} style={{ marginTop: 10 }} />
              <Txt variant="tiny" tone="faint" style={{ marginTop: 8 }}>
                Se o Canvas não mostrar a opção de token, a PUC desativou esse recurso para alunos — o resto do app funciona normalmente.
              </Txt>
            </View>
          )}
        </>
      ) : null}
      {msg ? (
        <Txt variant="small" style={{ marginTop: 8, color: msg.startsWith('✅') ? p.done : p.urgent }}>
          {msg}
        </Txt>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------------
// Disciplinas: emoji e cor
// ------------------------------------------------------------------
export function CoursesSection() {
  const p = useTheme();
  const { tasks, settings, updateSettings } = useStore();
  const courses = useMemo(() => listCourses(tasks), [tasks]);
  const [editing, setEditing] = useState<string | null>(null);
  if (!courses.length) return null;

  const setStyle = (course: string, patch: { emoji?: string; color?: string }) => {
    const cur = courseStyle(course, settings.courseStyles);
    updateSettings({ courseStyles: { ...settings.courseStyles, [course]: { ...cur, ...patch } } });
  };

  return (
    <>
      <SectionLabel>Disciplinas</SectionLabel>
      <Card style={{ paddingVertical: 6 }}>
        {courses.map((c, i) => {
          const cs = courseStyle(c, settings.courseStyles);
          const open = editing === c;
          const count = tasks.filter((t) => cleanCourseName(t.course) === c && t.status !== 'concluida').length;
          return (
            <View key={c} style={[i > 0 && { borderTopWidth: 1, borderTopColor: p.border }]}>
              <Tap onPress={() => setEditing(open ? null : c)} style={styles.courseRow}>
                <View style={[styles.courseIcon, { backgroundColor: alpha(cs.color, 0.16) }]}>
                  <Text style={{ fontSize: 18 }}>{cs.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="body" numberOfLines={1} style={{ fontWeight: '700' }}>{c}</Txt>
                  <Txt variant="tiny" tone="faint">{count ? `${count} ${count === 1 ? 'tarefa aberta' : 'tarefas abertas'}` : 'Tudo em dia'}</Txt>
                </View>
                <View style={[styles.swatch, { backgroundColor: cs.color }]} />
                <Txt variant="small" tone="faint" style={{ marginLeft: 8 }}>{open ? '▴' : '▾'}</Txt>
              </Tap>
              {open ? (
                <View style={{ paddingBottom: 12 }}>
                  <Txt variant="tiny" tone="faint" style={{ marginBottom: 6 }}>EMOJI</Txt>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {Array.from(new Set([defaultCourseStyle(c).emoji, ...COURSE_EMOJIS])).map((e) => (
                      <Tap
                        key={e}
                        onPress={() => setStyle(c, { emoji: e })}
                        style={[styles.emojiBtn, { borderColor: cs.emoji === e ? cs.color : p.border, backgroundColor: cs.emoji === e ? alpha(cs.color, 0.14) : p.surface }]}
                      >
                        <Text style={{ fontSize: 18 }}>{e}</Text>
                      </Tap>
                    ))}
                  </Row>
                  <Txt variant="tiny" tone="faint" style={{ marginTop: 8, marginBottom: 6 }}>COR</Txt>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {COURSE_COLORS.map((col) => (
                      <Tap key={col} onPress={() => setStyle(c, { color: col })} style={[styles.colorBtn, { backgroundColor: col, borderColor: cs.color === col ? p.text : 'transparent' }]}>
                        {cs.color === col ? <Text style={{ color: '#FFF', fontWeight: '900' }}>✓</Text> : null}
                      </Tap>
                    ))}
                  </Row>
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>
      <Txt variant="tiny" tone="faint" style={{ marginTop: 6 }}>
        Toque numa disciplina para mudar emoji e cor. Use os chips no topo da Agenda para filtrar por disciplina.
      </Txt>
    </>
  );
}

// ------------------------------------------------------------------
// Blocos de estudo antes das provas
// ------------------------------------------------------------------
export function StudySection() {
  const p = useTheme();
  const { settings, updateSettings, syncNow } = useStore();
  return (
    <>
      <SectionLabel>Blocos de estudo</SectionLabel>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Txt variant="subtitle">📖 Estudar antes das provas</Txt>
            <Txt variant="small" tone="muted">Quando uma prova entra pelo Canvas, o app cria “Estudar para…” com etapas de revisão.</Txt>
          </View>
          <Switch
            value={settings.studyBlocks}
            onValueChange={(v) => {
              updateSettings({ studyBlocks: v });
              if (v) setTimeout(() => syncNow(), 300);
            }}
            trackColor={{ true: p.accent, false: p.border }}
            thumbColor={p.surface}
          />
        </Row>
        {settings.studyBlocks ? (
          <>
            <Txt variant="small" style={{ fontWeight: '700', marginTop: 14, marginBottom: 8 }}>Quantos dias antes?</Txt>
            <Row style={{ flexWrap: 'wrap' }}>
              {[1, 2, 3, 5, 7].map((n) => (
                <Chip key={n} label={n === 1 ? '1 dia' : `${n} dias`} compact selected={settings.studyDaysBefore === n} onPress={() => updateSettings({ studyDaysBefore: n })} />
              ))}
            </Row>
          </>
        ) : null}
      </Card>
    </>
  );
}

// ------------------------------------------------------------------
// Foco (Pomodoro) e tempo de estudo
// ------------------------------------------------------------------
export function FocusSection({ onOpenFocus }: { onOpenFocus(): void }) {
  const p = useTheme();
  const { settings, updateSettings } = useStore();
  const stats = focusStats(settings.focusLog);
  const max = Math.max(1, ...stats.byCourse.map((c) => c.minutes));
  return (
    <>
      <SectionLabel>Foco e tempo de estudo</SectionLabel>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Txt variant="tiny" tone="faint">ESTA SEMANA</Txt>
            <Txt variant="title">{formatMinutes(stats.week)}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="tiny" tone="faint">HOJE</Txt>
            <Txt variant="title">{formatMinutes(stats.today)}</Txt>
          </View>
        </Row>
        {stats.byCourse.length ? (
          <View style={{ marginTop: 12 }}>
            {stats.byCourse.slice(0, 6).map((c) => {
              const cs = c.course === 'Outras tarefas' ? { emoji: '🗂️', color: p.textFaint } : courseStyle(c.course, settings.courseStyles);
              return (
                <View key={c.course} style={{ marginBottom: 8 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>{cs.emoji} {c.course}</Txt>
                    <Txt variant="small" tone="muted">{formatMinutes(c.minutes)}</Txt>
                  </Row>
                  <View style={[styles.track, { backgroundColor: p.surfaceAlt }]}>
                    <View style={[styles.fill, { backgroundColor: cs.color, width: `${(c.minutes / max) * 100}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Txt variant="small" tone="muted" style={{ marginTop: 8 }}>
            Abra uma tarefa e toque em “⏱️ Focar nesta tarefa” para registrar seu tempo de estudo.
          </Txt>
        )}
        <Txt variant="small" style={{ fontWeight: '700', marginTop: 10, marginBottom: 8 }}>Duração do foco</Txt>
        <Row style={{ flexWrap: 'wrap' }}>
          {(
            [
              [25, 5],
              [50, 10],
              [15, 3],
            ] as [number, number][]
          ).map(([f, b]) => (
            <Chip key={f} label={`${f} min + ${b} pausa`} compact selected={settings.focusMinutes === f && settings.breakMinutes === b} onPress={() => updateSettings({ focusMinutes: f, breakMinutes: b })} />
          ))}
        </Row>
        <Button label="Foco livre (sem tarefa)" emoji="⏱️" kind="soft" onPress={onOpenFocus} style={{ marginTop: 4 }} />
      </Card>
    </>
  );
}

// ------------------------------------------------------------------
// Backup
// ------------------------------------------------------------------
export function BackupSection({ notify }: { notify: Notify }) {
  const { tasks, settings, restoreBackup } = useStore();
  const [busy, setBusy] = useState(false);

  const doExport = async () => {
    setBusy(true);
    try {
      await exportBackup(tasks, settings);
    } catch (e) {
      Alert.alert('Não foi possível exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    try {
      const b = await pickBackup();
      if (!b) return;
      const when = b.exportedAt ? new Date(b.exportedAt).toLocaleDateString('pt-BR') : 'data desconhecida';
      Alert.alert(`Restaurar backup de ${when}?`, `${b.tasks.length} tarefas no arquivo. Você tem ${tasks.length} agora.`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Juntar',
          onPress: () => {
            restoreBackup(b.tasks, b.settings, 'juntar');
            notify('📥 Backup juntado à agenda');
          },
        },
        {
          text: 'Substituir tudo',
          style: 'destructive',
          onPress: () => {
            restoreBackup(b.tasks, b.settings, 'substituir');
            notify('📥 Backup restaurado');
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Não foi possível restaurar', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <SectionLabel>Backup</SectionLabel>
      <Card>
        <Txt variant="subtitle">💾 Suas tarefas em segurança</Txt>
        <Txt variant="small" tone="muted" style={{ marginTop: 4 }}>
          Exporte um arquivo e salve no Google Drive, WhatsApp ou e-mail. Para trocar de celular, instale o app e toque em “Restaurar”.
        </Txt>
        <Row style={{ marginTop: 12 }}>
          <Button label={busy ? 'Gerando…' : 'Exportar'} emoji="📤" onPress={doExport} disabled={busy} style={{ flex: 1, marginRight: 8 }} />
          <Button label="Restaurar" emoji="📥" kind="soft" onPress={doImport} style={{ flex: 1 }} />
        </Row>
        <Txt variant="tiny" tone="faint" style={{ marginTop: 10 }}>
          O Android também guarda os dados do app no backup da sua conta Google (se estiver ativado no celular). O token do Canvas nunca vai para o backup.
        </Txt>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: radius.sm + 2, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginTop: 10 },
  courseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  courseIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  emojiBtn: { width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 6, marginBottom: 6 },
  colorBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 6 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  fill: { height: 6, borderRadius: 3 },
});
