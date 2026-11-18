import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { config } from '@/lib/config';

/**
 * A slim notice above every screen while FixIt is still being tested, so nobody
 * mistakes an early version for the finished service. Switch it off at launch
 * with EXPO_PUBLIC_IN_TESTING=false.
 */
export function TestingBanner() {
  if (!config.testing) return null;
  return (
    <View accessibilityRole="alert" className="border-b border-[#EBD38F] bg-[#FFF3D6] px-4 py-1.5">
      <Text className="text-center text-[12px] leading-4 text-[#6B4300]">
        <Text className="text-[11px] font-bold uppercase tracking-wide text-[#6B4300]">Testing phase </Text>
        FixIt is still being tested, so some things may change or not work yet.
      </Text>
    </View>
  );
}
