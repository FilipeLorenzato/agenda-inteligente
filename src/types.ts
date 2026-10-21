export type Status = 'pendente' | 'andamento' | 'concluida';
export type Priority = 'urgente' | 'alta' | 'media' | 'baixa';
export type Source = 'manual' | 'voz' | 'feed' | 'estudo';
export type ThemeMode = 'sistema' | 'claro' | 'escuro';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export type RepeatFreq = 'diaria' | 'semanal' | 'mensal';

export interface Repeat {
  freq: RepeatFreq;
  /** Dias da semana (0 = domingo) para repetição semanal */
  days?: number[];
  /** Última data (YYYY-MM-DD) em que a série pode ter ocorrências */
  until?: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  /** Data local no formato YYYY-MM-DD */
  date: string;
  /** Horário local HH:mm. Ausente = tarefa de dia inteiro */
  time?: string;
  priority: Priority;
  /** Emoji da categoria (📝 prova, 📚 trabalho, ...) */
  emoji: string;
  status: Status;
  /** Lembretes em minutos antes do prazo (ex.: 10080 = 1 semana, 1440 = 1 dia) */
  reminders: number[];
  /** Alarme em minutos antes do prazo; null = sem alarme */
  alarm: number | null;
  source: Source;
  /** Etapas (checklist) da tarefa */
  subtasks?: Subtask[];
  /** Regra de repetição; todas as ocorrências da série compartilham seriesId */
  repeat?: Repeat;
  seriesId?: string;
  /** Bloco de estudo: id da prova a que ele pertence */
  studyFor?: string;
  /** Minutos de foco (Pomodoro) registrados nesta tarefa */
  focusMinutes?: number;
  /** Para tarefas importadas: `${feedId}:${uid}` */
  externalId?: string;
  feedName?: string;
  course?: string;
  url?: string;
  /** Ids do Canvas (para conferir a entrega com o token) */
  canvasCourseId?: string;
  canvasAssignmentId?: string;
  /** Entregue no Canvas (conferido pela API) */
  submitted?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Feed {
  id: string;
  name: string;
  url: string;
  emoji: string;
  lastSync?: number;
  lastError?: string;
  lastCount?: number;
}

export interface CourseStyle {
  emoji: string;
  color: string;
}

export interface FocusEntry {
  /** YYYY-MM-DD */
  day: string;
  minutes: number;
  taskId?: string;
  course?: string;
}

export interface ActiveFocus {
  taskId?: string;
  phase: 'foco' | 'pausa';
  /** Fim da fase atual (ms). null = pausado */
  endAt: number | null;
  /** Minutos restantes quando pausado */
  remainingMs: number;
  /** Duração total da fase atual em minutos */
  phaseMinutes: number;
  /** Ciclos de foco concluídos nesta sessão */
  cycles: number;
  notificationId?: string;
}

export interface Settings {
  theme: ThemeMode;
  /** Lembretes aplicados a tarefas novas (manuais, por voz e importadas) */
  defaultReminders: number[];
  /** Horário de referência para tarefas de dia inteiro (HH:mm) */
  allDayTime: string;
  dailyDigest: boolean;
  dailyDigestTime: string;
  feeds: Feed[];
  autoSync: boolean;
  onboarded: boolean;
  /** Emoji e cor de cada disciplina (chave = nome da disciplina) */
  courseStyles: Record<string, CourseStyle>;
  /** Criar blocos de estudo antes das provas importadas */
  studyBlocks: boolean;
  studyDaysBefore: number;
  /** Provas cujo bloco de estudo foi excluído pelo usuário (não recriar) */
  dismissedStudy: string[];
  /** Pomodoro */
  focusMinutes: number;
  breakMinutes: number;
  focusLog: FocusEntry[];
  activeFocus: ActiveFocus | null;
  /** Data (ms) da última conferência de entregas no Canvas */
  lastSubmissionCheck?: number;
  canvasUser?: string;
}

export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
