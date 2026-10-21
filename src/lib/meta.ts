import type { Priority, Status } from '../types';

export interface PriorityInfo {
  key: Priority;
  emoji: string;
  label: string;
  /** chave da cor no tema */
  color: 'urgent' | 'high' | 'normal' | 'low';
  weight: number;
}

export const PRIORITIES: PriorityInfo[] = [
  { key: 'urgente', emoji: '🔥', label: 'Urgente', color: 'urgent', weight: 4 },
  { key: 'alta', emoji: '⚡', label: 'Alta', color: 'high', weight: 3 },
  { key: 'media', emoji: '✨', label: 'Normal', color: 'normal', weight: 2 },
  { key: 'baixa', emoji: '🌿', label: 'Baixa', color: 'low', weight: 1 },
];

export const priorityInfo = (p: Priority): PriorityInfo =>
  PRIORITIES.find((x) => x.key === p) ?? PRIORITIES[2];

export interface StatusInfo {
  key: Status;
  emoji: string;
  label: string;
}

export const STATUSES: StatusInfo[] = [
  { key: 'pendente', emoji: '⏳', label: 'Pendente' },
  { key: 'andamento', emoji: '🚧', label: 'Em andamento' },
  { key: 'concluida', emoji: '✅', label: 'Concluída' },
];

export const statusInfo = (s: Status): StatusInfo => STATUSES.find((x) => x.key === s) ?? STATUSES[0];

export const nextStatus = (s: Status): Status =>
  s === 'pendente' ? 'andamento' : s === 'andamento' ? 'concluida' : 'pendente';

export interface Category {
  emoji: string;
  label: string;
  /** palavras (sem acento, minúsculas) que identificam a categoria */
  words: string[];
  /** prioridade sugerida quando detectada automaticamente */
  priority?: Priority;
}

// A ordem importa: a primeira categoria que casar vence.
export const CATEGORIES: Category[] = [
  { emoji: '🩺', label: 'Saúde', words: ['medico', 'medica', 'dentista', 'consulta', 'exame de sangue', 'remedio', 'vacina'] },
  { emoji: '📖', label: 'Estudo', words: ['estudar', 'revisar', 'revisao', 'ler', 'leitura', 'resumo'] },
  { emoji: '📝', label: 'Prova', words: ['prova', 'avaliacao', 'reavaliacao', 'exame', 'teste', 'simulado', 'quiz', 'quizz'], priority: 'alta' },
  { emoji: '📚', label: 'Trabalho / entrega', words: ['trabalho', 'tp', 'tarefa', 'atividade', 'entrega', 'projeto', 'relatorio', 'lista', 'exercicio', 'artigo', 'apresentacao', 'seminario'] },
  { emoji: '🎓', label: 'Aula', words: ['aula', 'monitoria', 'palestra', 'laboratorio', 'orientacao'] },
  { emoji: '👥', label: 'Reunião', words: ['reuniao', 'call', 'meet', 'encontro', 'grupo'] },
  { emoji: '💼', label: 'Carreira', words: ['estagio', 'entrevista', 'curriculo', 'vaga', 'linkedin'] },
  { emoji: '💸', label: 'Pagamento', words: ['pagar', 'conta', 'boleto', 'fatura', 'pix', 'mensalidade'] },
  { emoji: '🏋️', label: 'Treino', words: ['academia', 'treino', 'corrida', 'futebol', 'natacao'] },
  { emoji: '🎉', label: 'Evento', words: ['aniversario', 'festa', 'show', 'viagem', 'jantar'] },
  { emoji: '🛒', label: 'Compras', words: ['comprar', 'compras', 'mercado', 'farmacia'] },
  { emoji: '📞', label: 'Ligação', words: ['ligar', 'telefonar', 'retornar'] },
  { emoji: '💻', label: 'Código', words: ['codigo', 'deploy', 'commit', 'bug', 'programar', 'github'] },
  { emoji: '🗓️', label: 'Geral', words: [] },
];

export const DEFAULT_EMOJI = '🗓️';

export const EMOJI_CHOICES = CATEGORIES.map((c) => c.emoji);

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function guessCategory(text: string): Category {
  const t = ` ${stripAccents(text.toLowerCase()).replace(/[^a-z0-9 ]/g, ' ')} `;
  for (const c of CATEGORIES) {
    if (c.words.some((w) => t.includes(` ${w} `) || t.includes(` ${w}s `))) return c;
  }
  return CATEGORIES[CATEGORIES.length - 1];
}

/** Opções rápidas de lembrete, em minutos antes do prazo */
export const REMINDER_PRESETS = [10080, 4320, 1440, 180, 60, 30, 15, 0];

export const STUDY_EMOJI = '📖';
export const EXAM_EMOJI = '📝';

// ------------------------------------------------------------------
// Disciplinas: cor e emoji
// ------------------------------------------------------------------

// Sem vermelho/laranja puros para não confundir com a cor de importância (🔥 ⚡)
export const COURSE_COLORS = ['#0EA5E9', '#D946EF', '#14B8A6', '#4F46E5', '#B45309', '#0891B2', '#65A30D', '#CA8A04', '#DB2777', '#64748B'];
export const COURSE_EMOJIS = ['💻', '🧮', '🧠', '⚙️', '🗄️', '📐', '🔬', '🌐', '📊', '🧪', '🛰️', '🎨', '📘', '🔌'];

const COURSE_GUESS: [string[], string][] = [
  [['sistemas operacionais'], '🐧'],
  [['arquitetura', 'computadores'], '🔌'],
  [['algoritmo', 'complexidade'], '🧮'],
  [['banco de dados', 'dados'], '🗄️'],
  [['engenharia de software', 'software'], '🛠️'],
  [['redes'], '🌐'],
  [['inteligencia artificial', 'aprendizado', 'machine'], '🧠'],
  [['interdisciplinar', 'projeto integrador'], '🤝'],
  [['calculo', 'matematica', 'estatistica', 'probabilidade', 'algebra'], '📐'],
  [['fisica', 'quimica'], '🔬'],
  [['programacao', 'linguagem', 'compiladores'], '💻'],
  [['coordenacao', 'espaco'], '🏫'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Estilo padrão (determinístico) de uma disciplina, usado até o usuário escolher outro */
export function defaultCourseStyle(course: string): { emoji: string; color: string } {
  const t = stripAccents(course.toLowerCase());
  const guess = COURSE_GUESS.find(([words]) => words.some((w) => t.includes(w)));
  const h = hash(t);
  return { emoji: guess ? guess[1] : COURSE_EMOJIS[h % COURSE_EMOJIS.length], color: COURSE_COLORS[h % COURSE_COLORS.length] };
}

export function courseStyle(course: string, styles: Record<string, { emoji: string; color: string }>): { emoji: string; color: string } {
  return styles[course] ?? defaultCourseStyle(course);
}

/** Nome curto para chips: "Projeto e Análise de Algoritmos" -> "PAA", "Arquitetura de Computadores III" -> "Arq. Computadores III" */
export function shortCourse(course: string): string {
  if (course.length <= 22) return course;
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'a', 'o']);
  const main = course.split(/[:–-]/)[0].trim();
  const words = main
    .split(/\s+/)
    .map((w) => w.replace(/[:;,.]+$/, ''))
    .filter((w) => w && !small.has(w.toLowerCase()));
  const roman = words.find((w) => /^(I|II|III|IV|V|VI|VII|VIII|IX|X|\d)$/.test(w));
  const rest = words.filter((w) => w !== roman);
  if (roman && rest.length >= 2) {
    const abbr = `${rest[0].slice(0, rest[0].length > 6 ? 4 : rest[0].length)}${rest[0].length > 6 ? '.' : ''} ${rest[1]} ${roman}`;
    if (abbr.length <= 24) return abbr;
  }
  if (rest.length >= 2) {
    const acronym = rest.map((w) => w[0].toUpperCase()).join('') + (roman ? ` ${roman}` : '');
    return acronym;
  }
  return course.slice(0, 21) + '…';
}
