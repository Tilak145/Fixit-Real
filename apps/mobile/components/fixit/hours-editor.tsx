import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  defaultWeek,
  describeWeek,
  minuteToTimeValue,
  timeValueToMinute,
  validateWindow,
  weekGrid,
  type AvailabilityWindow,
} from '@/lib/fixit-availability';
import { getMyHours, saveMyHours } from '@/lib/my-business';
import { cn } from '@/lib/utils';

type Row = { weekday: number; on: boolean; start: string; end: string };

const input = 'border-input text-foreground h-10 w-[88px] rounded-full border px-3 text-center text-[14px]';

function toRows(windows: AvailabilityWindow[]): Row[] {
  return weekGrid(windows).map(day => ({
    weekday: day.weekday,
    on: day.window !== null,
    start: minuteToTimeValue(day.window?.startMinute ?? 9 * 60),
    end: minuteToTimeValue(day.window?.endMinute ?? 17 * 60),
  }));
}

/** The weekly hours and emergency opt-in. Customers are only told "available" inside these hours. */
export function HoursEditor({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const hours = useQuery({ queryKey: ['my-hours', userId], queryFn: () => getMyHours(userId) });
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [emergency, setEmergency] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (hours.data && !editing) {
      setRows(toRows(hours.data.windows));
      setEmergency(hours.data.acceptsEmergency);
    }
  }, [hours.data, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const windows: AvailabilityWindow[] = [];
      for (const row of rows) {
        if (!row.on) continue;
        // 24:00 is how the end of the day is written.
        const start = timeValueToMinute(row.start);
        const end = timeValueToMinute(row.end);
        const label = weekGrid([])[rows.indexOf(row)].label;
        const bad = start === null || end === null ? 'Use times like 09:00 and 17:30 for ' + label + '.' : validateWindow(start, end);
        if (bad) throw new Error(bad);
        windows.push({ weekday: row.weekday, startMinute: start as number, endMinute: end as number });
      }
      await saveMyHours(userId, { acceptsEmergency: emergency, acceptingWork: hours.data?.acceptingWork ?? true, windows });
    },
    onSuccess: async () => {
      setProblem(null);
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['my-hours', userId] });
    },
    onError: error => setProblem((error as Error).message),
  });

  if (hours.isPending || !hours.data?.providerId) return null;
  const set = (weekday: number, change: Partial<Row>) =>
    setRows(current => current.map(row => (row.weekday === weekday ? { ...row, ...change } : row)));

  if (!editing) {
    return (
      <View className="border-border bg-card gap-2 rounded-2xl border p-4">
        <Text className="text-[15px] font-semibold">Your hours</Text>
        <Text className="text-muted-foreground text-[13px] leading-5">{describeWeek(hours.data.windows)}</Text>
        <Text className="text-muted-foreground text-[12.5px]">
          {hours.data.acceptsEmergency ? 'You take emergency calls.' : 'You do not take emergency calls.'}
        </Text>
        {hours.data.windows.length === 0 ? (
          <Text className="text-[12.5px] text-[#B26A00]">
            With no hours set, customers see "Hours on request" and you are never counted as available now.
          </Text>
        ) : null}
        <Button variant="outline" onPress={() => { setRows(toRows(hours.data.windows.length ? hours.data.windows : defaultWeek())); setEditing(true); }}>
          <Text>Edit hours</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="border-primary/40 bg-card gap-3 rounded-2xl border p-4">
      <Text className="text-[15px] font-semibold">Edit your hours</Text>
      <Text className="text-muted-foreground text-[12.5px]">Use 24-hour times, like 09:00 and 17:30. Switch a day off if you do not work it.</Text>
      {rows.map(row => (
        <View key={row.weekday} className="flex-row items-center gap-2">
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: row.on }}
            onPress={() => set(row.weekday, { on: !row.on })}
            className={cn('h-10 w-[84px] items-center justify-center rounded-full border', row.on ? 'border-primary bg-primary' : 'border-border bg-card')}>
            <Text className={cn('text-[13px] font-bold', row.on ? 'text-primary-foreground' : 'text-foreground')}>
              {weekGrid([]).find(day => day.weekday === row.weekday)?.short}
            </Text>
          </Pressable>
          {row.on ? (
            <>
              <TextInput value={row.start} onChangeText={value => set(row.weekday, { start: value })} accessibilityLabel="Start time" className={input} />
              <Text className="text-muted-foreground">to</Text>
              <TextInput value={row.end} onChangeText={value => set(row.weekday, { end: value })} accessibilityLabel="End time" className={input} />
            </>
          ) : (
            <Text className="text-muted-foreground text-[13px]">Off</Text>
          )}
        </View>
      ))}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: emergency }}
        onPress={() => setEmergency(value => !value)}
        className="flex-row items-center gap-3 pt-1">
        <View className={cn('size-5 items-center justify-center rounded border', emergency ? 'border-primary bg-primary' : 'border-border bg-card')}>
          {emergency ? <Text className="text-primary-foreground text-[12px] font-bold">✓</Text> : null}
        </View>
        <Text className="flex-1 text-[14px]">I take emergency calls outside my hours</Text>
      </Pressable>
      {problem ? <Text className="text-destructive text-[12.5px]">{problem}</Text> : null}
      <View className="flex-row gap-2">
        <Button className="flex-1" disabled={save.isPending} onPress={() => save.mutate()}>
          <Text>{save.isPending ? 'Saving…' : 'Save hours'}</Text>
        </Button>
        <Button variant="outline" disabled={save.isPending} onPress={() => { setEditing(false); setProblem(null); }}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </View>
  );
}