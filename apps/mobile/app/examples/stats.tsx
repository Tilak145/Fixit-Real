import { useState } from 'react';
import { View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { Car, House, ShoppingBag, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { spending, spendingByCategory } from '@/lib/sample-data';
import { cn } from '@/lib/utils';

type Period = 'week' | 'month' | 'year';
type Category = { label: string; amount: string; share: number; color: 'chart-1' | 'chart-2' | 'chart-3' };
type Range = {
  caption: string;
  total: string;
  change: string;
  trend: 'up' | 'down';
  bars: number[];
  axis: string[];
  categories: Category[];
};

// Sample figures. A real screen computes these from its own data.
const ranges: Record<Period, Range> = {
  week: {
    caption: 'Spent this week',
    total: '$412.60',
    change: '3.4%',
    trend: 'up',
    bars: [35, 58, 44, 70, 52, 88, 40],
    axis: ['Oct 9', 'Oct 12', 'Oct 15'],
    categories: [
      { label: 'Groceries', amount: '$142', share: 74, color: 'chart-3' },
      { label: 'Home', amount: '$118', share: 61, color: 'chart-2' },
      { label: 'Transport', amount: '$64', share: 33, color: 'chart-1' },
    ],
  },
  month: {
    caption: 'Spent in October',
    total: spending.total,
    change: spending.change,
    trend: 'down',
    bars: spending.bars,
    axis: ['Oct 1', 'Oct 8', 'Oct 15'],
    categories: spendingByCategory,
  },
  year: {
    caption: 'Spent in 2026',
    total: '$17,903.40',
    change: '4.7%',
    trend: 'down',
    bars: [52, 61, 48, 66, 58, 72, 80, 64, 55, 90],
    axis: ['Jan', 'May', 'Oct'],
    categories: [
      { label: 'Groceries', amount: '$5,980', share: 78, color: 'chart-3' },
      { label: 'Home', amount: '$5,210', share: 68, color: 'chart-2' },
      { label: 'Transport', amount: '$2,940', share: 38, color: 'chart-1' },
    ],
  },
};

const categoryIcons: Record<string, LucideIcon> = { Groceries: ShoppingBag, Home: House, Transport: Car };

// Tailwind only generates classes it finds written out in full.
const indicatorColor: Record<Category['color'], string> = { 'chart-1': 'bg-chart-1', 'chart-2': 'bg-chart-2', 'chart-3': 'bg-chart-3' };

export default function StatsPage({ edges }: { edges?: Edge[] }) {
  const [period, setPeriod] = useState<Period>('month');
  const range = ranges[period];
  const peak = Math.max(...range.bars);

  return (
    <Screen edges={edges} title="Insights" className="gap-4">
      <Tabs value={period} onValueChange={value => setPeriod(value as Period)}>
        <TabsList className="h-10 w-full">
          <TabsTrigger value="week"><Text className="text-[15px]">Week</Text></TabsTrigger>
          <TabsTrigger value="month"><Text className="text-[15px]">Month</Text></TabsTrigger>
          <TabsTrigger value="year"><Text className="text-[15px]">Year</Text></TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="gap-4 py-5">
        <CardHeader className="flex-row items-start justify-between px-5">
          <View className="gap-1.5">
            <CardDescription>{range.caption}</CardDescription>
            <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">{range.total}</CardTitle>
          </View>
          <Badge variant="outline">
            <Icon as={range.trend === 'down' ? TrendingDown : TrendingUp} className="size-3" />
            <Text>{range.change}</Text>
          </Badge>
        </CardHeader>
        <CardContent className="px-5">
          <View role="img" aria-label={`Bar chart of ${range.bars.length} sample values, ${range.caption.toLowerCase()}`} className="h-32 flex-row items-end gap-2">
            {range.bars.map((value, index) => (
              <View key={index} className={cn('flex-1 rounded-md', value === peak ? 'bg-chart-3' : 'bg-chart-1')} style={{ height: `${value}%` }} />
            ))}
          </View>
          <View className="mt-2 flex-row justify-between">
            {range.axis.map(label => <Text key={label} className="text-muted-foreground text-xs">{label}</Text>)}
          </View>
        </CardContent>
      </Card>

      <Card className="gap-4 py-5">
        <CardHeader className="px-5">
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <CardContent className="gap-4 px-5">
          {range.categories.map(category => (
            <View key={category.label} className="gap-2">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <Icon as={categoryIcons[category.label] ?? ShoppingBag} className="text-muted-foreground size-4" />
                  <Text className="text-sm">{category.label}</Text>
                </View>
                <Text className="text-sm tabular-nums">{category.amount}</Text>
              </View>
              <Progress value={category.share} className="h-2" indicatorClassName={indicatorColor[category.color]} />
            </View>
          ))}
        </CardContent>
      </Card>
    </Screen>
  );
}
