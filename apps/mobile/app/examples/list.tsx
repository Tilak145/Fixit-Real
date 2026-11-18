import { Fragment, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Croissant, Egg, Heart, Plus, Salad, Search, SlidersHorizontal, Soup, type LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Text } from '@/components/ui/text';
import { Toggle } from '@/components/ui/toggle';
import { recipeCategories, recipes } from '@/lib/sample-data';
import { cn } from '@/lib/utils';

const art: Record<string, LucideIcon> = { 'green-bowl': Salad, shakshuka: Egg, 'miso-ramen': Soup, croissants: Croissant };

export default function ListPage({ edges }: { edges?: Edge[] }) {
  const [query, setQuery] = useState(''), [category, setCategory] = useState('All');
  const [saved, setSaved] = useState<string[]>([]);
  const shown = recipes.filter(recipe =>
    (category === 'All' || recipe.tags.includes(category)) && recipe.title.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Screen
      edges={edges}
      title="Recipes"
      action={<Button size="icon" accessibilityLabel="New recipe" onPress={() => router.push('/examples/create')}><Icon as={Plus} className="text-primary-foreground size-5" /></Button>}>
      <View className="gap-3">
        <InputGroup>
          <InputGroupAddon><Icon as={Search} className="text-muted-foreground size-4" /></InputGroupAddon>
          <InputGroupInput placeholder="Search recipes" value={query} onChangeText={setQuery} accessibilityLabel="Search recipes" />
          <InputGroupAddon align="inline-end">
            <Button variant="ghost" size="icon-sm" accessibilityLabel="Filters" onPress={() => router.push('/examples/search')}><Icon as={SlidersHorizontal} className="size-4" /></Button>
          </InputGroupAddon>
        </InputGroup>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {recipeCategories.map(name => (
            <Toggle key={name} variant="outline" size="sm" pressed={category === name} onPressedChange={() => setCategory(name)}
              className={cn(category === name && 'bg-primary border-primary')}>
              <Text className={cn(category === name && 'text-primary-foreground')}>{name}</Text>
            </Toggle>
          ))}
        </ScrollView>
      </View>

      {shown.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No recipes found</EmptyTitle>
            <EmptyDescription>Try another word or category.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <View>
          {shown.map((recipe, index) => (
            <Fragment key={recipe.id}>
              {index > 0 ? <ItemSeparator /> : null}
              <Item size="sm" className="px-0" onPress={() => router.push({ pathname: '/examples/detail', params: { id: recipe.id } })}>
                <ItemMedia className="bg-muted size-16 rounded-xl">
                  <Icon as={art[recipe.id] ?? Salad} className="size-6" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{recipe.title}</ItemTitle>
                  <ItemDescription>{recipe.minutes} min · {recipe.kcal} kcal</ItemDescription>
                  <View className="mt-1 flex-row gap-1.5">
                    {recipe.tags.map(tag => <Badge key={tag} variant={tag === 'New' ? 'outline' : 'secondary'}><Text>{tag}</Text></Badge>)}
                  </View>
                </ItemContent>
                <ItemActions>
                  <Button variant="ghost" size="icon-sm" accessibilityLabel={saved.includes(recipe.id) ? `Remove ${recipe.title} from saved` : `Save ${recipe.title}`}
                    onPress={() => setSaved(list => list.includes(recipe.id) ? list.filter(id => id !== recipe.id) : [...list, recipe.id])}>
                    <Icon as={Heart} fill={saved.includes(recipe.id) ? 'currentColor' : 'none'} className={cn('size-5', saved.includes(recipe.id) && 'text-destructive')} />
                  </Button>
                </ItemActions>
              </Item>
            </Fragment>
          ))}
        </View>
      )}
    </Screen>
  );
}
