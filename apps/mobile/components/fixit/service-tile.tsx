import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { categoryIcon } from '@/lib/category-icons';
import { cn } from '@/lib/utils';

/**
 * One service category in the home grid. A service nobody offers yet is shown
 * as coming soon and does not open a list of professionals.
 */
export function ServiceTile({
  slug,
  name,
  width,
  available = true,
}: {
  slug: string;
  name: string;
  width: number;
  available?: boolean;
}) {
  if (!available) {
    return (
      <View
        accessibilityLabel={name + ' is coming soon'}
        accessibilityState={{ disabled: true }}
        style={{ width }}
        className="border-border bg-card/60 items-center gap-2 rounded-2xl border border-dashed px-2 pb-3.5 pt-4">
        <Icon as={categoryIcon(slug)} className="text-muted-foreground/50 size-8" />
        <Text numberOfLines={2} className="text-muted-foreground text-center text-[12.5px] font-semibold">{name}</Text>
        <View className="bg-muted rounded-full px-2 py-0.5">
          <Text className="text-muted-foreground text-[9.5px] font-bold uppercase tracking-wide">Coming soon</Text>
        </View>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityLabel={'Get quotes for ' + name}
      onPress={() => router.push({ pathname: '/service/[slug]', params: { slug } })}
      style={{ width }}
      className={cn('border-border bg-card items-center gap-2 rounded-2xl border px-2 pb-3.5 pt-4 active:bg-muted')}>
      <Icon as={categoryIcon(slug)} className="text-primary size-8" />
      <Text numberOfLines={2} className="text-center text-[12.5px] font-semibold">{name}</Text>
    </Pressable>
  );
}
