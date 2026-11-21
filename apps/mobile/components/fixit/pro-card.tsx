import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { BadgeCheck, MapPin, Star } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ProSummary } from '@/lib/fixit';
import {
  availabilityLabel,
  availabilityState,
  type AvailabilityFacts,
} from '@/lib/fixit-live-availability';
import { proPhoto } from '@/lib/pro-photo';
import { cn } from '@/lib/utils';

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

/** The availability facts a card needs, read from the pro it shows. */
export function factsOf(pro: ProSummary): AvailabilityFacts {
  return {
    // Absent means the row was not loaded with the field; default to on so a
    // missing value never quietly hides a working professional.
    acceptingWork: pro.acceptingWork ?? true,
    acceptsEmergency: Boolean(pro.acceptsEmergency),
    windows: pro.hours ?? [],
  };
}

/** What a card says about whether the pro can help now. It claims only what the schedule supports. */
export function AvailabilityBadge({ pro, className }: { pro: ProSummary; className?: string }) {
  const facts = factsOf(pro);
  const state = availabilityState(facts, new Date());
  const tone = state === 'available' ? 'bg-[#2E9E4F]' : state === 'open-later' ? 'bg-[#B26A00]' : 'bg-[#4A5568]';
  return (
    <View className={cn('rounded-md px-2.5 py-1', tone, className)}>
      <Text className="text-[11.5px] font-bold text-white">{availabilityLabel(facts, new Date())}</Text>
    </View>
  );
}

/** A professional's logo, shown whole (never cropped) on a plain background. */
export function ProLogo({ pro, background = 'bg-white' }: { pro: ProSummary; background?: string }) {
  const photo = proPhoto(pro.logo_url);
  const initials = pro.business_name.slice(0, 2).toUpperCase();
  return (
    <View className={cn('h-full w-full items-center justify-center', background)}>
      {photo ? (
        <View className="h-full w-full p-3">
          <Image source={photo} alt={pro.business_name} className="h-full w-full" resizeMode="contain" />
        </View>
      ) : (
        <Text className="text-primary/40 text-3xl font-bold">{initials}</Text>
      )}
    </View>
  );
}

/** A professional as a compact row on the customer's list: logo left, facts right, the whole row opens the profile. */
export function ProCard({ pro }: { pro: ProSummary }) {
  const open = () => router.push({ pathname: '/pro/[id]', params: { id: pro.id } });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'View ' + pro.business_name}
      onPress={open}
      className="bg-card border-border flex-row gap-3.5 rounded-3xl border p-3 active:opacity-90">
      <View className="bg-muted size-[92px] overflow-hidden rounded-2xl">
        <ProLogo pro={pro} background="bg-muted" />
      </View>
      <View className="flex-1 justify-between py-0.5">
        <View className="gap-1">
          <View className="flex-row items-center gap-1.5">
            <Text numberOfLines={2} className="flex-1 text-[16px] font-semibold leading-5">{pro.business_name}</Text>
            {pro.verified ? <Icon as={BadgeCheck} className="size-4 text-[#2E9E4F]" /> : null}
          </View>
          {pro.review_count > 0 ? (
            <View className="flex-row items-center gap-1.5">
              <Stars rating={pro.rating} className="size-3" />
              <Text className="text-[12.5px] font-semibold">{pro.rating.toFixed(1)}</Text>
              <Text className="text-muted-foreground text-[12px]">({pro.review_count})</Text>
            </View>
          ) : (
            <Text className="text-muted-foreground text-[12px] font-semibold">New on FixIt</Text>
          )}
          <View className="flex-row items-center gap-1">
            <Icon as={MapPin} className="text-muted-foreground size-3" />
            <Text numberOfLines={1} className="text-muted-foreground flex-1 text-[12px]">{pro.city}</Text>
          </View>
        </View>
        <AvailabilityBadge pro={pro} className="mt-1.5 self-start" />
      </View>
    </Pressable>
  );
}
/**
 * A featured business on the home screen: its logo large on a warm background, a
 * "Featured" badge, and the whole card opens the profile. Featured spots are paid
 * placements, and the screen says so.
 */
export function FeaturedProCard({ pro }: { pro: ProSummary }) {
  const open = () => router.push({ pathname: '/pro/[id]', params: { id: pro.id } });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Featured: ' + pro.business_name}
      onPress={open}
      className="overflow-hidden rounded-2xl border border-[#F2D9A6] bg-card active:opacity-90">
      <View className="h-40 w-full">
        <ProLogo pro={pro} background="bg-[#FFFAF0]" />
        <View className="absolute left-3 top-3 rounded-full bg-[#B26A00] px-2.5 py-1">
          <Text className="text-[11px] font-bold uppercase tracking-wide text-white">Featured</Text>
        </View>
      </View>
      <View className="gap-1.5 p-4">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={2} className="flex-1 text-[17px] font-semibold">{pro.business_name}</Text>
          {pro.verified ? <Icon as={BadgeCheck} className="size-4 text-[#1D9BF0]" /> : null}
        </View>
        {pro.review_count > 0 ? (
          <View className="flex-row items-center gap-2">
            <Stars rating={pro.rating} />
            <Text className="text-sm font-semibold">{pro.rating.toFixed(1)}</Text>
            <Text className="text-muted-foreground text-[13px]">({pro.review_count})</Text>
          </View>
        ) : (
          <Text className="text-muted-foreground text-[13px] font-semibold">New on FixIt · No reviews yet</Text>
        )}
        <View className="flex-row items-center justify-between gap-2 pt-1">
          <View className="flex-1 flex-row items-center gap-1.5">
            <Icon as={MapPin} className="text-accent size-3.5" />
            <Text numberOfLines={1} className="text-muted-foreground flex-1 text-[13px]">{pro.city}</Text>
          </View>
          <AvailabilityBadge pro={pro} />
        </View>
      </View>
    </Pressable>
  );
}
