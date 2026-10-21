// Formato do arquivo de backup (JSON). Não inclui o token do Canvas.
import type { Settings, Task } from '../types';
import { DEFAULT_SETTINGS } from './logic';

export const BACKUP_APP = 'agenda-inteligente';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  tasks: Task[];
  settings: Settings;
}

export function buildBackup(tasks: Task[], settings: Settings, now: Date = new Date()): string {
  const file: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    tasks,
    settings: { ...settings, activeFocus: null },
  };
  return JSON.stringify(file, null, 1);
}

export function backupFileName(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `agenda-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

const isTask = (t: unknown): t is Task => {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  return typeof x.id === 'string' && typeof x.title === 'string' && typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date);
};

export function parseBackup(text: string): { tasks: Task[]; settings: Settings; exportedAt?: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('O arquivo não é um backup válido (JSON inválido).');
  }
  const d = data as Partial<BackupFile>;
  if (!d || d.app !== BACKUP_APP || !Array.isArray(d.tasks)) {
    throw new Error('Este arquivo não é um backup da Agenda Inteligente.');
  }
  const tasks = d.tasks.filter(isTask).map((t) => ({
    ...t,
    reminders: Array.isArray(t.reminders) ? t.reminders : [],
    alarm: typeof t.alarm === 'number' ? t.alarm : null,
    status: t.status ?? 'pendente',
    priority: t.priority ?? 'media',
    emoji: t.emoji ?? '🗓️',
    source: t.source ?? 'manual',
  }));
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(d.settings ?? {}), activeFocus: null };
  return { tasks, settings, exportedAt: d.exportedAt };
}

/** Junta um backup às tarefas atuais: o que tem o mesmo id é substituído pela versão mais recente */
export function mergeBackup(current: Task[], incoming: Task[]): Task[] {
  const map = new Map(current.map((t) => [t.id, t]));
  for (const t of incoming) {
    const cur = map.get(t.id);
    if (!cur || (t.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) map.set(t.id, t);
  }
  return [...map.values()];
}
