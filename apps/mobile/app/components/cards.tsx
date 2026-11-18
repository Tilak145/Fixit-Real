import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import { Bookmark, Footprints, Moon, type LucideIcon } from 'lucide-react-native';
import { useCSSVariable } from 'uniwind';
import { Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

type Stat = { label: string; value: string; delta: string; note: string; icon: LucideIcon };

// Sample figures.
const stats: Stat[] = [
  { label: 'Steps', value: '8,432', delta: '+8%', note: 'vs last week', icon: Footprints },
  { label: 'Sleep', value: '7h 20m', delta: '−12m', note: 'vs average', icon: Moon },
];

/** Two soft colour washes behind the badge, drawn from the theme's chart colors. */
function MediaArt() {
  const [first, second] = useCSSVariable(['--color-chart-1', '--color-chart-4']);
  return (
    <View pointerEvents="none" className="absolute inset-0 opacity-60">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="spk-card-art-first" cx="0.8" cy="0.1" r="0.85">
            <Stop offset="0" stopColor={String(first ?? 'transparent')} stopOpacity={1} />
            <Stop offset="0.6" stopColor={String(first ?? 'transparent')} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="spk-card-art-second" cx="0.1" cy="0.9" r="0.8">
            <Stop offset="0" stopColor={String(second ?? 'transparent')} stopOpacity={1} />
            <Stop offset="0.6" stopColor={String(second ?? 'transparent')} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#spk-card-art-first)" />
        <Rect width="100%" height="100%" fill="url(#spk-card-art-second)" />
      </Svg>
    </View>
  );
}

export default function CardsDemo() {
  const [saved, setSaved] = useState(false);
  const [started, setStarted] = useState(false);

  return (
    <Screen back title="Card" className="gap-4">
      <View className="flex-row gap-3">
        {stats.map(stat => (
          <Card key={stat.label} className="min-w-0 flex-1 gap-2 py-5">
            <CardContent className="gap-1 px-5">
              <View className="flex-row items-center justify-between">
                <Text className="text-muted-foreground text-sm">{stat.label}</Text>
                <Icon as={stat.icon} className="text-muted-foreground size-4" />
              </View>
              <Text className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</Text>
              <Text className="text-muted-foreground text-xs">
                <Text className="text-foreground text-xs font-medium">{stat.delta}</Text>
                {` ${stat.note}`}
              </Text>
            </CardContent>
          </Card>
        ))}
      </View>

      <Card className="overflow-hidden pt-0">
        <View className="bg-muted aspect-[16/8] justify-end p-4">
          <MediaArt />
          <View className="items-start">
            <Badge variant="secondary">
              <Text>Featured</Text>
            </Badge>
          </View>
        </View>
        <CardHeader className="flex-row items-start justify-between">
          <View className="min-w-0 flex-1 gap-1.5">
            <CardTitle>Lakeside loop</CardTitle>
            <CardDescription>5.2 km · Easy · 40 min</CardDescription>
          </View>
          <Button variant="ghost" size="icon" accessibilityLabel={saved ? 'Remove from saved' : 'Save'} onPress={() => setSaved(value => !value)}>
            <Icon as={Bookmark} fill={saved ? 'currentColor' : 'none'} className="size-5" />
          </Button>
        </CardHeader>
        <CardFooter className="gap-2">
          <Button variant="outline" className="flex-1" onPress={() => router.push('/examples/detail')}>
            <Text>Details</Text>
          </Button>
          <Button className="flex-1" onPress={() => setStarted(value => !value)}>
            <Text>{started ? 'Stop' : 'Start'}</Text>
          </Button>
        </CardFooter>
      </Card>

      <Card className="gap-4 py-5">
        <CardHeader className="flex-row items-start justify-between px-5">
          <View className="min-w-0 flex-1 gap-1.5">
            <CardTitle>Weekly goal</CardTitle>
            <CardDescription>4 of 5 workouts done</CardDescription>
          </View>
          <Badge variant="outline">
            <Text className="tabular-nums">80%</Text>
          </Badge>
        </CardHeader>
        <CardContent className="px-5">
          <Progress value={80} indicatorClassName="bg-primary" />
        </CardContent>
      </Card>

      <Card className="gap-4 py-5">
        <CardContent className="flex-row items-center gap-3 px-5">
          <Skeleton className="size-10 rounded-full" />
          <View className="flex-1 gap-2">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3.5 w-2/5" />
          </View>
        </CardContent>
      </Card>
    </Screen>
  );
}
