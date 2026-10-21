// Sincronização em segundo plano: a cada ~6 h o Android acorda o app para
// buscar novas tarefas do Canvas, conferir entregas, reagendar notificações e atualizar o widget.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { refreshWidget } from '../widget/update';
import { rescheduleAll } from './notifications';
import { refreshAll } from './pipeline';
import { loadSettings, loadTasks, saveSettings, saveTasks } from './storage';

export const SYNC_TASK = 'agenda-sync';

// Precisa ficar no escopo global (fora de componentes) — importado em index.ts.
TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const tasks = await loadTasks();
    const settings = await loadSettings();
    const r = await refreshAll(tasks, settings, { sync: settings.autoSync });
    await saveTasks(r.tasks);
    await saveSettings(r.settings);
    await rescheduleAll(r.tasks, r.settings);
    refreshWidget(r.tasks);
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
