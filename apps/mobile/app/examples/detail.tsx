import { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Heart, Play, Salad, Share as ShareIcon } from 'lucide-react-native';
import { withUniwind } from 'uniwind';
import { goBack } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { recipes } from '@/lib/sample-data';

const SafeAreaView = withUniwind(NativeSafeAreaView);
const steps = ['Rinse the quinoa and simmer it for 15 minutes.', 'Blend herbs, lemon and yogurt into a dressing.', 'Slice the avocado and toss everything together.'];

export default function DetailPage() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const recipe = recipes.find(item => item.id === id) ?? recipes[0]!;
  const [tab, setTab] = useState('ingredients'), [checked, setChecked] = useState<string[]>([]), [saved, setSaved] = useState(false);
  const toggle = (name: string) => setChecked(list => list.includes(name) ? list.filter(item => item !== name) : [...list, name]);
  return (
    <View className="bg-background flex-1">
      <View className="bg-muted absolute inset-x-0 top-0 h-72 items-center justify-center">
        <Icon as={Salad} className="text-foreground/40 size-24" />
      </View>
      {/* SafeAreaView pads only its edges; the bar's own padding sits on an inner view. */}
      <SafeAreaView edges={['top']} className="absolute inset-x-0 top-0 z-10">
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Button variant="secondary" size="icon" accessibilityLabel="Go back" onPress={goBack}><Icon as={ChevronLeft} className="size-5" /></Button>
          <View className="flex-row gap-2">
            <Button variant="secondary" size="icon" accessibilityLabel="Share" onPress={() => void Share.share({ message: recipe.title }).catch(() => undefined)}><Icon as={ShareIcon} className="size-5" /></Button>
            <Button variant="secondary" size="icon" accessibilityLabel={saved ? 'Remove from saved' : 'Save'} onPress={() => setSaved(value => !value)}>
              <Icon as={Heart} fill={saved ? 'currentColor' : 'none'} className={saved ? 'text-destructive size-5' : 'size-5'} />
            </Button>
          </View>
        </View>
      </SafeAreaView>
      <ScrollView className="flex-1" contentContainerClassName="pt-64">
        <View className="bg-background min-h-full gap-5 rounded-t-4xl px-5 pb-8 pt-6">
          <View className="gap-2">
            <View className="flex-row flex-wrap gap-1.5">
              {recipe.tags.map(tag => <Badge key={tag} variant="secondary"><Text>{tag}</Text></Badge>)}
              <Badge variant="outline"><Text>Easy</Text></Badge>
            </View>
            <Text role="heading" className="text-2xl font-semibold tracking-tight">{recipe.title}</Text>
            <Text className="text-muted-foreground text-sm">{recipe.description}</Text>
          </View>
          <View className="border-border flex-row rounded-2xl border py-3">
            {[[`${recipe.minutes} min`, 'Time'], [String(recipe.kcal), 'kcal'], ['2', 'Servings']].map(([value, label], index) => (
              <View key={label} className={index > 0 ? 'border-border flex-1 items-center border-l' : 'flex-1 items-center'}>
                <Text className="text-base font-semibold">{value}</Text>
                <Text className="text-muted-foreground text-xs">{label}</Text>
              </View>
            ))}
          </View>
          <Tabs value={tab} onValueChange={setTab} className="gap-3">
            <TabsList className="w-full">
              <TabsTrigger value="ingredients"><Text>Ingredients</Text></TabsTrigger>
              <TabsTrigger value="steps"><Text>Steps</Text></TabsTrigger>
            </TabsList>
            <TabsContent value="ingredients">
              {recipe.ingredients.map(([name, amount]) => (
                <View key={name} className="flex-row items-center gap-3 py-2.5">
                  <Checkbox checked={checked.includes(name)} onCheckedChange={() => toggle(name)} accessibilityLabel={name} />
                  <Text className="flex-1 text-[15px]" onPress={() => toggle(name)}>{name}</Text>
                  <Text className="text-muted-foreground text-sm">{amount}</Text>
                </View>
              ))}
            </TabsContent>
            <TabsContent value="steps" className="gap-3">
              {steps.map((step, index) => (
                <View key={step} className="flex-row gap-3">
                  <View className="bg-muted size-7 items-center justify-center rounded-full"><Text className="text-sm font-medium">{index + 1}</Text></View>
                  <Text className="flex-1 text-[15px] leading-6">{step}</Text>
                </View>
              ))}
            </TabsContent>
          </Tabs>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']} className="border-border bg-background border-t">
        <View className="px-5 pb-2 pt-3">
          <Button size="lg" className="w-full" onPress={() => setTab('steps')}>
            <Icon as={Play} className="size-4" />
            <Text>Start cooking</Text>
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}
