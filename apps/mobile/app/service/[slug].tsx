import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Screen, Section } from '@/components/screen';
import { CityChips } from '@/components/fixit/city-picker';
import { ProCard } from '@/components/fixit/pro-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Toggle } from '@/components/ui/toggle';
import { CORE_CATEGORIES, categoryName, searchPros } from '@/lib/fixit';
import { useChosenCity } from '@/lib/city';
import type { AvailabilityFilter } from '@/lib/fixit-live-availability';
import { cn } from '@/lib/utils';

const FILTERS: { key: AvailabilityFilter | 'all'; label: string }[] = [
  { key: 'all', label: 'Anyone' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'emergency', label: 'Emergency' },
];

/** All the pros offering one service in the chosen city, best available first. */
export default function ServicePage() {
  const { slug = 'plumbing', city: cityParam } = useLocalSearchParams<{ slug?: string; city?: string }>();
  const chosen = useChosenCity();
  const [picked, setPicked] = useState<string | null>(null);
  const city = picked ?? (cityParam && chosen.options.includes(cityParam) ? cityParam : chosen.city);
  const [when, setWhen] = useState<AvailabilityFilter | 'all'>('all');
  const [page, setPage] = useState(1);

  const result = useQuery({
    queryKey: ['pros', 'category', slug, city, when, page],
    enabled: city !== null,
    placeholderData: keepPreviousData,
    queryFn: () => searchPros({ categorySlug: slug, city: city ?? undefined }, { page, when }),
  });
  const data = result.data;

  const changeCity = (label: string) => {
    setPicked(label);
    chosen.choose(label);
    setPage(1);
  };

  return (
    <Screen back title={categoryName(slug) + ' services'}>
      <View className="gap-3">
        <CityChips city={city} options={chosen.options} onChange={changeCity} />
        <View className="flex-row flex-wrap gap-2">
          {FILTERS.map(filter => {
            const count = data ? (filter.key === 'all' ? data.matched : data.counts[filter.key]) : null;
            const on = when === filter.key;
            return (
              <Toggle
                key={filter.key}
                variant="outline"
                size="sm"
                pressed={on}
                onPressedChange={() => { setWhen(filter.key); setPage(1); }}
                className={cn(on && 'bg-primary border-primary')}>
                <Text className={cn(on && 'text-primary-foreground')}>
                  {filter.label + (count !== null ? ' (' + count + ')' : '')}
                </Text>
              </Toggle>
            );
          })}
        </View>
      </View>

      {result.isPending || city === null ? (
        <View className="gap-3">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </View>
      ) : result.isError ? (
        <Card className="py-5">
          <CardContent className="gap-3 px-5">
            <Text className="text-muted-foreground text-sm">We could not load these professionals.</Text>
            <Button variant="outline" onPress={() => void result.refetch()}><Text>Try again</Text></Button>
          </CardContent>
        </Card>
      ) : !data || data.matched === 0 ? (
        /* Nobody offers this service in this city yet. */
        <Empty>
          <EmptyMedia>
            <View className="bg-muted rounded-full px-3 py-1">
              <Text className="text-muted-foreground text-[11px] font-bold uppercase tracking-wide">Coming soon</Text>
            </View>
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{categoryName(slug)} is not available in {city} yet</EmptyTitle>
            <EmptyDescription>
              We are still signing up trusted {categoryName(slug).toLowerCase()} professionals here. Tell us what you
              need and we will match you as soon as one joins. Asking costs nothing.
            </EmptyDescription>
          </EmptyHeader>
          <Button onPress={() => router.push({ pathname: '/request', params: { service: slug } })}>
            <Text>Notify me when it is available</Text>
          </Button>
        </Empty>
      ) : data.pros.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nobody matches that time</EmptyTitle>
            <EmptyDescription>Try Anyone to see every {categoryName(slug).toLowerCase()} professional in {city}.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Section title={data.total + ' professional' + (data.total === 1 ? '' : 's') + ' in ' + city}>
          <View className="gap-4">
            {data.pros.map(pro => (
              <ProCard key={pro.id} pro={pro} />
            ))}
            {data.hasMore ? (
              <Button variant="outline" onPress={() => setPage(current => current + 1)}>
                <Text>Show more</Text>
              </Button>
            ) : null}
          </View>
        </Section>
      )}

      <Section title="Switch service">
        <View className="flex-row flex-wrap gap-2">
          {CORE_CATEGORIES.map(category => (
            <Toggle
              key={category.slug}
              variant="outline"
              size="sm"
              pressed={category.slug === slug}
              onPressedChange={() => router.replace({ pathname: '/service/[slug]', params: city ? { slug: category.slug, city } : { slug: category.slug } })}
              className={cn(category.slug === slug && 'bg-primary border-primary')}>
              <Text className={cn(category.slug === slug && 'text-primary-foreground')}>{category.name}</Text>
            </Toggle>
          ))}
        </View>
      </Section>
    </Screen>
  );
}
