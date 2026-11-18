import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '@/components/ui/text';

/** A circular progress indicator in the theme's primary color. `value` is 0–100. */
export function ProgressRing({ value, size = 80, stroke = 8, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const [primary, muted] = useCSSVariable(['--color-primary', '--color-muted']);
  const radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <View role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped} style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={String(muted ?? '#e5e5e5')} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={String(primary ?? '#171717')} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - clamped / 100)} />
      </Svg>
      <Text className="text-lg font-semibold">{label ?? `${Math.round(clamped)}%`}</Text>
    </View>
  );
}
