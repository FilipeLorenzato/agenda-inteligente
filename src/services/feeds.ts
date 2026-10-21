import { normalizeFeedUrl, parseIcs, IcsEvent } from '../lib/ical';
import { mergeFeedEvents } from '../lib/logic';
import type { Feed, Settings, Task } from '../types';

export async function fetchFeed(feed: Pick<Feed, 'url'>): Promise<IcsEvent[]> {
  let res: Response;
  try {
    res = await fetch(normalizeFeedUrl(feed.url), { headers: { Accept: 'text/calendar, text/plain, */*' } });
  } catch {
    throw new Error('Sem conexão ou link inacessível');
  }
  if (!res.ok) {
    throw new Error(res.status === 404 || res.status === 401 ? 'Link inválido ou expirado — copie de novo no Canvas' : `Erro HTTP ${res.status}`);
  }
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('O link não é um calendário iCal (.ics)');
  return parseIcs(text);
}

export interface SyncResult {
  tasks: Task[];
  settings: Settings;
  added: number;
  updated: number;
  errors: string[];
}

export async function syncFeeds(tasks: Task[], settings: Settings, now: Date = new Date()): Promise<SyncResult> {
  let current = tasks;
  let added = 0;
  let updated = 0;
  const errors: string[] = [];
  const feeds: Feed[] = [];

  for (const feed of settings.feeds) {
    try {
      const events = await fetchFeed(feed);
      // Na primeira sincronização de um calendário, o que já passou entra como concluído
      const r = mergeFeedEvents(current, events, feed, settings, now, { markPastDone: !feed.lastSync });
      current = r.tasks;
      added += r.added;
      updated += r.updated;
      feeds.push({ ...feed, lastSync: now.getTime(), lastError: undefined, lastCount: events.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${feed.name}: ${msg}`);
      feeds.push({ ...feed, lastError: msg });
    }
  }
  return { tasks: current, settings: { ...settings, feeds }, added, updated, errors };
}
