// Interpretador de frases em português para criar tarefas rapidamente
// (usado pelo áudio e pela digitação rápida). Funciona 100% offline, por regras.
//
// Exemplo: "prova de sistemas operacionais sexta às 14h urgente,
//           me lembra uma semana antes e um dia antes"
//   -> título "Prova de sistemas operacionais", próxima sexta 14:00, 🔥 urgente,
//      lembretes [1 semana, 1 dia], emoji 📝

import type { Priority, Repeat } from '../types';
import { addDays, addMonths, startOfDay, toKey, toTime } from './dates';
import { guessCategory } from './meta';

export interface ParsedTask {
  title: string;
  date: string;
  time?: string;
  priority: Priority;
  priorityDetected: boolean;
  emoji: string;
  /** null = não falou de lembretes (usar os padrão) */
  reminders: number[] | null;
  alarm: number | null;
  /** Trechos entendidos, na ordem em que foram reconhecidos */
  matched: string[];
  /** Repetição detectada ("toda segunda e quarta", "todo dia") */
  repeat: Repeat | null;
}

// ---------- números por extenso ----------
const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
  trinta: 30, quarenta: 40, cinquenta: 50,
};
const UNITS_WORDS = 'um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove';
const SIMPLE_WORDS = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|');
const NUM = `(?:\\d{1,4}|(?:vinte|trinta|quarenta|cinquenta) e (?:${UNITS_WORDS})|${SIMPLE_WORDS})`;

export function wordToNumber(s: string): number {
  const t = s.trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return t.split(' e ').reduce((acc, part) => acc + (NUMBER_WORDS[part.trim()] ?? 0), 0);
}

const MONTHS_RE = 'janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
const MONTH_INDEX: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6,
  agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};
const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};

const UNIT = '(?:minutos?|min|horas?|hrs?|h|dias?|semanas?|mes|meses)';
const ITEM = `(?:meia hora|${NUM}\\s*${UNIT})`;
const LIST = `${ITEM}(?:\\s*(?:,|e)\\s*${ITEM})*`;
const REMIND_VERB = '(?:me\\s+)?(?:lembra|lembre|lembrar|avisa|avise|avisar|notifica|notifique|notificar)(?:-me|\\s+me)?';

function unitToMinutes(n: number, unit: string): number {
  if (unit.startsWith('min')) return n;
  if (unit.startsWith('h')) return n * 60;
  if (unit.startsWith('dia')) return n * 1440;
  if (unit.startsWith('semana')) return n * 10080;
  if (unit.startsWith('mes')) return n * 43200;
  return n;
}

function itemToMinutes(item: string): number {
  if (item.startsWith('meia hora')) return 30;
  const m = new RegExp(`^(${NUM})\\s*(${UNIT})$`).exec(item.trim());
  if (!m) return 0;
  return unitToMinutes(wordToNumber(m[1]), m[2]);
}

function normalize(s: string): string {
  // Mantém o mesmo comprimento do texto original (um caractere -> um caractere),
  // para que os trechos encontrados possam ser removidos do texto original.
  let out = '';
  for (const ch of s) {
    let c = ch.toLowerCase();
    if (c.length !== ch.length) c = ch;
    const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    out += base.length === ch.length ? base : c;
  }
  return out;
}

const CONNECTORS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'pro', 'na', 'no', 'nas', 'nos', 'as', 'às', 'a', 'à',
  'ao', 'e', 'é', 'com', 'ate', 'até', 'em', 'que', 'o', 'os', 'me', 'pelas', 'pela', 'umas', 'tipo',
]);

export function parseTask(input: string, now: Date = new Date()): ParsedTask {
  const original = input.normalize('NFC').replace(/\s+/g, ' ').trim();
  let work = normalize(original);
  const removed: boolean[] = new Array(original.length).fill(false);
  const matched: string[] = [];

  /** Procura `re` no texto ainda não consumido; `fn` decide se aceita. Consome os trechos aceitos. */
  const take = (re: RegExp, fn?: (m: RegExpExecArray) => boolean | void, once = false): boolean => {
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    const rx = new RegExp(re.source, flags);
    const hits: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = rx.exec(work)) !== null) {
      if (m[0].trim().length === 0) {
        rx.lastIndex++;
        continue;
      }
      hits.push(m);
    }
    let any = false;
    for (const h of hits) {
      if (fn && fn(h) === false) continue;
      const start = h.index;
      const end = start + h[0].length;
      for (let i = start; i < end; i++) removed[i] = true;
      work = work.slice(0, start) + ' '.repeat(end - start) + work.slice(end);
      matched.push(original.slice(start, end).trim());
      any = true;
      if (once) break;
    }
    return any;
  };

  const today = startOfDay(now);
  let date: Date | null = null;
  let time: string | undefined;
  let period: 'manha' | 'tarde' | 'noite' | 'madrugada' | null = null;
  let priority: Priority = 'media';
  let priorityDetected = false;
  let reminders: number[] | null = null;
  let alarm: number | null = null;
  const wakeContext = /\b(acorda|acordar|despertar)\b/.test(work);

  // ---------- alarme com antecedência ("alarme 30 minutos antes") ----------
  take(new RegExp(`(?:\\b(?:e|com)\\s+)?(?:(?:coloca|colocar|coloque|bota|botar|poe|liga|ligar|cria|criar)\\s+)?(?:um\\s+)?(?:alarme|despertador)\\s+(?:de\\s+|para\\s+)?(${ITEM})\\s+antes\\b`), (m) => {
    alarm = itemToMinutes(m[1]);
  }, true);

  // ---------- lembretes ("me lembra uma semana antes e um dia antes") ----------
  take(new RegExp(`(?:\\b(?:e|com)\\s+)?(?:${REMIND_VERB}\\s+)?(?:(?:com\\s+)?(?:lembretes?|avisos?|notificac(?:ao|oes))\\s+)?(?:de\\s+|com\\s+)?(${LIST})\\s+antes\\b`), (m) => {
    const items = m[1].match(new RegExp(ITEM, 'g')) ?? [];
    const mins = items.map(itemToMinutes).filter((x) => x > 0);
    if (!mins.length) return false;
    reminders = [...(reminders ?? []), ...mins];
  });
  take(new RegExp(`(?:\\b(?:e|com)\\s+)?(?:${REMIND_VERB}\\s+)?(?:tambem\\s+)?\\b(?:na hora(?: certa)?|no horario)\\b`), () => {
    reminders = [...(reminders ?? []), 0];
  });

  // ---------- alarme simples ----------
  take(/(?:\b(?:e|com)\s+)?(?:(?:coloca|colocar|coloque|bota|botar|poe|liga|ligar|cria|criar|com)\s+)?(?:um\s+)?\b(?:alarme|despertador)\b(?:\s+(?:tambem|junto))?/, () => {
    if (alarm === null) alarm = 0;
  });
  take(/\bme\s+acord(?:a|e|ar)\b/, () => {
    if (alarm === null) alarm = 0;
  });

  // ---------- prioridade ----------
  const setPrio = (p: Priority) => () => {
    if (!priorityDetected) {
      priority = p;
      priorityDetected = true;
    }
  };
  take(/(?:\b(?:e|com|eh|e\s+muito|muito|bem)\s+)?\b(?:urgentes?|urgencia|com urgencia|prioridade (?:maxima|altissima|urgente)|super importante|muito importante|importantissim[oa])\b/, setPrio('urgente'));
  take(/(?:\b(?:e|com|eh)\s+)?\b(?:importantes?|prioridade alta|alta prioridade|prioritari[oa])\b/, setPrio('alta'));
  take(/(?:\b(?:e|com|eh)\s+)?\b(?:prioridade baixa|baixa prioridade|sem pressa|sem urgencia|quando der|quando puder|nao urgente)\b/, setPrio('baixa'));
  take(/(?:\b(?:e|com|eh)\s+)?\b(?:prioridade (?:media|normal))\b/, setPrio('media'));

  // ---------- repetição ----------
  let repeat: Repeat | null = null;
  const WD = '(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:[\\s-]feiras?)?s?';
  take(new RegExp(`\\b(?:tod[ao]s?(?:\\s+as?)?|as)\\s+${WD}((?:\\s*(?:,|e)\\s*(?:a\\s+|as\\s+)?${WD})*)`), (m) => {
    const names = m[0].match(/segunda|terca|quarta|quinta|sexta|sabado|domingo/g) ?? [];
    if (!/^tod|^\s*tod/.test(m[0].trim()) && !/^as\s+\w+s\b/.test(m[0].trim())) return false;
    const days = Array.from(new Set(names.map((n) => WEEKDAY_INDEX[n]))).sort((a, b) => a - b);
    if (!days.length) return false;
    repeat = { freq: 'semanal', days };
  }, true);
  if (!repeat) {
    take(/\b(?:todos os dias|todo dia|diariamente|dia sim e outro tambem)\b/, () => {
      repeat = { freq: 'diaria' };
    }, true);
  }
  if (!repeat) {
    take(/\b(?:toda semana|todas as semanas|semanalmente)\b/, () => {
      repeat = { freq: 'semanal' };
    }, true);
  }
  if (!repeat) {
    take(/\b(?:todo mes|todos os meses|mensalmente)\b/, () => {
      repeat = { freq: 'mensal' };
    }, true);
  }

  // ---------- datas explícitas ----------
  const makeDate = (day: number, month: number | null, year: number | null): Date | null => {
    let y = year ?? today.getFullYear();
    if (y < 100) y += 2000;
    let mo = month ?? today.getMonth();
    let d = new Date(y, mo, day);
    if (d.getDate() !== day) return null; // dia inválido (ex.: 31/02)
    if (year === null && d < today) {
      if (month === null) {
        mo += 1;
        d = new Date(y, mo, day);
        if (d.getDate() !== day) d = new Date(y, mo + 1, day);
      } else {
        d = new Date(y + 1, mo, day);
      }
    }
    return d;
  };

  take(/\b(?:(?:no|para o|pro|ate o|em|dia)\s+)*(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, (m) => {
    const d = makeDate(+m[1], +m[2] - 1, m[3] ? +m[3] : null);
    if (!d || date) return false;
    date = d;
  }, true);
  if (!date) {
    take(new RegExp(`\\b(?:(?:no|para o|pro|ate o|em)\\s+)?(?:dia\\s+)?(${NUM})\\s+de\\s+(${MONTHS_RE})(?:\\s+de\\s+(\\d{4}))?\\b`), (m) => {
      const d = makeDate(wordToNumber(m[1]), MONTH_INDEX[m[2]], m[3] ? +m[3] : null);
      if (!d) return false;
      date = d;
    }, true);
  }
  if (!date) {
    take(new RegExp(`\\b(?:(?:no|para o|pro|ate o|em)\\s+)?dia\\s+(${NUM})\\b`), (m) => {
      const n = wordToNumber(m[1]);
      if (n < 1 || n > 31) return false;
      const d = makeDate(n, null, null);
      if (!d) return false;
      date = d;
    }, true);
  }

  // ---------- hoje / amanhã / depois de amanhã ----------
  if (!date) {
    take(/\b(?:(?:para|pra|ate|ainda)\s+)?(depois de amanha|amanha|hoje)(?:\s+(?:de|a|pela|na)\s+(manha|tarde|noite|madrugada))?\b/, (m) => {
      const offset = m[1] === 'hoje' ? 0 : m[1] === 'amanha' ? 1 : 2;
      date = addDays(today, offset);
      if (m[2]) period = m[2] as typeof period;
    }, true);
  }

  // ---------- em N dias / daqui a N semanas ----------
  if (!date) {
    take(new RegExp(`\\b(?:em|daqui a|daqui|dentro de)\\s+(${NUM})\\s+(dias?|semanas?|mes|meses)\\b`), (m) => {
      const n = wordToNumber(m[1]);
      if (m[2].startsWith('dia')) date = addDays(today, n);
      else if (m[2].startsWith('semana')) date = addDays(today, n * 7);
      else date = addMonths(today, n);
    }, true);
  }

  // ---------- dia da semana ----------
  if (!date) {
    take(/\b(?:(?:na|no|nessa|nesta|neste|nesse|essa|esta|ate a|ate o|para a|para o|pra|proxima|proximo)\s+)*(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:[\s-]feira)?(?:\s+(?:que vem|da semana que vem|da proxima semana))?\b(?!\s+(?:prova|chamada|parte|etapa|entrega|lista|vez|fase|unidade|avaliacao|versao|edicao|questao|tarefa|atividade|aula|semana|turma|opcao|via)\b)/, (m) => {
      const target = WEEKDAY_INDEX[m[1]];
      let diff = (target - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      if (/da (?:semana que vem|proxima semana)/.test(m[0]) && diff < 7) {
        // "sexta da semana que vem" = sexta da próxima semana (não a desta)
        const daysToNextSunday = 7 - today.getDay();
        if (diff < daysToNextSunday) diff += 7;
      }
      date = addDays(today, diff);
    }, true);
  }

  // ---------- semana que vem / fim de semana / mês que vem ----------
  if (!date) {
    take(/\b(?:(?:na|para a|pra)\s+)?(?:semana que vem|proxima semana)\b/, () => {
      date = addDays(today, 7);
    }, true);
  }
  if (!date) {
    take(/\b(?:(?:no|neste|nesse|para o|pro|ate o)\s+)?(?:fim|final) de semana\b/, () => {
      const diff = (6 - today.getDay() + 7) % 7 || 7;
      date = addDays(today, diff);
    }, true);
  }
  if (!date) {
    take(/\b(?:(?:no|para o|pro)\s+)?(?:mes que vem|proximo mes)\b/, () => {
      date = addMonths(today, 1);
    }, true);
  }

  // ---------- horários ----------
  let rawHour: number | null = null;
  let rawMin = 0;
  let timeHadPeriod = false;

  take(/\b(?:(?:ao|as|a|ate|para o|pro)\s+)?(meio[\s-]dia|meia[\s-]noite)(?:\s+e\s+meia)?\b/, (m) => {
    rawHour = m[1].startsWith('meio') ? 12 : 0;
    rawMin = /e meia$/.test(m[0]) ? 30 : 0;
    timeHadPeriod = true;
  }, true);

  if (rawHour === null) {
    take(new RegExp(`\\b(?:as|ate as|pras|para as|la pelas|pelas|a(?=\\s+uma\\b))\\s+(\\d{1,2}|${NUM})(?:\\s*(?:h|:)\\s*(\\d{2}))?(?:\\s*(?:horas?|hrs?|h))?(?:\\s+e\\s+(meia|${NUM}(?:\\s+minutos?)?))?(?:\\s+(?:da|de)\\s+(manha|tarde|noite|madrugada))?\\b`), (m) => {
      const h = wordToNumber(m[1]);
      if (h > 23) return false;
      rawHour = h;
      rawMin = m[2] ? +m[2] : m[3] ? (m[3] === 'meia' ? 30 : wordToNumber(m[3].replace(/\s+minutos?$/, ''))) : 0;
      if (m[4]) {
        period = m[4] as typeof period;
        timeHadPeriod = true;
      }
    }, true);
  }
  if (rawHour === null) {
    take(/\b(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:hrs?|horas?|min)?(?:\s+(?:da|de)\s+(manha|tarde|noite|madrugada))?\b/, (m) => {
      const h = +m[1];
      if (h > 23) return false;
      rawHour = h;
      rawMin = m[2] ? +m[2] : 0;
      if (m[3]) {
        period = m[3] as typeof period;
        timeHadPeriod = true;
      }
    }, true);
  }
  if (rawHour === null) {
    take(new RegExp(`\\b(${NUM})\\s+(?:horas?\\s+)?(?:e\\s+(meia)\\s+)?(?:da|de)\\s+(manha|tarde|noite|madrugada)\\b`), (m) => {
      rawHour = wordToNumber(m[1]);
      rawMin = m[2] ? 30 : 0;
      period = m[3] as typeof period;
      timeHadPeriod = true;
    }, true);
  }
  if (rawHour === null) {
    take(/\b(\d{1,2})\s+horas?\b/, (m) => {
      const h = +m[1];
      if (h > 23) return false;
      rawHour = h;
    }, true);
  }

  // período solto: "à noite", "de manhã"
  take(/\b(?:de|a|pela|na|nesta|essa|esta|hoje a)\s+(manha|tarde|noite|madrugada)\b/, (m) => {
    if (period && timeHadPeriod) return false;
    period = m[1] as typeof period;
  }, true);

  if (rawHour !== null) {
    let h: number = rawHour;
    if (period === 'tarde' || period === 'noite') {
      if (h < 12) h += 12;
      if (period === 'noite' && h === 24) h = 0;
    } else if (period === 'manha' && h === 12) {
      h = 12;
    } else if (!period && !wakeContext && h >= 1 && h <= 6) {
      // "às 2" quase sempre quer dizer 14h
      h += 12;
    }
    time = `${String(h).padStart(2, '0')}:${String(Math.min(rawMin, 59)).padStart(2, '0')}`;
  } else if (period) {
    time = period === 'manha' ? '09:00' : period === 'tarde' ? '14:00' : period === 'noite' ? '19:00' : '06:00';
  }

  // ---------- data padrão ----------
  let finalDate: Date;
  const rep = repeat as Repeat | null;
  if (date) finalDate = date;
  else if (rep && rep.freq === 'semanal' && rep.days?.length) {
    // primeira ocorrência: o próximo dia da lista (hoje vale se o horário ainda não passou)
    const todayOk = !time || time > toTime(now);
    let found = today;
    for (let i = 0; i < 8; i++) {
      const d = addDays(today, i);
      if (rep.days.includes(d.getDay()) && (i > 0 || todayOk)) {
        found = d;
        break;
      }
    }
    finalDate = found;
  } else if (time) {
    // só horário: hoje se ainda não passou, senão amanhã
    finalDate = time > toTime(now) ? today : addDays(today, 1);
  } else finalDate = today;

  // ---------- palavras de comando no início ----------
  take(/^\s*(?:(?:ok|ei|oi|por favor|agenda)\s*,?\s+)*(?:(?:adiciona|adicionar|adicione|cria|criar|crie|anota|anotar|anote|marca|marcar|marque|agendar|agende|coloca|colocar|coloque|bota|salva|salvar|registra|registrar)\s+)?(?:(?:uma?\s+)?(?:nova\s+)?(?:tarefa|lembrete|compromisso|evento)\s*(?::|de|para|pra)?\s+)?/, (m) => {
    if (!m[0].trim()) return false;
  }, true);
  take(/^\s*(?:(?:eu|que)\s+)?(?:preciso|tenho que|tenho de|vou|devo|tenho)\s+(?:de\s+)?/, undefined, true);
  take(new RegExp(`^\\s*(?:${REMIND_VERB})\\s+(?:de\\s+|que\\s+)?`), undefined, true);
  // verbos de lembrete soltos que sobraram ("e me avisa")
  take(new RegExp(`(?:\\s|^)(?:e\\s+)?${REMIND_VERB}(?=\\s|$)`), () => {
    if (reminders === null) return false;
  });

  // ---------- título ----------
  let title = '';
  for (let i = 0; i < original.length; i++) title += removed[i] ? ' ' : original[i];
  let words = title.split(/\s+/).filter(Boolean);
  const isConnector = (w: string) => CONNECTORS.has(w.toLowerCase().replace(/[.,;:!?-]+$/, '').replace(/^[.,;:!?-]+/, ''));
  while (words.length && (isConnector(words[0]) || /^[.,;:!?-]+$/.test(words[0]))) words.shift();
  while (words.length && (isConnector(words[words.length - 1]) || /^[.,;:!?-]+$/.test(words[words.length - 1]))) words.pop();
  title = words.join(' ').replace(/\s+([.,;:!?])/g, '$1').replace(/[,;:\-]+$/, '').replace(/^[,;:\-]+/, '').trim();
  const emptyTitle = !title;
  if (emptyTitle) title = alarm !== null ? 'Despertar' : 'Nova tarefa';
  title = title.charAt(0).toUpperCase() + title.slice(1);

  const cat = emptyTitle ? guessCategory('') : guessCategory(title);
  if (!priorityDetected && cat.priority) priority = cat.priority;

  const rem: number[] | null = reminders;
  return {
    title,
    date: toKey(finalDate),
    time,
    priority,
    priorityDetected,
    emoji: cat.emoji,
    reminders: rem ? Array.from(new Set<number>(rem)).sort((a, b) => b - a) : null,
    alarm,
    matched,
    repeat: rep ? (rep.freq === 'semanal' && !rep.days ? { freq: 'semanal', days: [finalDate.getDay()] } : rep) : null,
  };
}
