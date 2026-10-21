// Sincronização em segundo plano: a cada ~6 h o Android acorda o app para
// buscar novas tarefas do Canvas e reagendar as notificações.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { syncFeeds } from './feeds';
import { rescheduleAll } from './notifications';
import { loadSettings, loadTasks, saveSettings, saveTasks } from './storage';

export const SYNC_TASK = 'agenda-sync';

// Precisa ficar no escopo global (fora de componentes) — importado em index.ts.
TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    let tasks = await loadTasks();
    let settings = await loadSettings();
    if (settings.autoSync && settings.feeds.length) {
      const r = await syncFeeds(tasks, settings);
      tasks = r.tasks;
      settings = r.settings;
      await saveTasks(tasks);
      await saveSettings(settings);
    }
    await rescheduleAll(tasks, settings);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const registered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK);
    if (!registered) await BackgroundTask.registerTaskAsync(SYNC_TASK, { minimumInterval: 6 * 60 });
  } catch (e) {
    console.warn('Sincronização em segundo plano indisponível', e);
  }
}
