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
 * One service category in the home grid. It always opens its list: a service
 * with nobody behind it yet offers to post the job and wait for someone to join.
 * `detail` is a short line under the name, such as "4 local pros".
 */
export function ServiceTile({
  slug,
  name,
  width,
  detail,
  detailGood = false,
  city,
}: {
  slug: string;
  name: string;
  width: number;
  detail?: string | null;
  detailGood?: boolean;
  city?: string | null;
}) {
  const tint = TINTS[slug] ?? { bubble: 'bg-secondary', icon: 'text-primary' };
  return (
    <Pressable
      accessibilityLabel={'Get quotes for ' + name + (detail ? ', ' + detail : '')}
      onPress={() => router.push({ pathname: '/service/[slug]', params: city ? { slug, city } : { slug } })}
      style={{ width }}
      className="items-center gap-2 active:opacity-70">
      <View className={cn('size-[62px] items-center justify-center rounded-[22px]', tint.bubble)}>
        <Icon as={categoryIcon(slug)} className={cn('size-7', tint.icon)} />
      </View>
      <Text numberOfLines={2} className="text-center text-[12.5px] font-semibold leading-4">{name}</Text>
      {detail ? (
        <Text className={cn('-mt-1 text-[11px]', detailGood ? 'font-semibold text-[#1E7B3C]' : 'text-muted-foreground')}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}