import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { Screen, Section } from '@/components/screen';
import { ProCard } from '@/components/fixit/pro-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Toggle } from '@/components/ui/toggle';
import { CORE_CATEGORIES, categoryName, listPros } from '@/lib/fixit';
import { cn } from '@/lib/utils';

/** All the pros offering one service, with an optional city filter. */
export default function ServicePage() {
  const { slug = 'plumbing' } = useLocalSearchParams<{ slug?: string }>();
  const [city, setCity] = useState('');
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const pros = useQuery({
    queryKey: ['pros', 'category', slug, activeCity],
    queryFn: () => listPros({ categorySlug: slug, city: activeCity ?? undefined }),
  });
  const cities = Array.from(new Set((pros.data ?? []).flatMap(pro => pro.areas))).slice(0, 6);
  const applyFilter = () => setActiveCity(city.trim() || null);

  return (
    <Screen back title={categoryName(slug) + ' services'}>
      <View className="gap-3">
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <Icon as={Search} className="text-muted-foreground size-4" />
          </InputGroupAddon>
          <InputGroupInput
            value={city}
            onChangeText={setCity}
            onSubmitEditing={applyFilter}
            returnKeyType="search"
            placeholder="Filter by city"
            accessibilityLabel="Filter by city"
          />
          <InputGroupAddon align="inline-end">
            <Button variant="ghost" size="icon-sm" accessibilityLabel="Apply city filter" onPress={applyFilter}>
              <Icon as={SlidersHorizontal} className="size-4" />
            </Button>
          </InputGroupAddon>
        </InputGroup>

        <View className="flex-row flex-wrap gap-2">
          <Toggle
            variant="outline"
            size="sm"
            pressed={activeCity === null}
            onPressedChange={() => { setActiveCity(null); setCity(''); }}
            className={cn(activeCity === null && 'bg-primary border-primary')}>
            <Text className={cn(activeCity === null && 'text-primary-foreground')}>All cities</Text>
          </Toggle>
          {cities.map(name => (
            <Toggle
              key={name}
              variant="outline"
              size="sm"
              pressed={activeCity === name}
              onPressedChange={() => { setActiveCity(name); setCity(name); }}
              className={cn(activeCity === name && 'bg-primary border-primary')}>
              <Text className={cn(activeCity === name && 'text-primary-foreground')}>{name}</Text>
            </Toggle>
          ))}
        </View>
      </View>

      {pros.isPending ? (
        <View className="gap-3">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </View>
      ) : pros.isError ? (
        <Card className="py-5">
          <CardContent className="gap-3 px-5">
            <Text className="text-muted-foreground text-sm">We could not load these professionals.</Text>
            <Button variant="outline" onPress={() => void pros.refetch()}><Text>Try again</Text></Button>
          </CardContent>
        </Card>
      ) : pros.data.length === 0 ? (
        /* Nobody offers this service in this area yet, so it is not bookable. */
        <Empty>
          <EmptyMedia>
            <View className="bg-muted rounded-full px-3 py-1">
              <Text className="text-muted-foreground text-[11px] font-bold uppercase tracking-wide">Coming soon</Text>
            </View>
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{categoryName(slug)} is not available in your area yet</EmptyTitle>
            <EmptyDescription>
              We are still signing up trusted {categoryName(slug).toLowerCase()} professionals here. Tell us what you
              need and we will match you as soon as one joins — asking costs nothing.
            </EmptyDescription>
          </EmptyHeader>
          <Button onPress={() => router.push({ pathname: '/request', params: { service: slug } })}>
            <Text>Notify me when it is available</Text>
          </Button>
        </Empty>
      ) : (
        <Section title={pros.data.length + ' professional' + (pros.data.length === 1 ? '' : 's')}>
          <View className="gap-4">
            {pros.data.map(pro => (
              <ProCard key={pro.id} pro={pro} />
            ))}
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
              onPressedChange={() => router.replace({ pathname: '/service/[slug]', params: { slug: category.slug } })}
              className={cn(category.slug === slug && 'bg-primary border-primary')}>
              <Text className={cn(category.slug === slug && 'text-primary-foreground')}>{category.name}</Text>
            </Toggle>
          ))}
        </View>
      </Section>
    </Screen>
  );
}
