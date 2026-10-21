import { createContext, useContext } from 'react';
import type { Priority } from './types';

export interface Palette {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  urgent: string;
  high: string;
  normal: string;
  low: string;
  done: string;
  shadow: string;
}

// Claro: papel de caderno. Escuro: tinta roxa — confortável à noite.
export const light: Palette = {
  dark: false,
  bg: '#F6F3EE',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEAE2',
  border: '#E5DED3',
  text: '#1F1B16',
  textMuted: '#6E665C',
  textFaint: '#A39A8E',
  accent: '#6C4DF6',
  accentSoft: '#ECE7FF',
  onAccent: '#FFFFFF',
  urgent: '#E5484D',
  high: '#E8900C',
  normal: '#6C4DF6',
  low: '#2F9E6E',
  done: '#2F9E6E',
  shadow: '#2A1F0F',
};

export const dark: Palette = {
  dark: true,
  bg: '#121016',
  surface: '#1C1922',
  surfaceAlt: '#26222D',
  border: '#312C3A',
  text: '#F2EEF7',
  textMuted: '#A79FB3',
  textFaint: '#6F6879',
  accent: '#9D8BFF',
  accentSoft: '#2B2542',
  onAccent: '#14111A',
  urgent: '#FF6B6E',
  high: '#FFB23F',
  normal: '#9D8BFF',
  low: '#4CC38A',
  done: '#4CC38A',
  shadow: '#000000',
};

export const ThemeContext = createContext<Palette>(light);
export const useTheme = () => useContext(ThemeContext);

export function priorityColor(p: Palette, priority: Priority): string {
  return priority === 'urgente' ? p.urgent : priority === 'alta' ? p.high : priority === 'baixa' ? p.low : p.normal;
}

/** Cor com transparência (#RRGGBB + alfa) */
export function alpha(hex: string, a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.length === 7 ? hex + v : hex;
}

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
