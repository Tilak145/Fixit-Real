import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { events, type CalendarEvent } from '@/lib/sample-data';
import { cn } from '@/lib/utils';

// Sample month: the events are in October 2026 and "today" in the sample is the 15th.
const YEAR = 2026;
const MONTH = 9;
const TODAY = 15;
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekdayInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// More sample events, so every day that carries a dot has an agenda to show.
const moreEvents: CalendarEvent[] = [
  { id: 'coffee', day: 2, start: '8:30', end: '9:00', title: 'Coffee with Sam', place: 'Café Nord', color: 'chart-1' },
  { id: 'yoga', day: 5, start: '18:30', end: '19:30', title: 'Yoga class', place: 'Studio 4', color: 'chart-4' },
  { id: 'review', day: 8, start: '14:00', end: '15:00', title: 'Product review', place: 'Video call', color: 'chart-2' },
  { id: 'pickup', day: 12, start: '17:15', end: '17:30', title: 'Grocery pickup', place: 'Market Hall', color: 'chart-1' },
  { id: 'book-club', day: 16, start: '19:00', end: '20:30', title: 'Book club', place: 'City library', color: 'chart-4' },
];
const agendaFor = (day: number) => [...events, ...moreEvents].filter(event => event.day === day);

// Tailwind only generates classes it finds written out in full.
const accent: Record<CalendarEvent['color'], string> = {
  'chart-1': 'border-l-chart-1',
  'chart-2': 'border-l-chart-2',
  'chart-4': 'border-l-chart-4',
};
const focusRing = Platform.select({ web: 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50' });

type Cell = { day: number; inMonth: boolean };

/** The month as weeks of seven cells, padded with days of the neighbouring months. */
function buildMonth(year: number, month: number): Cell[][] {
  const leading = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();
  const previousLength = new Date(year, month, 0).getDate();
  const cells: Cell[] = [];
  for (let offset = leading - 1; offset >= 0; offset--) cells.push({ day: previousLength - offset, inMonth: false });
  for (let day = 1; day <= length; day++) cells.push({ day, inMonth: true });
  for (let day = 1; cells.length % 7 !== 0; day++) cells.push({ day, inMonth: false });
  const weeks: Cell[][] = [];
  for (let start = 0; start < cells.length; start += 7) weeks.push(cells.slice(start, start + 7));
  return weeks;
}

const weeks = buildMonth(YEAR, MONTH);

function DayButton({ day, selected, today, eventCount, onPress }: { day: number; selected: boolean; today: boolean; eventCount: number; onPress: () => void }) {
  const label = `${monthNames[MONTH]} ${day}${eventCount > 0 ? `, ${eventCount} event${eventCount === 1 ? '' : 's'}` : ''}`;
  return (
    <Pressable
      role="button"
      aria-selected={selected}
      accessibilityLabel={label}
      onPress={onPress}
      className={cn('h-11 flex-1 items-center justify-center rounded-xl', focusRing)}>
      <View className={cn('items-center justify-center', (selected || today) && 'size-10 rounded-4xl', selected ? 'bg-primary' : today ? 'bg-muted' : null)}>
        <Text className={cn('text-[15px] tabular-nums', selected && 'text-primary-foreground font-medium', today && 'font-medium')}>{day}</Text>
        {eventCount > 0 ? <View className={cn('size-1 rounded-full', selected ? 'bg-primary-foreground' : 'bg-muted-foreground mt-0.5')} /> : null}
      </View>
    </Pressable>
  );
}

export default function CalendarPage({ edges }: { edges?: Edge[] }) {
  const [selected, setSelected] = useState(TODAY);
  const agenda = agendaFor(selected);
  const heading = `${dayNames[new Date(YEAR, MONTH, selected).getDay()]}, ${monthNames[MONTH]?.slice(0, 3)} ${selected}`;
  const count = agenda.length === 0 ? 'No events' : `${agenda.length} event${agenda.length === 1 ? '' : 's'}`;

  return (
    <Screen
      edges={edges}
      title={monthNames[MONTH]}
      className="gap-0 px-0"
      action={
        <>
          <Button variant="outline" size="sm" onPress={() => setSelected(TODAY)}>
            <Text>Today</Text>
          </Button>
          <Button variant="ghost" size="icon-lg" accessibilityLabel="New event" onPress={() => router.push('/examples/create')}>
            <Icon as={Plus} className="size-[22px]" />
          </Button>
        </>
      }>
      <View className="gap-0.5 px-4">
        <View className="flex-row">
          {weekdayInitials.map((initial, index) => (
            <Text key={index} className="text-muted-foreground flex-1 py-1 text-center text-xs">{initial}</Text>
          ))}
        </View>
        {weeks.map((week, index) => (
          <View key={index} className="flex-row">
            {week.map(cell =>
              cell.inMonth ? (
                <DayButton
                  key={`day-${cell.day}`}
                  day={cell.day}
                  selected={cell.day === selected}
                  today={cell.day === TODAY && selected !== TODAY}
                  eventCount={agendaFor(cell.day).length}
                  onPress={() => setSelected(cell.day)}
                />
              ) : (
                <View key={`outside-${index}-${cell.day}`} aria-hidden className="h-11 flex-1 items-center justify-center">
                  <Text className="text-muted-foreground/50 text-[15px] tabular-nums">{cell.day}</Text>
                </View>
              ),
            )}
          </View>
        ))}
      </View>

      <Separator className="mt-3" />

      <View className="gap-3 px-5 pt-4">
        <View className="flex-row items-baseline justify-between">
          <Text role="heading" className="text-base font-semibold">{heading}</Text>
          <Text className="text-muted-foreground text-sm">{count}</Text>
        </View>
        {agenda.length === 0 ? <Text className="text-muted-foreground text-sm">Nothing planned for this day.</Text> : null}
        {agenda.map(event => (
          <View key={event.id} className="flex-row gap-3">
            <Text className="text-muted-foreground w-12 shrink-0 pt-3 text-right text-xs tabular-nums">{event.start}</Text>
            <Item variant="muted" size="sm" className={cn('flex-1 rounded-l-md border-l-[3px]', accent[event.color])}>
              <ItemContent>
                <ItemTitle>{event.title}</ItemTitle>
                <ItemDescription>{`${event.start} – ${event.end} · ${event.place}`}</ItemDescription>
              </ItemContent>
            </Item>
          </View>
        ))}
      </View>
    </Screen>
  );
}
