import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { alpha, radius, useTheme } from '../theme';

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'small' | 'tiny' | 'label';

const sizes: Record<Variant, TextStyle> = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8, lineHeight: 36 },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4, lineHeight: 27 },
  subtitle: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 21 },
  small: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  tiny: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', lineHeight: 16 },
};

export function Txt({
  variant = 'body',
  tone = 'text',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: 'text' | 'muted' | 'faint' | 'accent' | 'onAccent' | 'urgent' }) {
  const p = useTheme();
  const color =
    tone === 'muted' ? p.textMuted : tone === 'faint' ? p.textFaint : tone === 'accent' ? p.accent : tone === 'onAccent' ? p.onAccent : tone === 'urgent' ? p.urgent : p.text;
  return <Text {...rest} style={[sizes[variant], { color }, style]} />;
}

/** Pressable com feedback de toque (afunda e escurece levemente) */
export function Tap({ style, children, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { opacity: 0.72, transform: [{ scale: 0.97 }] }]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  emoji,
  selected,
  onPress,
  color,
  compact,
}: {
  label: string;
  emoji?: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  compact?: boolean;
}) {
  const p = useTheme();
  const c = color ?? p.accent;
  return (
    <Tap
      onPress={onPress}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        {
          backgroundColor: selected ? alpha(c, p.dark ? 0.24 : 0.14) : p.surface,
          borderColor: selected ? c : p.border,
        },
      ]}
    >
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      <Txt variant="small" style={{ color: selected ? c : p.textMuted, fontWeight: selected ? '800' : '600' }}>
        {label}
      </Txt>
    </Tap>
  );
}

export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const p = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.surface, borderColor: p.border, shadowColor: p.shadow },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  label,
  emoji,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  label: string;
  emoji?: string;
  onPress?: () => void;
  kind?: 'primary' | 'soft' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useTheme();
  const bg = kind === 'primary' ? p.accent : kind === 'soft' ? p.accentSoft : kind === 'danger' ? alpha(p.urgent, 0.12) : 'transparent';
  const fg = kind === 'primary' ? p.onAccent : kind === 'danger' ? p.urgent : p.accent;
  return (
    <Tap onPress={disabled ? undefined : onPress} style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}>
      {emoji ? <Text style={{ fontSize: 16, marginRight: 8 }}>{emoji}</Text> : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: '800' }}>{label}</Text>
    </Tap>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionLabel}>
      <Txt variant="label" tone="faint">
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function Row({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    marginRight: 8,
    marginBottom: 8,
  },
  chipCompact: { paddingHorizontal: 10, paddingVertical: 6 },
  chipEmoji: { fontSize: 14, marginRight: 6 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 16,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
  },
});
