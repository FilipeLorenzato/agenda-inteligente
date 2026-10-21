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
  { emoji: '📝', label: 'Prova', words: ['prova', 'avaliacao', 'exame', 'teste', 'simulado', 'quiz'], priority: 'alta' },
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
