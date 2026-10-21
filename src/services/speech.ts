// Reconhecimento de voz no próprio celular (pt-BR), via expo-speech-recognition.
// O módulo nativo só existe no APK do app (não no Expo Go), então é carregado com segurança.

export interface SpeechResultEvent {
  isFinal: boolean;
  results: { transcript: string; confidence: number }[];
}
export interface SpeechErrorEvent {
  error: string;
  message: string;
}

interface SpeechModule {
  isRecognitionAvailable(): boolean;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  addListener(event: string, fn: (e: never) => void): { remove(): void };
}

let mod: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  mod = require('expo-speech-recognition').ExpoSpeechRecognitionModule as SpeechModule;
} catch {
  mod = null;
}

export function speechAvailable(): boolean {
  try {
    return !!mod && mod.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export interface Listeners {
  onResult(e: SpeechResultEvent): void;
  onError(e: SpeechErrorEvent): void;
  onEnd(): void;
  onStart?(): void;
  onVolume?(value: number): void;
}

/** Começa a ouvir. Retorna uma função para parar de escutar os eventos. */
export async function startListening(l: Listeners): Promise<() => void> {
  if (!mod) throw new Error('Reconhecimento de voz indisponível nesta versão do app');
  const perm = await mod.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Permita o uso do microfone para adicionar tarefas por voz');
  const subs = [
    mod.addListener('result', ((e: SpeechResultEvent) => l.onResult(e)) as (e: never) => void),
    mod.addListener('error', ((e: SpeechErrorEvent) => l.onError(e)) as (e: never) => void),
    mod.addListener('end', (() => l.onEnd()) as (e: never) => void),
    mod.addListener('start', (() => l.onStart?.()) as (e: never) => void),
    mod.addListener('volumechange', ((e: { value: number }) => l.onVolume?.(e.value)) as (e: never) => void),
  ];
  mod.start({
    lang: 'pt-BR',
    interimResults: true,
    continuous: false,
    addsPunctuation: true,
    volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2200 },
  });
  return () => subs.forEach((s) => s.remove());
}

export function stopListening(): void {
  try {
    mod?.stop();
  } catch {
    /* já parado */
  }
}

export function abortListening(): void {
  try {
    mod?.abort();
  } catch {
    /* já parado */
  }
}

export function speechErrorMessage(code: string): string {
  switch (code) {
    case 'no-speech':
    case 'speech-timeout':
      return 'Não ouvi nada. Toque no microfone e fale de novo.';
    case 'not-allowed':
      return 'Permissão do microfone negada. Libere em Configurações do Android.';
    case 'network':
      return 'Sem conexão para o reconhecimento de voz. Instale o pacote offline de português no app Google.';
    case 'language-not-supported':
      return 'Português não está disponível no reconhecimento de voz do celular.';
    case 'aborted':
      return '';
    default:
      return 'Não entendi. Tente de novo ou digite abaixo.';
  }
}
