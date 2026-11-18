import { useState } from 'react';
import { View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowUpLeft, CircleX, Cookie, Croissant, Egg, History, Salad, Search, Soup, Utensils, type LucideIcon } from 'lucide-react-native';
import { Screen, goBack } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Text } from '@/components/ui/text';
import { recipes } from '@/lib/sample-data';

type Result = { id: string; title: string; detail: string; icon: LucideIcon };

const recipeIcons: Record<string, LucideIcon> = { 'green-bowl': Salad, shakshuka: Egg, 'miso-ramen': Soup, croissants: Croissant };

// Sample content: a real screen searches its own storage or the project backend.
const searchable: Result[] = [
  { id: 'pasta-e-fagioli', title: 'Pasta e fagioli', detail: '40 min · Dinner', icon: Utensils },
  { id: 'lemon-pasta', title: 'Lemon pasta', detail: '20 min · Lunch', icon: Utensils },
  { id: 'pastry-cream', title: 'Pastry cream', detail: '35 min · Baking', icon: Cookie },
  ...recipes.map(recipe => ({
    id: recipe.id,
    title: recipe.title,
    detail: `${recipe.minutes} min · ${recipe.tags[0] ?? 'Recipe'}`,
    icon: recipeIcons[recipe.id] ?? Utensils,
  })),
];
const popular = ['Meal prep', 'High protein', 'One pot', 'Soups', 'Desserts'];

function SectionLabel({ children }: { children: string }) {
  return <Text role="heading" className="text-muted-foreground px-1 text-sm font-medium">{children}</Text>;
}

/** A title with the matching part in bold, like "Pas" in "Pasta e fagioli". */
function Highlighted({ text, query }: { text: string; query: string }) {
  const start = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (start < 0) return <>{text}</>;
  const end = start + query.length;
  return (
    <>
      {text.slice(0, start)}
      <Text className="text-[15px] font-semibold leading-snug">{text.slice(start, end)}</Text>
      {text.slice(end)}
    </>
  );
}

export default function SearchPage({ edges }: { edges?: Edge[] }) {
  const [query, setQuery] = useState('pas');
  const [recent, setRecent] = useState(['quick dinner', 'vegetarian', 'under 30 min']);
  const needle = query.trim();
  const results = needle ? searchable.filter(result => result.title.toLowerCase().includes(needle.toLowerCase())) : [];

  const remember = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setRecent(list => [value, ...list.filter(entry => entry.toLowerCase() !== value.toLowerCase())].slice(0, 5));
  };

  return (
    <Screen
      edges={edges}
      header={
        <View className="flex-row items-center gap-2 px-5 pb-4 pt-2">
          <InputGroup className="flex-1">
            <InputGroupAddon>
              <Icon as={Search} className="text-muted-foreground size-4" />
            </InputGroupAddon>
            <InputGroupInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => remember(query)}
              placeholder="Search recipes"
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search recipes"
            />
            {query.length > 0 ? (
              <InputGroupAddon align="inline-end">
                <Button variant="ghost" size="icon-sm" accessibilityLabel="Clear search" onPress={() => setQuery('')}>
                  <Icon as={CircleX} className="text-muted-foreground size-4" />
                </Button>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <Button variant="ghost" className="px-2" onPress={goBack}>
            <Text>Cancel</Text>
          </Button>
        </View>
      }>
      {needle ? (
        <View className="gap-1">
          <View className="pb-1">
            <SectionLabel>Recipes</SectionLabel>
          </View>
          {results.length > 0 ? (
            results.map(result => (
              <Item
                key={result.id}
                size="sm"
                className="px-1"
                accessibilityLabel={`${result.title}, ${result.detail}`}
                onPress={() => {
                  remember(needle);
                  router.push({ pathname: '/examples/detail', params: { id: result.id } });
                }}>
                <ItemMedia className="bg-muted size-10 rounded-lg">
                  <Icon as={result.icon} className="size-5" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle><Highlighted text={result.title} query={needle} /></ItemTitle>
                  <ItemDescription>{result.detail}</ItemDescription>
                </ItemContent>
              </Item>
            ))
          ) : (
            <Empty className="flex-none py-6">
              <EmptyHeader>
                <EmptyTitle>No recipes found</EmptyTitle>
                <EmptyDescription>Try another word.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </View>
      ) : null}

      {recent.length > 0 ? (
        <View className="gap-1">
          <View className="flex-row items-center justify-between pb-1">
            <SectionLabel>Recent</SectionLabel>
            <Button variant="link" size="sm" className="h-auto px-0" onPress={() => setRecent([])}>
              <Text className="text-muted-foreground">Clear</Text>
            </Button>
          </View>
          {recent.map(text => (
            <Item key={text} size="xs" className="gap-3 px-1" accessibilityLabel={`Search for ${text}`} onPress={() => setQuery(text)}>
              <Icon as={History} className="text-muted-foreground size-5" />
              <ItemContent>
                <ItemTitle className="font-normal">{text}</ItemTitle>
              </ItemContent>
              <Icon as={ArrowUpLeft} className="text-muted-foreground size-5" />
            </Item>
          ))}
        </View>
      ) : null}

      <View className="gap-3">
        <SectionLabel>Popular</SectionLabel>
        <View className="flex-row flex-wrap gap-2">
          {popular.map(tag => (
            <Button key={tag} variant="outline" size="sm" className="h-8 bg-transparent px-3" accessibilityLabel={`Search for ${tag}`} onPress={() => setQuery(tag)}>
              <Text className="text-sm">{tag}</Text>
            </Button>
          ))}
        </View>
      </View>
    </Screen>
  );
}
