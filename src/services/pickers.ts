import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

/** Abre o seletor de data nativo do Android. Retorna null se o usuário cancelar. */
export function pickDate(current: Date): Promise<Date | null> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      onChange: (event, date) => resolve(event.type === 'set' && date ? date : null),
    });
  });
}

/** Abre o relógio nativo do Android (24 h). Retorna 'HH:mm' ou null. */
export function pickTime(current: Date): Promise<string | null> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value: current,
      mode: 'time',
      is24Hour: true,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return resolve(null);
        resolve(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
      },
    });
  });
}
