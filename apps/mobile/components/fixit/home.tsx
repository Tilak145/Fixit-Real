import { useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import type { Edge } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, ClipboardList, Search, ShieldCheck, ThumbsUp, Users, Zap } from 'lucide-react-native';
import { Screen, Section } from '@/components/screen';
import { FixItLogo } from '@/components/fixit/logo';
import { ProCard } from '@/components/fixit/pro-card';
import { ServiceTile } from '@/components/fixit/service-tile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CORE_CATEGORIES, listCategoryProCounts, listCities, listPros } from '@/lib/fixit';

const trustPoints = [
  { icon: ShieldCheck, label: 'Verified pros' },
  { icon: ThumbsUp, label: 'Real reviews' },
  { icon: Zap, label: 'Fast response' },
];

const steps = [
  { title: 'Tell us what you need', text: 'Describe the problem and where you are.' },
  { title: 'Get matched', text: 'We route it to trusted local professionals.' },
  { title: 'Choose and get it done', text: 'Compare quotes, then hire the best pro.' },
];

/** The customer's starting point: search, services, how it works and top pros. */
export default function HomePage({ edges }: { edges?: Edge[] }) {
  const { width } = useWindowDimensions();
  const pros = useQuery({
    queryKey: ['pros', 'home'],
    queryFn: () => listPros(),
  });
  const counts = useQuery({
    queryKey: ['category-counts'],
    queryFn: () => listCategoryProCounts(),
  });
  // The served area comes from the owner's city list, so the chip follows it
  // rather than naming one hard-coded place.
  const cities = useQuery({ queryKey: ['service-cities'], queryFn: listCities, staleTime: 5 * 60_000 });
  const servedCity = (cities.data ?? []).find(city => city.is_active)?.label ?? null;
  // Two columns with the screen's 20px gutters and a 12px gap.
  const tileWidth = Math.max(140, (width - 40 - 24) / 3);
  // Before the counts arrive, treat every service as bookable so the grid is
  // never greyed out on a slow connection.
  const availableFor = (slug: string) => (counts.data ? (counts.data[slug] ?? 0) > 0 : true);
  const browse = CORE_CATEGORIES.find(category => availableFor(category.slug)) ?? CORE_CATEGORIES[0];

  return (
    <Screen
      edges={edges}
      header={
        <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
          <FixItLogo />
          {servedCity ? (
            <View className="bg-muted h-9 flex-row items-center gap-1.5 rounded-full px-3">
              <Text className="text-muted-foreground text-[12.5px] font-semibold">{servedCity}</Text>
            </View>
          ) : null}
        </View>
      }>
      {/* Hero */}
      <View className="bg-secondary gap-4 rounded-3xl p-5">
        <View className="gap-1.5">
          <Text role="heading" className="text-[26px] font-bold leading-8 text-white">
            Get your home fixed today
          </Text>
          <Text className="text-[14px] leading-5 text-[#DCE6F2]">
            Tell us what is wrong and we will find trusted local pros.
          </Text>
        </View>
        <View className="flex-row gap-2">
          {trustPoints.map(point => (
            <View key={point.label} className="flex-1 items-center gap-1">
              <Icon as={point.icon} className="size-5 text-white" />
              <Text className="text-center text-[11px] font-semibold text-[#DCE6F2]">{point.label}</Text>
            </View>
          ))}
        </View>
        <Button
          size="lg"
          className="bg-accent active:bg-accent/90 w-full"
          accessibilityLabel="Request a free quote"
          onPress={() => router.push('/request')}>
          <Icon as={Search} className="text-accent-foreground size-5" />
          <Text className="text-accent-foreground text-base font-semibold">Find a professional</Text>
        </Button>
      </View>

      {/* Services */}
      <Section title="Popular home services">
        <View className="flex-row flex-wrap gap-3">
          {CORE_CATEGORIES.map(category => (
            <ServiceTile
              key={category.slug}
              slug={category.slug}
              name={category.name}
              width={tileWidth}
              available={availableFor(category.slug)}
            />
          ))}
        </View>
      </Section>

      {/* How it works */}
      <Section title="How FixIt works">
        <Card className="gap-4 py-5">
          <CardContent className="gap-4 px-5">
            {steps.map((step, index) => (
              <View key={step.title} className="flex-row items-start gap-3">
                <View className="bg-primary size-7 items-center justify-center rounded-full">
                  <Text className="text-primary-foreground text-[13px] font-bold">{index + 1}</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-semibold">{step.title}</Text>
                  <Text className="text-muted-foreground text-[13px] leading-5">{step.text}</Text>
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
      </Section>

      {/* Top pros */}
      <Section
        title="Top rated near you"
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0"
            onPress={() => router.push({ pathname: '/service/[slug]', params: { slug: browse.slug } })}>
            <Text className="text-muted-foreground text-sm">See more</Text>
            <Icon as={ChevronRight} className="text-muted-foreground size-4" />
          </Button>
        }>
        {pros.isPending ? (
          <View className="gap-3">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </View>
        ) : pros.isError ? (
          <Card className="py-5">
            <CardContent className="gap-3 px-5">
              <Text className="text-muted-foreground text-sm">
                We could not load professionals right now.
              </Text>
              <Button variant="outline" onPress={() => void pros.refetch()}>
                <Text>Try again</Text>
              </Button>
            </CardContent>
          </Card>
        ) : pros.data.length === 0 ? (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyTitle>No professionals yet</EmptyTitle>
              <EmptyDescription>Professionals in your area will appear here as they join.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <View className="gap-4">
            {pros.data.slice(0, 3).map(pro => (
              <ProCard key={pro.id} pro={pro} />
            ))}
          </View>
        )}
      </Section>

      {/* Customer's own requests */}
      <Card className="gap-3 py-5">
        <CardContent className="gap-3 px-5">
          <View className="flex-row items-center gap-2.5">
            <Icon as={ClipboardList} className="text-primary size-5" />
            <Text className="text-[15px] font-semibold">Already asked for quotes?</Text>
          </View>
          <Text className="text-muted-foreground text-[13px] leading-5">
            Sign in on the Account tab to follow every request you sent from the app or the website.
          </Text>
          <Button variant="outline" onPress={() => router.push('/tabs/requests')}>
            <Icon as={Users} className="size-4" />
            <Text>My requests</Text>
            <Icon as={ArrowRight} className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </Screen>
  );
}
