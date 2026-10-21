import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { loadTasks } from '../services/storage';
import { AgendaWidget } from './AgendaWidget';

/** Quantas tarefas cabem conforme a altura do widget (em dp) */
function capacity(height?: number): number {
  if (!height) return 4;
  return Math.max(1, Math.min(8, Math.floor((height - 80) / 48)));
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const tasks = await loadTasks();
      props.renderWidget(<AgendaWidget tasks={tasks} max={capacity(props.widgetInfo.height)} />);
      break;
    }
    default:
      break;
  }
}
