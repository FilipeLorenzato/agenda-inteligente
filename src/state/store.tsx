import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { makeTask } from '../lib/logic';
import { nextStatus } from '../lib/meta';
import { registerBackgroundSync } from '../services/background';
import { syncFeeds, SyncResult } from '../services/feeds';
import { rescheduleAll, setupNotifications } from '../services/notifications';
import { loadSettings, loadTasks, saveSettings, saveTasks } from '../services/storage';
import type { Settings, Status, Task, TaskDraft } from '../types';

interface Store {
  ready: boolean;
  tasks: Task[];
  settings: Settings;
  notificationsAllowed: boolean;
  syncing: boolean;
  addTask(draft: TaskDraft): Task;
  updateTask(id: string, patch: Partial<Task>): void;
  deleteTask(id: string): void;
  setStatus(id: string, status: Status): void;
  cycleStatus(id: string): void;
  updateSettings(patch: Partial<Settings>): void;
  syncNow(): Promise<SyncResult | null>;
  askNotifications(): Promise<boolean>;
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
  const tasksRef = useRef(tasks);
  const settingsRef = useRef(settings);
  tasksRef.current = tasks;
  settingsRef.current = settings;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Salva e reagenda as notificações (com um pequeno atraso para agrupar mudanças)
  const persist = useCallback((nextTasks: Task[] | null, nextSettings: Settings | null) => {
    if (nextTasks) saveTasks(nextTasks).catch(() => undefined);
    if (nextSettings) saveSettings(nextSettings).catch(() => undefined);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const s = settingsRef.current;
      if (s) rescheduleAll(tasksRef.current, s).catch((e) => console.warn(e));
    }, 1200);
  }, []);

  const commitTasks = useCallback(
    (fn: (prev: Task[]) => Task[]) => {
      setTasks((prev) => {
        const next = fn(prev);
        tasksRef.current = next;
        persist(next, null);
        return next;
      });
    },
    [persist],
  );

  const syncNow = useCallback(async (): Promise<SyncResult | null> => {
    const s = settingsRef.current;
    if (!s || !s.feeds.length) return null;
    setSyncing(true);
    try {
      const r = await syncFeeds(tasksRef.current, s);
      tasksRef.current = r.tasks;
      settingsRef.current = r.settings;
      setTasks(r.tasks);
      setSettings(r.settings);
      persist(r.tasks, r.settings);
      return r;
    } finally {
      setSyncing(false);
    }
  }, [persist]);

  const reload = useCallback(async () => {
    const [t, s] = await Promise.all([loadTasks(), loadSettings()]);
    tasksRef.current = t;
    settingsRef.current = s;
    setTasks(t);
    setSettings(s);
    return s;
  }, []);

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
      const last = Math.max(0, ...s.feeds.map((f) => f.lastSync ?? 0));
      if (s.autoSync && s.feeds.length && Date.now() - last > AUTO_SYNC_EVERY) await syncNow().catch(() => null);
      else rescheduleAll(tasksRef.current, s).catch(() => undefined);
    })();
    return () => {
      alive = false;
    };
  }, [reload, syncNow]);

  // Ao voltar para o app: recarrega (a sincronização em segundo plano pode ter mudado algo)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      reload().then((s) => {
        const last = Math.max(0, ...s.feeds.map((f) => f.lastSync ?? 0));
        if (s.autoSync && s.feeds.length && Date.now() - last > AUTO_SYNC_EVERY) syncNow().catch(() => null);
      });
    });
    return () => sub.remove();
  }, [reload, syncNow]);

  const value = useMemo<Store | null>(() => {
    if (!settings) return null;
    return {
      ready,
      tasks,
      settings,
      notificationsAllowed,
      syncing,
      addTask(draft) {
        const t = makeTask(draft);
        commitTasks((prev) => [...prev, t]);
        return t;
      },
      updateTask(id, patch) {
        commitTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)));
      },
      deleteTask(id) {
        commitTasks((prev) => prev.filter((t) => t.id !== id));
      },
      setStatus(id, status) {
        commitTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status, updatedAt: Date.now() } : t)));
      },
      cycleStatus(id) {
        commitTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus(t.status), updatedAt: Date.now() } : t)));
      },
      updateSettings(patch) {
        const next = { ...(settingsRef.current as Settings), ...patch };
        settingsRef.current = next;
        setSettings(next);
        persist(null, next);
      },
      syncNow,
      async askNotifications() {
        const ok = await setupNotifications(true).catch(() => false);
        setAllowed(ok);
        return ok;
      },
    };
  }, [ready, tasks, settings, notificationsAllowed, syncing, commitTasks, persist, syncNow]);

  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
