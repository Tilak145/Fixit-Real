import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCSSVariable } from 'uniwind';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

// Sample values for the demonstration. A real chart reads the app's own data.
const activity = [24, 41, 34, 60, 38, 63, 52];
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const spending = [
  { label: 'Food', share: 46, variable: '--color-chart-2', swatch: 'bg-chart-2' },
  { label: 'Transport', share: 28, variable: '--color-chart-3', swatch: 'bg-chart-3' },
  { label: 'Home', share: 16, variable: '--color-chart-1', swatch: 'bg-chart-1' },
  { label: 'Other', share: 10, variable: '--color-muted', swatch: 'bg-muted' },
];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const focusRing = Platform.select({ web: 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50' });

const CHART_WIDTH = 320;
const CHART_HEIGHT = 110;
const CHART_TOP = 26;

/** A smooth line through the values, and the same line closed into an area. */
function chartPaths(values: number[]) {
  const step = CHART_WIDTH / (values.length - 1);
  const scale = (CHART_HEIGHT - CHART_TOP) / Math.max(...values);
  const round = (value: number) => Math.round(value * 10) / 10;
  const points = values.map((value, index) => ({ x: round(index * step), y: round(CHART_HEIGHT - value * scale) }));
  const line = points
    .map((point, index) => {
      const previous = points[index - 1];
      if (!previous) return `M${point.x} ${point.y}`;
      const middle = round((previous.x + point.x) / 2);
      return `C${middle} ${previous.y} ${middle} ${point.y} ${point.x} ${point.y}`;
    })
    .join(' ');
  return { line, area: `${line} L${CHART_WIDTH} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z` };
}

function ActivityChart() {
  const color = String(useCSSVariable('--color-chart-2') ?? 'transparent');
  const { line, area } = chartPaths(activity);
  const summary = weekdays.map((day, index) => `${day} ${activity[index]}`).join(', ');
  return (
    <View role="img" aria-label={`Minutes per day, sample data: ${summary}`}>
      <Svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%" height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id="spk-activity-fill" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#spk-activity-fill)" />
        <Path d={line} fill="none" stroke={color} strokeWidth={2} />
      </Svg>
    </View>
  );
}

/** Each segment is a dashed circle, laid end to end and started at the top. */
function Donut({ size = 112, stroke = 12 }: { size?: number; stroke?: number }) {
  const colors = useCSSVariable(spending.map(segment => segment.variable));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const lengths = spending.map(segment => (segment.share / 100) * circumference);
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
      {spending.map((segment, index) => (
        <Circle
          key={segment.label}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={String(colors[index] ?? 'transparent')}
          strokeWidth={stroke}
          strokeDasharray={`${lengths[index]} ${circumference - (lengths[index] ?? 0)}`}
          strokeDashoffset={-lengths.slice(0, index).reduce((sum, length) => sum + length, 0)}
        />
      ))}
    </Svg>
  );
}

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

type Day = { year: number; month: number; day: number };
const sameDay = (a: Day, b: Day) => a.year === b.year && a.month === b.month && a.day === b.day;
// Sample dates: "today" is October 14, 2026, and the 15th starts out selected.
const SAMPLE_TODAY: Day = { year: 2026, month: 9, day: 14 };

function MonthCalendar() {
  const [view, setView] = useState({ year: 2026, month: 9 });
  const [selected, setSelected] = useState<Day>({ year: 2026, month: 9, day: 15 });
  const shift = (step: number) =>
    setView(({ year, month }) => {
      const index = year * 12 + month + step;
      return { year: Math.floor(index / 12), month: index % 12 };
    });

  return (
    <Card className="gap-4 py-5">
      <CardContent className="gap-2 px-5">
        <View className="flex-row items-center justify-between">
          <Text role="heading" className="pl-1 text-sm font-medium">{`${monthNames[view.month]} ${view.year}`}</Text>
          <View className="flex-row gap-1">
            <Button variant="ghost" size="icon-sm" accessibilityLabel="Previous month" onPress={() => shift(-1)}>
              <Icon as={ChevronLeft} className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" accessibilityLabel="Next month" onPress={() => shift(1)}>
              <Icon as={ChevronRight} className="size-4" />
            </Button>
          </View>
        </View>
        <View className="gap-1">
          <View className="flex-row">
            {weekdayLabels.map(label => <Text key={label} className="text-muted-foreground flex-1 py-1 text-center text-xs">{label}</Text>)}
          </View>
          {buildMonth(view.year, view.month).map((week, index) => (
            <View key={index} className="flex-row">
              {week.map(cell => {
                if (!cell.inMonth) {
                  return (
                    <View key={`outside-${index}-${cell.day}`} aria-hidden className="h-9 flex-1 items-center justify-center">
                      <Text className="text-muted-foreground/50 text-sm tabular-nums">{cell.day}</Text>
                    </View>
                  );
                }
                const date = { year: view.year, month: view.month, day: cell.day };
                const isSelected = sameDay(date, selected);
                const isToday = sameDay(date, SAMPLE_TODAY);
                return (
                  <Pressable
                    key={`day-${cell.day}`}
                    role="button"
                    aria-selected={isSelected}
                    accessibilityLabel={`${monthNames[view.month]} ${cell.day}, ${view.year}`}
                    onPress={() => setSelected(date)}
                    className={cn('h-9 flex-1 items-center justify-center rounded-full', focusRing)}>
                    <View className={cn('size-9 items-center justify-center rounded-4xl', isSelected ? 'bg-primary' : isToday ? 'bg-muted' : null)}>
                      <Text className={cn('text-sm tabular-nums', isSelected && 'text-primary-foreground font-medium', isToday && !isSelected && 'font-medium')}>{cell.day}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </CardContent>
    </Card>
  );
}

export default function DataDemo() {
  return (
    <Screen back title="Chart and calendar" className="gap-4">
      <Card className="gap-4 py-5">
        <CardHeader className="flex-row items-start justify-between px-5">
          <View className="min-w-0 flex-1 gap-1.5">
            <CardTitle>Activity</CardTitle>
            <CardDescription>Minutes per day, last 7 days</CardDescription>
          </View>
          <Text className="text-xl font-semibold tabular-nums">{activity.reduce((sum, value) => sum + value, 0)}</Text>
        </CardHeader>
        <CardContent className="px-5">
          <ActivityChart />
          <View className="mt-2 flex-row justify-between">
            {weekdays.map(day => <Text key={day} className="text-muted-foreground text-xs">{day}</Text>)}
          </View>
        </CardContent>
      </Card>

      <Card className="gap-4 py-5">
        <CardContent className="flex-row items-center gap-5 px-5">
          <View role="img" aria-label={`Spending in October, sample data: ${spending.map(segment => `${segment.label} ${segment.share}%`).join(', ')}`} className="size-28 shrink-0 items-center justify-center">
            <Donut />
            <Text className="text-lg font-semibold tabular-nums">$842</Text>
            <Text className="text-muted-foreground text-xs">October</Text>
          </View>
          <View className="flex-1 gap-2.5">
            {spending.map(segment => (
              <View key={segment.label} className="flex-row items-center gap-2">
                <View className={cn('size-2.5 rounded-sm', segment.swatch)} />
                <Text className="text-sm">{segment.label}</Text>
                <Text className="text-muted-foreground ml-auto text-sm tabular-nums">{`${segment.share}%`}</Text>
              </View>
            ))}
          </View>
        </CardContent>
      </Card>

      <MonthCalendar />
    </Screen>
  );
}
