import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FocusPill, FocusTimer } from './src/components/FocusTimer';
import { QuickAdd } from './src/components/QuickAdd';
import { TaskEditor } from './src/components/TaskEditor';
import { Button, Row, Tap, Txt } from './src/components/ui';
import { toKey } from './src/lib/dates';
import { ACTION_DONE, ACTION_SNOOZE, snooze } from './src/services/notifications';
import { AgendaScreen } from './src/screens/AgendaScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { UpcomingScreen } from './src/screens/UpcomingScreen';
import { StoreProvider, useStore } from './src/state/store';
import { alpha, dark, light, radius, ThemeContext, useTheme } from './src/theme';
import type { Task, TaskDraft } from './src/types';

type Tab = 'agenda' | 'proximas' | 'ajustes';

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Themed />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Themed() {
  const { settings } = useStore();
  const scheme = useColorScheme();
  const isDark = settings.theme === 'escuro' || (settings.theme === 'sistema' && scheme === 'dark');
  const palette = isDark ? dark : light;
  return (
    <ThemeContext.Provider value={palette}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Main />
    </ThemeContext.Provider>
  );
}

function Main() {
  const p = useTheme();
  const store = useStore();
  const { tasks, settings, addTask, updateTask, deleteTask, setStatus, updateSettings, askNotifications } = store;
  const [tab, setTab] = useState<Tab>('agenda');
  const [selected, setSelected] = useState(toKey(new Date()));
  const [editor, setEditor] = useState<{ draft: TaskDraft; id?: string } | null>(null);
  const [quick, setQuick] = useState<{ mode: 'voz' | 'texto' } | null>(null);
  const [focus, setFocus] = useState<{ taskId?: string } | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const openTask = useCallback((t: Task) => {
    const { id, createdAt, updatedAt, ...draft } = t;
    void createdAt;
    void updatedAt;
    setEditor({ draft, id });
  }, []);

  const newOnDay = useCallback(
    (key: string) => {
      setEditor({
        draft: {
          title: '',
          date: key,
          time: undefined,
          priority: 'media',
          emoji: '🗓️',
          status: 'pendente',
          reminders: [...settings.defaultReminders],
          alarm: null,
          source: 'manual',
        },
      });
    },
    [settings.defaultReminders],
  );

  // ---------- Toques nas notificações (Concluir / Adiar / abrir) ----------
  const latest = useRef({ tasks, setStatus, openTask, notify });
  latest.current = { tasks, setStatus, openTask, notify };
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const handle = (resp: Notifications.NotificationResponse) => {
      const req = resp.notification.request;
      const key = `${req.identifier}:${resp.actionIdentifier}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      const data = (req.content.data ?? {}) as { taskId?: string | null };
      const task = data.taskId ? latest.current.tasks.find((t) => t.id === data.taskId) : undefined;
      if (resp.actionIdentifier === ACTION_DONE && task) {
        latest.current.setStatus(task.id, 'concluida');
        latest.current.notify(`✅ “${task.title}” concluída`);
      } else if (resp.actionIdentifier === ACTION_SNOOZE) {
        snooze(req.content).then(() => latest.current.notify('😴 Adiado por 10 minutos'));
      } else if (task) {
        setTab('agenda');
        setSelected(task.date);
        latest.current.openTask(task);
      }
      Notifications.dismissNotificationAsync(req.identifier).catch(() => undefined);
      Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };
    Notifications.getLastNotificationResponseAsync()
      .then((r) => r && handle(r))
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);

  // ---------- Links do widget e dos atalhos do ícone (agenda://...) ----------
  useEffect(() => {
    const open = (url: string | null) => {
      if (!url) return;
      const m = /^agenda:\/\/([^?#]*)(?:\?(.*))?/.exec(url);
      if (!m) return;
      const path = m[1].replace(/\/+$/, '');
      const query = new URLSearchParams(m[2] ?? '');
      if (path === 'nova') {
        setEditor(null);
        setQuick({ mode: query.get('modo') === 'texto' ? 'texto' : 'voz' });
      } else if (path === 'proximas') {
        setQuick(null);
        setTab('proximas');
      } else if (path.startsWith('tarefa/')) {
        const task = latest.current.tasks.find((t) => t.id === path.slice('tarefa/'.length));
        setTab('agenda');
        if (task) {
          setSelected(task.date);
          latest.current.openTask(task);
        }
      }
    };
    Linking.getInitialURL().then(open).catch(() => undefined);
    const sub = Linking.addEventListener('url', (e) => open(e.url));
    return () => sub.remove();
  }, []);

  const saveEditor = (draft: TaskDraft) => {
    if (!editor) return;
    if (editor.id) {
      const original = tasks.find((t) => t.id === editor.id);
      if (original?.seriesId) {
        Alert.alert('Tarefa que se repete', 'Aplicar as mudanças só nesta ou também nas próximas?', [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Só nesta',
            onPress: () => {
              updateTask(editor.id as string, draft, 'esta');
              setEditor(null);
              notify('Tarefa atualizada ✨');
            },
          },
          {
            text: 'Nas próximas também',
            onPress: () => {
              updateTask(editor.id as string, draft, 'proximas');
              setEditor(null);
              notify('Série atualizada 🔁');
            },
          },
        ]);
        return;
      }
      updateTask(editor.id, draft);
      notify('Tarefa atualizada ✨');
    } else {
      addTask(draft);
      setSelected(draft.date);
      notify('Tarefa adicionada ✓');
    }
    setEditor(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {tab === 'agenda' ? (
        <AgendaScreen selected={selected} onSelect={setSelected} onOpenTask={openTask} onNewOnDay={newOnDay} />
      ) : tab === 'proximas' ? (
        <UpcomingScreen onOpenTask={openTask} notify={notify} />
      ) : (
        <SettingsScreen notify={notify} onOpenFocus={() => setFocus({})} />
      )}

      {!focus ? <FocusPill onPress={() => setFocus({ taskId: settings.activeFocus?.taskId })} /> : null}

      <TabBar
        tab={tab}
        onTab={setTab}
        onMic={() => setQuick({ mode: 'voz' })}
        onPlus={() => setQuick({ mode: 'texto' })}
      />

      {toast ? (
        <View pointerEvents="none" style={[styles.toast, { backgroundColor: p.text }]}>
          <Text style={{ color: p.bg, fontWeight: '700' }}>{toast}</Text>
        </View>
      ) : null}

      <QuickAdd
        visible={!!quick}
        mode={quick?.mode ?? 'voz'}
        defaultReminders={settings.defaultReminders}
        onClose={() => setQuick(null)}
        onAdd={(draft) => {
          addTask(draft);
          setQuick(null);
          setSelected(draft.date);
          notify(`${draft.emoji} Adicionada: ${draft.title}`);
        }}
        onMoreDetails={(draft) => {
          setQuick(null);
          setEditor({ draft });
        }}
      />

      <TaskEditor
        visible={!!editor}
        initial={editor?.draft ?? null}
        isNew={!editor?.id}
        onClose={() => setEditor(null)}
        onSave={saveEditor}
        onDelete={
          editor?.id
            ? (scope) => {
                deleteTask(editor.id as string, scope);
                setEditor(null);
                notify(scope === 'proximas' ? 'Série encerrada 🗑️' : 'Tarefa excluída 🗑️');
              }
            : undefined
        }
        onFocus={
          editor?.id
            ? () => {
                const id = editor.id as string;
                setEditor(null);
                setFocus({ taskId: id });
              }
            : undefined
        }
      />

      {/* sempre montado: o relógio do foco continua rodando com a janela fechada */}
      <FocusTimer visible={!!focus} taskId={focus?.taskId} onClose={() => setFocus(null)} />

      <Onboarding
        visible={!settings.onboarded}
        onEnableNotifications={askNotifications}
        onDone={(goSettings) => {
          updateSettings({ onboarded: true });
          if (goSettings) setTab('ajustes');
        }}
      />
    </View>
  );
}

function TabBar({ tab, onTab, onMic, onPlus }: { tab: Tab; onTab(t: Tab): void; onMic(): void; onPlus(): void }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const item = (key: Tab, emoji: string, label: string) => {
    const active = tab === key;
    return (
      <Tap key={key} onPress={() => onTab(key)} style={styles.tabItem} accessibilityLabel={label}>
        <View style={[styles.tabIcon, active && { backgroundColor: p.accentSoft }]}>
          <Text style={{ fontSize: 19, opacity: active ? 1 : 0.6 }}>{emoji}</Text>
        </View>
        <Txt variant="tiny" style={{ color: active ? p.accent : p.textFaint, marginTop: 2 }}>
          {label}
        </Txt>
      </Tap>
    );
  };
  return (
    <View style={[styles.tabWrap, { paddingBottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={[styles.tabBar, { backgroundColor: p.surface, borderColor: p.border, shadowColor: p.shadow }]}>
        {item('agenda', '🗓️', 'Agenda')}
        {item('proximas', '🔔', 'Próximas')}
        <View style={styles.tabItem}>
          <Tap onPress={onMic} style={[styles.mic, { backgroundColor: p.accent, shadowColor: p.accent, borderColor: p.bg }]} accessibilityLabel="Adicionar por voz">
            <Text style={{ fontSize: 26 }}>🎙️</Text>
          </Tap>
        </View>
        <Tap onPress={onPlus} style={styles.tabItem} accessibilityLabel="Adicionar digitando">
          <View style={styles.tabIcon}>
            <Text style={{ fontSize: 22, color: p.accent, fontWeight: '800' }}>＋</Text>
          </View>
          <Txt variant="tiny" style={{ color: p.textFaint, marginTop: 2 }}>Nova</Txt>
        </Tap>
        {item('ajustes', '⚙️', 'Ajustes')}
      </View>
    </View>
  );
}

function Onboarding({
  visible,
  onEnableNotifications,
  onDone,
}: {
  visible: boolean;
  onEnableNotifications(): Promise<boolean>;
  onDone(goSettings: boolean): void;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(false);
  const features = [
    ['🎙️', 'Fale e pronto', '“Prova de SO sexta às 14h, urgente” vira tarefa organizada.'],
    ['🎓', 'Canvas integrado', 'Seus prazos da PUC entram sozinhos na agenda.'],
    ['🔔', 'Avisos no seu tempo', '1 semana antes, 1 dia antes, na hora — você escolhe. E alarme ⏰ se quiser.'],
    ['🔥', 'Importância à vista', 'Emojis e cores mostram o que é urgente de longe.'],
  ];
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.onb, { backgroundColor: p.bg, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.onbHero, { backgroundColor: p.accent }]}>
          <Text style={{ fontSize: 46 }}>🗓️</Text>
        </View>
        <Txt variant="display" style={{ textAlign: 'center', marginTop: 18 }}>
          Sua agenda,{'\n'}sem esforço.
        </Txt>
        <View style={{ marginTop: 26 }}>
          {features.map(([e, t, d]) => (
            <Row key={t} style={{ alignItems: 'flex-start', marginBottom: 16 }}>
              <View style={[styles.onbIcon, { backgroundColor: alpha(p.accent, 0.12) }]}>
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="subtitle">{t}</Txt>
                <Txt variant="small" tone="muted">{d}</Txt>
              </View>
            </Row>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <Button
          label={enabled ? 'Notificações ativadas ✓' : 'Ativar notificações'}
          emoji="🔔"
          kind={enabled ? 'soft' : 'primary'}
          onPress={async () => setEnabled(await onEnableNotifications())}
        />
        <Button label="Conectar o Canvas agora" emoji="🎓" kind="soft" onPress={() => onDone(true)} style={{ marginTop: 10 }} />
        <Button label="Começar" kind="ghost" onPress={() => onDone(false)} style={{ marginTop: 4 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tabWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: 8,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { width: 44, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -34,
    borderWidth: 4,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 118,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.pill,
    maxWidth: '88%',
  },
  onb: { flex: 1, paddingHorizontal: 26 },
  onbHero: { width: 92, height: 92, borderRadius: 30, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  onbIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
});
