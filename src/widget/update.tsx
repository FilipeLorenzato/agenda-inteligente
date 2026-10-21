import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import type { Task } from '../types';
import { AgendaWidget, WIDGET_NAME } from './AgendaWidget';

let timer: ReturnType<typeof setTimeout> | null = null;

/** Atualiza o widget da tela inicial (se houver um adicionado) */
export function refreshWidget(tasks: Task[]): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: (info) => <AgendaWidget tasks={tasks} max={info.height ? Math.max(1, Math.min(8, Math.floor((info.height - 80) / 48))) : 4} />,
      widgetNotFound: () => undefined,
    }).catch(() => undefined);
  }, 800);
}
