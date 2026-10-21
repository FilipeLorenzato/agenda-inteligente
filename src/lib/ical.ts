// Leitor de calendários iCalendar (.ics) — o formato do "Feed do calendário" do Canvas,
// do Google Agenda (endereço secreto em formato iCal) e do Outlook.

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  url?: string;
  start: Date;
  allDay: boolean;
}

function unescapeText(v: string): string {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Converte DTSTART em Date local. Aceita DATE (20261025), UTC (…Z) e horário local/TZID. */
export function parseIcsDate(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    if (!m) return null;
    return { date: new Date(+m[1], +m[2] - 1, +m[3]), allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) {
    return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))), allDay: false };
  }
  // Sem "Z": horário "flutuante" ou com TZID. Tratamos como horário local do celular,
  // o que é correto quando o calendário está no mesmo fuso (ex.: America/Sao_Paulo).
  return { date: new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)), allDay: false };
}

export function parseIcs(text: string): IcsEvent[] {
  // "Desdobra" linhas longas (RFC 5545: quebra seguida de espaço ou tab)
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: IcsEvent[] = [];
  let cur: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur && cur.DTSTART) {
        const dt = parseIcsDate(cur.DTSTART.value, cur.DTSTART.params);
        if (dt) {
          events.push({
            uid: cur.UID?.value ?? `${cur.SUMMARY?.value ?? ''}-${cur.DTSTART.value}`,
            summary: unescapeText(cur.SUMMARY?.value ?? 'Sem título').trim(),
            description: cur.DESCRIPTION ? unescapeText(cur.DESCRIPTION.value).trim() : undefined,
            url: cur.URL?.value?.trim(),
            start: dt.date,
            allDay: dt.allDay,
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [name, ...paramParts] = head.split(';');
    const params: Record<string, string> = {};
    for (const p of paramParts) {
      const eq = p.indexOf('=');
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
    }
    const key = name.toUpperCase();
    if (!(key in cur)) cur[key] = { value, params };
  }
  return events;
}

/** Canvas coloca a disciplina no fim do título: "Trabalho 2 [Sistemas Operacionais - 2026/2]" */
export function splitCanvasTitle(summary: string): { title: string; course?: string } {
  const m = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(summary);
  if (!m || !m[1].trim()) return { title: summary.trim() };
  return { title: m[1].trim(), course: m[2].trim() };
}

/** Aceita webcal:// e corrige espaços colados por engano */
export function normalizeFeedUrl(url: string): string {
  const u = url.trim().replace(/\s+/g, '');
  if (u.startsWith('webcal://')) return 'https://' + u.slice('webcal://'.length);
  if (!/^https?:\/\//i.test(u)) return 'https://' + u;
  return u;
}

/** Remove HTML simples e encurta a descrição */
export function cleanDescription(d?: string, max = 400): string | undefined {
  if (!d) return undefined;
  const t = d.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}
