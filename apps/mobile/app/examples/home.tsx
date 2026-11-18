import { useState } from 'react';
import { View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check, Dumbbell, Flame, GlassWater, NotebookPen, type LucideIcon } from 'lucide-react-native';
import { Screen, Section } from '@/components/screen';
import { ProgressRing } from '@/components/progress-ring';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { todayTasks } from '@/lib/sample-data';
import { cn } from '@/lib/utils';

const quickActions: [string, LucideIcon][] = [['Log water', GlassWater], ['Workout', Dumbbell], ['Journal', NotebookPen]];

export default function HomePage({ edges }: { edges?: Edge[] }) {
  const [tasks, setTasks] = useState(todayTasks);
  const done = tasks.filter(task => task.done).length;
  const toggle = (id: string) => setTasks(list => list.map(task => task.id === id ? { ...task, done: !task.done } : task));
  return (
    <Screen
      edges={edges}
      header={
        <View className="flex-row items-center justify-between px-5 pb-4 pt-2">
          <View className="gap-0.5">
            <Text className="text-muted-foreground text-sm">Thursday, Oct 15</Text>
            <Text role="heading" className="text-2xl font-semibold tracking-tight">Good morning, Jordan</Text>
          </View>
          <Button variant="ghost" size="icon-lg" accessibilityLabel="Your profile" onPress={() => router.push('/examples/profile')}>
            <Avatar alt="Jordan Lee"><AvatarFallback><Text className="text-sm">JL</Text></AvatarFallback></Avatar>
          </Button>
        </View>
      }>
      <Card className="py-5">
        <CardContent className="flex-row items-center gap-5 px-5">
          <ProgressRing value={(done / tasks.length) * 100} />
          <View className="flex-1 gap-1">
            <Text className="text-base font-medium">{done} of {tasks.length} done today</Text>
            <Text className="text-muted-foreground text-sm">One more to keep your 12-day streak.</Text>
            <View className="mt-1.5 flex-row items-center gap-1">
              <Icon as={Flame} className="size-4" />
              <Text className="text-sm font-medium">12-day streak</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      <View className="flex-row gap-2">
        {quickActions.map(([label, icon]) => (
          <Button key={label} variant="outline" className="h-auto flex-1 flex-col gap-1.5 rounded-2xl py-3" onPress={() => router.push('/examples/create')}>
            <Icon as={icon} className="size-5" />
            <Text className="text-xs">{label}</Text>
          </Button>
        ))}
      </View>

      <Section title="Today" action={<Button variant="link" size="sm" className="h-auto px-0" onPress={() => router.push('/examples/list')}><Text className="text-muted-foreground">See all</Text></Button>}>
        <View className="gap-2">
          {tasks.map(task => (
            <Item key={task.id} variant="outline" size="sm" onPress={() => toggle(task.id)} accessibilityLabel={`${task.title}, ${task.done ? 'done' : 'not done'}`}>
              <View className={cn('size-5 items-center justify-center rounded-[6px] border', task.done ? 'bg-primary border-primary' : 'border-input')}>
                {task.done ? <Icon as={Check} className="text-primary-foreground size-3.5" /> : null}
              </View>
              <ItemContent>
                <ItemTitle className={cn(task.done && 'text-muted-foreground line-through')}>{task.title}</ItemTitle>
                <ItemDescription>{task.detail}</ItemDescription>
              </ItemContent>
              {task.progress !== undefined && !task.done ? <ItemActions><Progress value={task.progress} className="h-2 w-16" /></ItemActions> : null}
            </Item>
          ))}
        </View>
      </Section>
    </Screen>
  );
}
