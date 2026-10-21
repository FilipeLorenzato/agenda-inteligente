import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { planAll, PlannedNotification } from '../lib/logic';
import type { Settings, Task } from '../types';

export const CHANNEL_REMINDERS = 'lembretes';
// Canais do Android não podem ser alterados depois de criados: mude o sufixo se mudar o som/vibração.
export const CHANNEL_ALARMS = 'alarmes_v1';
export const CHANNEL_DIGEST = 'resumo';
export const CATEGORY_TASK = 'tarefa';
export const ACTION_DONE = 'concluir';
export const ACTION_SNOOZE = 'adiar';
const ALARM_SOUND = 'alarme.wav';
const ACCENT = '#6C4DF6';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let setupDone = false;

/** Cria canais e botões das notificações e pede permissão. Retorna se pode notificar. */
export async function setupNotifications(ask = true): Promise<boolean> {
  if (!setupDone) {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
        name: 'Lembretes de tarefas',
        description: 'Avisos antes do prazo (ex.: 1 semana e 1 dia antes)',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        enableVibrate: true,
        lightColor: ACCENT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_ALARMS, {
        name: 'Alarmes',
        description: 'Alarme sonoro das tarefas em que você ativou ⏰',
        importance: Notifications.AndroidImportance.MAX,
        sound: ALARM_SOUND,
        vibrationPattern: [0, 900, 400, 900, 400, 900, 400, 900],
        enableVibrate: true,
        bypassDnd: true,
        lightColor: ACCENT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_DIGEST, {
        name: 'Resumo do dia',
        description: 'Um resumo das tarefas do dia, toda manhã',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.setNotificationCategoryAsync(CATEGORY_TASK, [
      { identifier: ACTION_DONE, buttonTitle: '✅ Concluir', options: { opensAppToForeground: true } },
      { identifier: ACTION_SNOOZE, buttonTitle: '😴 Adiar 10 min', options: { opensAppToForeground: true } },
    ]);
    setupDone = true;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !ask) return current.granted;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function channelFor(kind: PlannedNotification['kind']): string {
  return kind === 'alarme' ? CHANNEL_ALARMS : kind === 'resumo' ? CHANNEL_DIGEST : CHANNEL_REMINDERS;
}

async function scheduleOne(p: PlannedNotification): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: p.title,
      body: p.body,
      data: { taskId: p.taskId ?? null, kind: p.kind },
      sound: p.kind === 'alarme' ? ALARM_SOUND : true,
      priority: p.kind === 'alarme' ? Notifications.AndroidNotificationPriority.MAX : Notifications.AndroidNotificationPriority.HIGH,
      color: ACCENT,
      categoryIdentifier: p.taskId ? CATEGORY_TASK : undefined,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: p.at,
      channelId: channelFor(p.kind),
    },
  });
}

let running: Promise<number> | null = null;
let pending: { tasks: Task[]; settings: Settings } | null = null;

/**
 * Refaz todas as notificações agendadas a partir das tarefas atuais.
 * Chamadas simultâneas são agrupadas: só a mais recente é aplicada depois da que está rodando.
 */
export function rescheduleAll(tasks: Task[], settings: Settings): Promise<number> {
  pending = { tasks, settings };
  if (running) return running.then(() => (pending ? rescheduleAll(pending.tasks, pending.settings) : 0));
  const job = pending;
  pending = null;
  running = (async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const plan = planAll(job.tasks, job.settings);
      for (const p of plan) {
        try {
          await scheduleOne(p);
        } catch (e) {
          console.warn('Falha ao agendar notificação', e);
        }
      }
      return plan.length;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** "Adiar 10 min": reenvia a mesma notificação mais tarde */
export async function snooze(content: Notifications.NotificationContent, minutes = 10): Promise<void> {
  const data = (content.data ?? {}) as { taskId?: string | null; kind?: PlannedNotification['kind'] };
  await scheduleOne({
    taskId: data.taskId ?? undefined,
    kind: data.kind === 'alarme' ? 'alarme' : 'lembrete',
    at: new Date(Date.now() + minutes * 60000),
    title: content.title ?? 'Lembrete',
    body: `😴 Adiado · ${content.body ?? ''}`,
  });
}

export async function sendTestNotification(kind: 'lembrete' | 'alarme'): Promise<void> {
  await setupNotifications();
  await scheduleOne({
    kind,
    at: new Date(Date.now() + 5000),
    title: kind === 'alarme' ? '⏰ Teste de alarme' : '🔔 Teste de lembrete',
    body: kind === 'alarme' ? 'Se você ouviu o som de alarme, está tudo certo!' : 'As notificações da agenda estão funcionando ✨',
  });
}

export async function countScheduled(): Promise<number> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.length;
}
