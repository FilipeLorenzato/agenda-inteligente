export type Status = 'pendente' | 'andamento' | 'concluida';
export type Priority = 'urgente' | 'alta' | 'media' | 'baixa';
export type Source = 'manual' | 'voz' | 'feed';
export type ThemeMode = 'sistema' | 'claro' | 'escuro';

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
  /** Para tarefas importadas: `${feedId}:${uid}` */
  externalId?: string;
  feedName?: string;
  course?: string;
  url?: string;
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
}

export type TaskDraft = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>;
