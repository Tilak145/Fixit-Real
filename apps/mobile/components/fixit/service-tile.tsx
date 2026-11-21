import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { categoryIcon } from '@/lib/category-icons';
import { cn } from '@/lib/utils';

// Each service gets its own soft colour, so the grid reads at a glance.
const TINTS: Record<string, { bubble: string; icon: string }> = {
  plumbing: { bubble: 'bg-[#DDEFF6]', icon: 'text-[#1B6F8F]' },
  electrical: { bubble: 'bg-[#FBEFC8]', icon: 'text-[#9A6B00]' },
  hvac: { bubble: 'bg-[#E1ECFA]', icon: 'text-[#2F5FA3]' },
  'garage-doors': { bubble: 'bg-[#E9E4F5]', icon: 'text-[#5B47A0]' },
  roofing: { bubble: 'bg-[#F6DFD6]', icon: 'text-[#A4492A]' },
  'appliance-repair': { bubble: 'bg-[#DFF0E4]', icon: 'text-[#2D7A46]' },
  handyman: { bubble: 'bg-[#F3E3CF]', icon: 'text-[#8A5A1F]' },
  cleaning: { bubble: 'bg-[#D9F0EE]', icon: 'text-[#1B7A74]' },
  'pest-control': { bubble: 'bg-[#F5DCE2]', icon: 'text-[#A33A56]' },
  landscaping: { bubble: 'bg-[#E3F0D3]', icon: 'text-[#4E7A22]' },
};

/**
 * One service in the home grid: a soft coloured icon, the name, and how many
 * pros are listed. Two tiles per row, each taking half the width, so the grid
 * fits any screen. It always opens its list.
 */
export function ServiceTile({
  slug,
  name,
  detail,
  detailGood = false,
  city,
}: {
  slug: string;
  name: string;
  detail?: string | null;
  detailGood?: boolean;
  city?: string | null;
}) {
  const tint = TINTS[slug] ?? { bubble: 'bg-secondary', icon: 'text-primary' };
  return (
    <Pressable
      accessibilityLabel={'Get quotes for ' + name + (detail ? ', ' + detail : '')}
      onPress={() => router.push({ pathname: '/service/[slug]', params: city ? { slug, city } : { slug } })}
      style={{ width: '48.5%' }}
      className="bg-card border-border flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-70">
      <View className={cn('size-11 items-center justify-center rounded-xl', tint.bubble)}>
        <Icon as={categoryIcon(slug)} className={cn('size-6', tint.icon)} />
      </View>
      <View className="flex-1">
        <Text numberOfLines={2} className="text-[13.5px] font-semibold leading-[17px]">{name}</Text>
        {detail ? (
          <Text className={cn('text-[11.5px]', detailGood ? 'font-semibold text-[#1E7B3C]' : 'text-muted-foreground')}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}