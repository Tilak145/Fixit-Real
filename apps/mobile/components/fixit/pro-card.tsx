import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { BadgeCheck, MapPin, Star } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ProSummary } from '@/lib/fixit';
import { proPhoto } from '@/lib/pro-photo';

export function Stars({ rating, className = 'size-3.5' }: { rating: number; className?: string }) {
  const full = Math.round(rating);
  return (
    <View className="flex-row gap-0.5" accessibilityLabel={'Rated ' + rating + ' out of 5'}>
      {[0, 1, 2, 3, 4].map(index => (
        <Icon
          key={index}
          as={Star}
          className={className}
          fill={index < full ? 'currentColor' : 'none'}
          color={index < full ? '#F5A623' : '#E3E8EF'}
        />
      ))}
    </View>
  );
}

/** A professional as a card on the customer's list. */
export function ProCard({ pro }: { pro: ProSummary }) {
  const open = () => router.push({ pathname: '/pro/[id]', params: { id: pro.id } });
  const initials = pro.business_name.slice(0, 2).toUpperCase();
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <View className="bg-muted h-40 w-full">
        {proPhoto(pro.logo_url) ? (
          <Image source={proPhoto(pro.logo_url)!} alt={pro.business_name} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-primary/40 text-3xl font-bold">{initials}</Text>
          </View>
        )}
      </View>
      <View className="gap-2.5 p-4">
        <View className="gap-1">
          <Text className="text-[17px] font-semibold">{pro.business_name}</Text>
          <View className="flex-row items-center gap-2">
            <Stars rating={pro.rating} />
            <Text className="text-sm font-semibold">{pro.rating.toFixed(1)}</Text>
            <Text className="text-muted-foreground text-[13px]">({pro.review_count})</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Icon as={MapPin} className="text-accent size-3.5" />
          <Text numberOfLines={1} className="text-muted-foreground flex-1 text-[13px]">{pro.city}</Text>
          <View className="flex-row items-center gap-1">
            <Icon as={BadgeCheck} className="size-3.5 text-[#2E9E4F]" />
            <Text className="text-[11px] font-semibold text-[#2E9E4F]">Verified</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel={'View ' + pro.business_name}
          onPress={open}
          className="bg-primary h-11 items-center justify-center rounded-full active:bg-primary/80">
          <Text className="text-primary-foreground text-sm font-semibold">View Profile</Text>
        </Pressable>
      </View>
    </Card>
  );
}
