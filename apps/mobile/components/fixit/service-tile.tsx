import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { categoryIcon } from '@/lib/category-icons';
import { cn } from '@/lib/utils';

/**
 * One service category in the home grid. It always opens its list: a service
 * with nobody behind it yet offers to post the job and wait for someone to join.
 * `detail` is a short line under the name, such as "4 local pros" or "2
 * available now"; it is never claimed unless it is true right now.
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
  /** The detail is good news (someone is available now), so it is shown in green. */
  detailGood?: boolean;
  city?: string | null;
}) {
  return (
    <Pressable
      accessibilityLabel={'Get quotes for ' + name + (detail ? ', ' + detail : '')}
      onPress={() => router.push({ pathname: '/service/[slug]', params: city ? { slug, city } : { slug } })}
      style={{ width }}
      className={cn('border-border bg-card items-center gap-2 rounded-2xl border px-2 pb-3.5 pt-4 active:bg-muted')}>
      <Icon as={categoryIcon(slug)} className="text-primary size-8" />
      <Text numberOfLines={2} className="text-center text-[12.5px] font-semibold">{name}</Text>
      {detail ? (
        <View className="flex-row items-center gap-1">
          {detailGood ? <View className="size-1.5 rounded-full bg-[#2E9E4F]" /> : null}
          <Text className={cn('text-[11px]', detailGood ? 'font-semibold text-[#1E7B3C]' : 'text-muted-foreground')}>
            {detail}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
