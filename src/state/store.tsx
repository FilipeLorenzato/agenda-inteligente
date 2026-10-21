import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { mergeBackup } from '../lib/backup';
import { toKey } from '../lib/dates';
import { addFocus, endSeriesBefore, expandSeries, makeTask, markOverdueDone, startSeries, updateSeriesFrom } from '../lib/logic';
import { nextStatus } from '../lib/meta';
import { registerBackgroundSync } from '../services/background';
import { rescheduleAll, setupNotifications } from '../services/notifications';
import { refreshAll, RefreshResult } from '../services/pipeline';
import { loadSettings, loadTasks, saveSettings, saveTasks } from '../services/storage';
import type { Settings, Status, Task, TaskDraft } from '../types';
import { refreshWidget } from '../widget/update';

export type Scope = 'esta' | 'proximas';

interface Store {
  ready: boolean;
  tasks: Task[];
  settings: Settings;
  notificationsAllowed: boolean;
  syncing: boolean;
  /** Disciplina selecionada no filtro (null = todas) */
  courseFilter: string | null;
  setCourseFilter(c: string | null): void;
  addTask(draft: TaskDraft): Task;
  updateTask(id: string, patch: Partial<Task>, scope?: Scope): void;
  deleteTask(id: string, scope?: Scope): void;
  setStatus(id: string, status: Status): void;
  cycleStatus(id: string): void;
  toggleSubtask(taskId: string, subId: string): void;
  markOverdueDone(ids?: string[]): number;
  updateSettings(patch: Partial<Settings>): void;
  syncNow(): Promise<RefreshResult | null>;
  askNotifications(): Promise<boolean>;
  restoreBackup(tasks: Task[], settings: Settings, mode: 'substituir' | 'juntar'): void;
  logFocus(taskId: string | undefined, minutes: number): void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fora do StoreProvider');
  return s;
}

const AUTO_SYNC_EVERY = 60 * 60 * 1000; // 1 h ao abrir o app

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [notificationsAllowed, setAllowed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const tasksRef = useRef(tasks);
  const settingsRef = useRef(settings);
  tasksRef.current = tasks;
  settingsRef.current = settings;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Salva, atualiza o widget e reagenda as notificações (com um pequeno atraso para agrupar mudanças)
  const persist = useCallback((nextTasks: Task[] | null, nextSettings: Settings | null) => {
    if (nextTasks) {
      saveTasks(nextTasks).catch(() => undefined);
      refreshWidget(nextTasks);
    }
    if (nextSettings) saveSettings(nextSettings).catch(() => undefined);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const s = settingsRef.current;
      if (s) rescheduleAll(tasksRef.current, s).catch((e) => console.warn(e));
    }, 1200);
  }, []);

  const commitTasks = useCallback(
    (fn: (prev: Task[]) => Task[]) => {
      const next = fn(tasksRef.current);
      tasksRef.current = next;
      setTasks(next);
      persist(next, null);
    },
    [persist],
  );

  const commitSettings = useCallback(
    (patch: Partial<Settings>) => {
      const next = { ...(settingsRef.current as Settings), ...patch };
      settingsRef.current = next;
      setSettings(next);
      persist(null, next);
    },
    [persist],
  );

  const runRefresh = useCallback(
    async (sync: boolean, forceSubmissions = false): Promise<RefreshResult | null> => {
      const s = settingsRef.current;
      if (!s) return null;
      if (sync) setSyncing(true);
      try {
        const r = await refreshAll(tasksRef.current, s, { sync, forceSubmissions });
        tasksRef.current = r.tasks;
        settingsRef.current = r.settings;
        setTasks(r.tasks);
        setSettings(r.settings);
        persist(r.tasks, r.settings);
        return r;
      } finally {
        if (sync) setSyncing(false);
      }
    },
    [persist],
  );

  const reload = useCallback(async () => {
    const [t, s] = await Promise.all([loadTasks(), loadSettings()]);
    tasksRef.current = t;
    settingsRef.current = s;
    setTasks(t);
    setSettings(s);
    return s;
  }, []);

  const needsSync = (s: Settings) => {
    const last = Math.max(0, ...s.feeds.map((f) => f.lastSync ?? 0));
    return s.autoSync && s.feeds.length > 0 && Date.now() - last > AUTO_SYNC_EVERY;
  };

  // Inicialização
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await reload();
      if (!alive) return;
      setReady(true);
      const allowed = await setupNotifications(s.onboarded).catch(() => false);
      setAllowed(allowed);
      registerBackgroundSync();
      await runRefresh(needsSync(s)).catch(() => null);
    })();
    return () => {
      alive = false;
    };
  }, [reload, runRefresh]);

  // Ao voltar para o app: recarrega (a sincronização em segundo plano pode ter mudado algo)
  useEffect(() => {
    let lastDay = toKey(new Date());
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      reload().then((s) => {
        const today = toKey(new Date());
        if (needsSync(s) || today !== lastDay) runRefresh(needsSync(s)).catch(() => null);
        lastDay = today;
      });
    });
    return () => sub.remove();
  }, [reload, runRefresh]);

  const value = useMemo<Store | null>(() => {
    if (!settings) return null;
    return {
      ready,
      tasks,
      settings,
      notificationsAllowed,
      syncing,
      courseFilter,
      setCourseFilter,
      addTask(draft) {
        const t = startSeries(makeTask(draft));
        commitTasks((prev) => (t.repeat ? expandSeries([...prev, t]) : [...prev, t]));
        return t;
      },
      updateTask(id, patch, scope = 'esta') {
        commitTasks((prev) => {
          const cur = prev.find((t) => t.id === id);
          if (!cur) return prev;
          if (scope === 'proximas' && cur.seriesId) return updateSeriesFrom(prev, cur, patch);
          let next = prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t));
          // passou a repetir agora: inicia a série
          if (patch.repeat && !cur.seriesId) {
            next = expandSeries(next.map((t) => (t.id === id ? startSeries(t) : t)));
          }
          return next;
        });
      },
      deleteTask(id, scope = 'esta') {
        const cur = tasksRef.current.find((t) => t.id === id);
        if (!cur) return;
        if (cur.studyFor) {
          const s = settingsRef.current as Settings;
          commitSettings({ dismissedStudy: [...s.dismissedStudy, cur.studyFor] });
        }
        commitTasks((prev) => {
          if (scope === 'proximas' && cur.seriesId) return endSeriesBefore(prev, cur.seriesId, cur.date);
          // excluir só esta (numa série, as outras ocorrências continuam)
          return prev.filter((t) => t.id !== id);
        });
      },
      setStatus(id, status) {
        commitTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status, updatedAt: Date.now() } : t)));
      },
      cycleStatus(id) {
        commitTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus(t.status), updatedAt: Date.now() } : t)));
      },
      toggleSubtask(taskId, subId) {
        commitTasks((prev) =>
          prev.map((t) => {
            if (t.id !== taskId || !t.subtasks) return t;
            const subtasks = t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
            const all = subtasks.length > 0 && subtasks.every((s) => s.done);
            const status: Status = all ? 'concluida' : subtasks.some((s) => s.done) ? 'andamento' : t.status === 'concluida' ? 'andamento' : t.status;
            return { ...t, subtasks, status, updatedAt: Date.now() };
          }),
        );
      },
      markOverdueDone(ids) {
        const before = tasksRef.current.filter((t) => t.status !== 'concluida').length;
        const next = markOverdueDone(tasksRef.current, settingsRef.current as Settings, new Date(), ids ? new Set(ids) : undefined);
        const after = next.filter((t) => t.status !== 'concluida').length;
        commitTasks(() => next);
        return before - after;
      },
      updateSettings: commitSettings,
      syncNow: () => runRefresh(true, true),
      async askNotifications() {
        const ok = await setupNotifications(true).catch(() => false);
        setAllowed(ok);
        return ok;
      },
      restoreBackup(incoming, incomingSettings, mode) {
        const cur = settingsRef.current as Settings;
        // mantém o tema e o foco atuais; o resto vem do backup
        const nextSettings: Settings = { ...incomingSettings, onboarded: true, activeFocus: cur.activeFocus };
        commitSettings(nextSettings);
        commitTasks((prev) => (mode === 'substituir' ? incoming : mergeBackup(prev, incoming)));
      },
      logFocus(taskId, minutes) {
        if (minutes < 1) return;
        const task = taskId ? tasksRef.current.find((t) => t.id === taskId) : undefined;
        const s = settingsRef.current as Settings;
        commitSettings({ focusLog: addFocus(s.focusLog, { day: toKey(new Date()), minutes, taskId, course: task?.course }) });
        if (task) {
          commitTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, focusMinutes: (t.focusMinutes ?? 0) + minutes, status: t.status === 'pendente' ? 'andamento' : t.status, updatedAt: Date.now() }
                : t,
            ),
          );
        }
      },
    };
  }, [ready, tasks, settings, notificationsAllowed, syncing, courseFilter, commitTasks, commitSettings, runRefresh]);

  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
