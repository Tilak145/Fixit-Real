import { View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

// Sample content for the illustration: a glimpse of what the app does.
const tasks: [label: string, done: boolean][] = [
  ['Morning walk', true],
  ['Read 20 pages', true],
  ['Drink water', true],
  ['Stretch for 10 min', false],
];

function TaskRow({ label, done }: { label: string; done: boolean }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View className={cn('size-5 items-center justify-center rounded-[6px]', done ? 'bg-primary' : 'border-input border')}>
        {done ? <Icon as={Check} className="text-primary-foreground size-3.5" /> : null}
      </View>
      <Text className={cn('text-sm', done && 'text-muted-foreground line-through')}>{label}</Text>
    </View>
  );
}

/** First launch: what the app does in one picture, then sign up or sign in. */
export default function OnboardingPage({ edges }: { edges?: Edge[] }) {
  return (
    <Screen
      edges={edges}
      className="grow gap-0 px-0 pb-10 pt-0"
      header={
        <View className="flex-row justify-end px-3 pt-1">
          <Button variant="ghost" onPress={() => router.push('/examples/sign-in')}>
            <Text className="text-muted-foreground">Skip</Text>
          </Button>
        </View>
      }>
      <View aria-hidden className="bg-muted mx-5 mt-2 h-[360px] items-center justify-center overflow-hidden rounded-4xl">
        <Card className="absolute h-[150px] w-56 translate-x-6 -translate-y-8 rotate-6 opacity-70" />
        <Card className="w-60 gap-3 py-4 shadow-xl">
          <CardContent className="gap-3 px-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-medium">Today</Text>
              <Badge variant="secondary"><Text>3 of 4</Text></Badge>
            </View>
            {tasks.map(([label, done]) => <TaskRow key={label} label={label} done={done} />)}
          </CardContent>
        </Card>
      </View>

      <View className="flex-1 px-6 pt-8">
        <View aria-hidden className="flex-row gap-1.5">
          <View className="bg-primary h-1.5 w-6 rounded-full" />
          <View className="bg-muted-foreground/30 size-1.5 rounded-full" />
          <View className="bg-muted-foreground/30 size-1.5 rounded-full" />
        </View>
        <Text role="heading" className="mt-5 text-3xl font-semibold tracking-tight">{'Small steps,\nevery day'}</Text>
        <Text className="text-muted-foreground mt-3 text-base">Plan your day, check things off and see how far you have come.</Text>
        <View className="mt-auto gap-2 pt-6">
          <Button className="w-full" onPress={() => router.push('/examples/sign-up')}>
            <Text className="text-base">Get started</Text>
          </Button>
          <Button variant="ghost" className="w-full" onPress={() => router.push('/examples/sign-in')}>
            <Text className="text-base">I already have an account</Text>
          </Button>
        </View>
      </View>
    </Screen>
  );
}
