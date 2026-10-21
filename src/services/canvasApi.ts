// Conferência opcional das entregas no Canvas, usando um token de acesso do aluno.
// O token fica guardado no armazenamento seguro do Android (não vai para o backup).
import * as SecureStore from 'expo-secure-store';
import type { Feed, Task } from '../types';

const TOKEN_KEY = 'canvas_token';

export async function getCanvasToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setCanvasToken(token: string | null): Promise<void> {
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Endereço base do Canvas a partir do link do feed (ex.: https://pucminas.instructure.com) */
export function canvasBase(feeds: Feed[]): string | null {
  for (const f of feeds) {
    const m = /^(?:https?|webcal):\/\/([^/]+\.instructure\.com|[^/]*canvas[^/]*)\//i.exec(f.url.trim());
    if (m) return `https://${m[1]}`;
  }
  const first = feeds[0]?.url && /^(?:https?|webcal):\/\/([^/]+)\//i.exec(feeds[0].url.trim());
  return first ? `https://${first[1]}` : null;
}

async function api<T>(base: string, token: string, path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  } catch {
    throw new Error('Sem conexão com o Canvas');
  }
  if (res.status === 401) throw new Error('Token inválido ou expirado — gere outro no Canvas');
  if (res.status === 403) throw new Error('O Canvas negou o acesso com este token');
  if (!res.ok) throw new Error(`Canvas respondeu com erro ${res.status}`);
  return (await res.json()) as T;
}

export async function testCanvasToken(base: string, token: string): Promise<string> {
  const me = await api<{ name?: string; short_name?: string }>(base, token, '/users/self');
  return me.short_name || me.name || 'você';
}

interface Submission {
  assignment_id: number;
  workflow_state?: string;
  submitted_at?: string | null;
  excused?: boolean;
}

/**
 * Retorna os ids das tarefas (assignments) já entregues por você.
 * Consulta só tarefas abertas do Canvas com prazo entre 30 dias atrás e 90 dias à frente.
 */
export async function fetchSubmitted(base: string, token: string, tasks: Task[], now: Date = new Date()): Promise<Set<string>> {
  const from = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);
  const byCourse = new Map<string, Set<string>>();
  for (const t of tasks) {
    if (!t.canvasCourseId || !t.canvasAssignmentId || t.submitted) continue;
    if (t.date < from || t.date > to) continue;
    const set = byCourse.get(t.canvasCourseId) ?? new Set<string>();
    set.add(t.canvasAssignmentId);
    byCourse.set(t.canvasCourseId, set);
  }
  const submitted = new Set<string>();
  for (const [courseId, ids] of byCourse) {
    const list = [...ids];
    for (let i = 0; i < list.length; i += 40) {
      const chunk = list.slice(i, i + 40);
      const q = chunk.map((id) => `assignment_ids[]=${encodeURIComponent(id)}`).join('&');
      const subs = await api<Submission[]>(base, token, `/courses/${courseId}/students/submissions?per_page=100&${q}`);
      for (const s of subs) {
        const done = s.excused || !!s.submitted_at || ['submitted', 'graded', 'pending_review', 'complete'].includes(s.workflow_state ?? '');
        if (done) submitted.add(String(s.assignment_id));
      }
    }
  }
  return submitted;
}
