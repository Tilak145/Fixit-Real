import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '@/components/ui/text';

/** The FixIt mark: a house outline with a wrench, plus the wordmark. */
export function FixItLogo({ dark = false }: { dark?: boolean }) {
  const [primary, foreground, accent] = useCSSVariable([
    '--color-primary',
    '--color-foreground',
    '--color-accent',
  ]);
  const roof = dark ? String(foreground ?? '#ffffff') : String(primary ?? '#1565C0');
  return (
    <View className="flex-row items-center gap-2">
      <Svg width={32} height={28} viewBox="0 0 40 34" aria-hidden>
        <Path d="M20 1 2 16h6v17h24V16h6z" fill={roof} />
        <Circle cx="20" cy="17" r="10" fill={dark ? '#0D2C54' : '#FFFFFF'} />
        <Path
          d="M25.5 11.5a7 7 0 1 0 3 7.5l-4-1a3 3 0 1 1-2-3.5z"
          fill={String(accent ?? '#F57C00')}
        />
      </Svg>
      <View className="gap-0">
        <View className="flex-row items-baseline">
          <Text className="text-[21px] font-bold leading-6 text-foreground">Fix</Text>
          <Text className="text-[21px] font-bold leading-6 text-accent">It</Text>
        </View>
        <Text className="text-[8px] font-bold tracking-[0.2em] text-primary">LOCAL SERVICES</Text>
      </View>
    </View>
  );
}
