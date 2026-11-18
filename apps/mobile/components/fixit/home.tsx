import { useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import type { Edge } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, ClipboardList, Search, ShieldCheck, ThumbsUp, Users, Zap } from 'lucide-react-native';
import { Screen, Section } from '@/components/screen';
import { FixItLogo } from '@/components/fixit/logo';
import { FeaturedProCard, ProCard } from '@/components/fixit/pro-card';
import { ServiceTile } from '@/components/fixit/service-tile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { CityPicker } from '@/components/fixit/city-picker';
import { CORE_CATEGORIES, listCategoryProCounts, listPros } from '@/lib/fixit';
import { featuredSeed, pickFeatured } from '@/lib/featured-pros';
import { useChosenCity } from '@/lib/city';

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

/** The customer's starting point: search, services, featured businesses, how it works and top pros. */
export default function HomePage({ edges }: { edges?: Edge[] }) {
  const { width } = useWindowDimensions();
  const { city, options, choose } = useChosenCity();
  const ready = city !== null;
  // Featured businesses are paid placements, taken from the two top plans.
  const featured = useQuery({
    queryKey: ['pros', 'featured', city],
    enabled: ready,
    refetchInterval: 120_000,
    queryFn: async () => {
      const found = await listPros({ city: city ?? undefined, plans: ['business', 'professional'], paidOnly: true, limit: 60 });
      return pickFeatured(found, { seed: featuredSeed(new Date(), city) });
    },
  });
  const pros = useQuery({
    queryKey: ['pros', 'home', city],
    enabled: ready,
    refetchInterval: 120_000,
    queryFn: () => listPros({ city: city ?? undefined, limit: 3 }),
  });
  const counts = useQuery({
    queryKey: ['category-counts', city],
    enabled: ready,
    refetchInterval: 120_000,
    queryFn: () => listCategoryProCounts(city),
  });
  // Three columns with the screen's 20px gutters and a 12px gap.
  const tileWidth = Math.max(100, (width - 40 - 24) / 3);
  const detailFor = (slug: string) => {
    const total = counts.data?.[slug]?.total ?? 0;
    if (!counts.data || total === 0) return null;
    return total + ' local ' + (total === 1 ? 'pro' : 'pros');
  };
  const browse = CORE_CATEGORIES.find(category => (counts.data?.[category.slug]?.total ?? 0) > 0) ?? CORE_CATEGORIES[0];

  return (
    <Screen
      edges={edges}
      header={
        <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
          <FixItLogo />
          <CityPicker city={city} options={options} onChange={choose} />
        </View>
      }>
      {/* Hero */}
      <View className="gap-4 rounded-3xl bg-[#0B2545] p-5">
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
              detail={detailFor(category.slug)}
              city={city}
            />
          ))}
        </View>
      </Section>

      {/* Featured businesses */}
      {featured.data && featured.data.length > 0 ? (
        <Section title="Featured professionals">
          <View className="gap-4">
            {featured.data.map(pro => (
              <FeaturedProCard key={pro.id} pro={pro} />
            ))}
            <Text className="text-muted-foreground text-center text-[11.5px]">Featured spots are paid placements.</Text>
          </View>
        </Section>
      ) : null}
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
        title={city ? "Professionals in " + city : "Professionals near you"}
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-0"
            onPress={() => router.push({ pathname: '/service/[slug]', params: city ? { slug: browse.slug, city } : { slug: browse.slug } })}>
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
          <Button variant="ghost" onPress={() => router.push('/help')}>
            <Text className="text-muted-foreground">Common questions</Text>
          </Button>
        </CardContent>
      </Card>
    </Screen>
  );
}
