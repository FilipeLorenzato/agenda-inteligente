// Exportar e restaurar o backup como arquivo .json (salvar no Drive, WhatsApp, Arquivos...)
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backupFileName, buildBackup, parseBackup } from '../lib/backup';
import type { Settings, Task } from '../types';

export async function exportBackup(tasks: Task[], settings: Settings): Promise<void> {
  const file = new File(Paths.cache, backupFileName());
  if (file.exists) file.delete();
  file.create();
  file.write(buildBackup(tasks, settings));
  if (!(await Sharing.isAvailableAsync())) throw new Error('Compartilhamento indisponível neste celular');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Salvar backup da agenda',
    UTI: 'public.json',
  });
}

export async function pickBackup(): Promise<ReturnType<typeof parseBackup> | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  const text = await new File(result.assets[0].uri).text();
  return parseBackup(text);
}
