import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

const groceries = [
  { id: 'milk', label: 'Oat milk' },
  { id: 'bread', label: 'Sourdough bread' },
  { id: 'eggs', label: 'A dozen eggs' },
];
const themes = [
  { value: 'light', title: 'Light', detail: 'Always use the light theme' },
  { value: 'system', title: 'Match device', detail: 'Follow the system setting' },
];
const goals = ['4', '6', '8', '10', '12'];
const MAX_SERVINGS = 12;

export default function SelectionDemo() {
  const [range, setRange] = useState('day');
  const [reminders, setReminders] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [checked, setChecked] = useState(['milk']);
  const [theme, setTheme] = useState('light');
  const [goal, setGoal] = useState('8');
  const [servings, setServings] = useState(2);
  const toggleItem = (id: string) => setChecked(list => (list.includes(id) ? list.filter(entry => entry !== id) : [...list, id]));

  return (
    <Screen back title="Selection" className="gap-7">
      <Tabs value={range} onValueChange={setRange}>
        <TabsList className="h-10 w-full">
          <TabsTrigger value="day"><Text className="text-[15px]">Day</Text></TabsTrigger>
          <TabsTrigger value="week"><Text className="text-[15px]">Week</Text></TabsTrigger>
          <TabsTrigger value="month"><Text className="text-[15px]">Month</Text></TabsTrigger>
        </TabsList>
      </Tabs>

      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel nativeID="demo-reminders" className="text-[15px]" onPress={() => setReminders(value => !value)}>Reminders</FieldLabel>
            <FieldDescription>Every day at 8:00 PM</FieldDescription>
          </FieldContent>
          <Switch checked={reminders} onCheckedChange={setReminders} aria-labelledby="demo-reminders" accessibilityLabel="Reminders" />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel nativeID="demo-report" className="text-[15px]" onPress={() => setWeeklyReport(value => !value)}>Weekly report</FieldLabel>
            <FieldDescription>Sent on Sunday morning</FieldDescription>
          </FieldContent>
          <Switch checked={weeklyReport} onCheckedChange={setWeeklyReport} aria-labelledby="demo-report" accessibilityLabel="Weekly report" />
        </Field>
      </FieldGroup>

      <Separator />

      <View className="gap-4">
        {groceries.map(item => {
          const done = checked.includes(item.id);
          return (
            <Field key={item.id} orientation="horizontal" className="justify-start gap-3">
              <Checkbox checked={done} onCheckedChange={() => toggleItem(item.id)} accessibilityLabel={item.label} />
              <FieldLabel
                nativeID={`demo-${item.id}`}
                className={cn('text-[15px] font-normal', done && 'text-muted-foreground line-through')}
                onPress={() => toggleItem(item.id)}>
                {item.label}
              </FieldLabel>
            </Field>
          );
        })}
      </View>

      <Separator />

      <RadioGroup value={theme} onValueChange={setTheme}>
        {themes.map(option => (
          <Pressable key={option.value} accessible={false} onPress={() => setTheme(option.value)} className="flex-row items-center justify-between gap-4">
            <View className="min-w-0 flex-1 gap-1">
              <Text nativeID={`demo-theme-${option.value}`} className="text-[15px] font-medium">{option.title}</Text>
              <FieldDescription>{option.detail}</FieldDescription>
            </View>
            <RadioGroupItem value={option.value} aria-labelledby={`demo-theme-${option.value}`} accessibilityLabel={option.title} />
          </Pressable>
        ))}
      </RadioGroup>

      <View className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[15px] font-medium">Daily goal</Text>
          <Text className="text-muted-foreground text-sm tabular-nums">{`${goal} glasses`}</Text>
        </View>
        <ToggleGroup type="single" variant="outline" className="w-full" value={goal} onValueChange={next => { if (next) setGoal(next); }}>
          {goals.map((value, index) => (
            <ToggleGroupItem key={value} value={value} isFirst={index === 0} isLast={index === goals.length - 1} className="flex-1" accessibilityLabel={`${value} glasses`}>
              <Text className="tabular-nums">{value}</Text>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-[15px] font-medium">Servings</Text>
        <View className="flex-row">
          <Button variant="outline" size="icon-lg" accessibilityLabel="Fewer servings" className="rounded-r-none" disabled={servings <= 1} onPress={() => setServings(value => value - 1)}>
            <Icon as={Minus} className="size-5" />
          </Button>
          <View className="border-border w-12 items-center justify-center border-b border-t">
            <Text role="status" className="text-base font-medium tabular-nums">{servings}</Text>
          </View>
          <Button variant="outline" size="icon-lg" accessibilityLabel="More servings" className="rounded-l-none" disabled={servings >= MAX_SERVINGS} onPress={() => setServings(value => value + 1)}>
            <Icon as={Plus} className="size-5" />
          </Button>
        </View>
      </View>
    </Screen>
  );
}
