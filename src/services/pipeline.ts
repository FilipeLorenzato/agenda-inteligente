// Rotina de atualização usada pelo app e pela tarefa em segundo plano:
// sincroniza calendários, cria repetições e blocos de estudo e confere entregas no Canvas.
import { applySubmissions, ensureStudyBlocks, expandSeries } from '../lib/logic';
import type { Settings, Task } from '../types';
import { canvasBase, fetchSubmitted, getCanvasToken } from './canvasApi';
import { syncFeeds } from './feeds';

export interface RefreshResult {
  tasks: Task[];
  settings: Settings;
  added: number;
  updated: number;
  submitted: number;
  errors: string[];
}

const SUBMISSION_EVERY = 3 * 60 * 60 * 1000; // confere entregas no máximo a cada 3 h

export async function refreshAll(
  tasks: Task[],
  settings: Settings,
  opts: { sync: boolean; forceSubmissions?: boolean },
  now: Date = new Date(),
): Promise<RefreshResult> {
  let t = tasks;
  let s = settings;
  let added = 0;
  let updated = 0;
  let submitted = 0;
  const errors: string[] = [];

  if (opts.sync && s.feeds.length) {
    const r = await syncFeeds(t, s, now);
    t = r.tasks;
    s = r.settings;
    added = r.added;
    updated = r.updated;
    errors.push(...r.errors);
  }

  t = expandSeries(t, now);
  t = ensureStudyBlocks(t, s, now);

  const due = opts.forceSubmissions || !s.lastSubmissionCheck || now.getTime() - s.lastSubmissionCheck > SUBMISSION_EVERY;
  if (opts.sync && due && s.feeds.length) {
    const token = await getCanvasToken();
    const base = canvasBase(s.feeds);
    if (token && base) {
      try {
        const ids = await fetchSubmitted(base, token, t, now);
        const r = applySubmissions(t, ids, now);
        t = r.tasks;
        submitted = r.changed;
        s = { ...s, lastSubmissionCheck: now.getTime() };
      } catch (e) {
        errors.push(`Entregas: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return { tasks: t, settings: s, added, updated, submitted, errors };
}
