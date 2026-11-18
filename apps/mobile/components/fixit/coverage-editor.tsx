import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CORE_CATEGORIES, categoryName, listCities } from '@/lib/fixit';
import { getMyCoverage, saveMyCoverage } from '@/lib/my-business';
import { planFitProblem, planLimits } from '@/lib/plan-limits';
import { cn } from '@/lib/utils';

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      className={cn('min-h-[40px] justify-center rounded-full border px-3.5 py-2', on ? 'border-primary bg-primary' : 'border-border bg-card')}>
      <Text className={cn('text-[13px] font-bold', on ? 'text-primary-foreground' : 'text-foreground')}>{(on ? '✓ ' : '') + label}</Text>
    </Pressable>
  );
}

/** The trades and cities a business works in, limited by its plan. Leads and listings follow these. */
export function CoverageEditor({ providerId, plan }: { providerId: string; plan: string }) {
  const queryClient = useQueryClient();
  const saved = useQuery({ queryKey: ['my-coverage', providerId], queryFn: () => getMyCoverage(providerId) });
  const cities = useQuery({ queryKey: ['service-cities'], queryFn: listCities, staleTime: 5 * 60_000 });
  const [editing, setEditing] = useState(false);
  const [services, setServices] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (saved.data && !editing) {
      setServices(saved.data.services);
      setAreas(saved.data.cities);
    }
  }, [saved.data, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const bad = planFitProblem(plan, areas.length, services.length);
      if (bad) throw new Error(bad);
      if (!saved.data) throw new Error('Still loading. Try again in a moment.');
      await saveMyCoverage(providerId, saved.data, { services, cities: areas });
    },
    onSuccess: async () => {
      setProblem(null);
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ['my-coverage', providerId] });
    },
    onError: error => {
      setProblem((error as Error).message);
      // A save can stop part-way, so show what is really stored.
      void queryClient.invalidateQueries({ queryKey: ['my-coverage', providerId] });
    },
  });

  if (saved.isPending) return null;
  const limits = planLimits(plan);
  const toggle = (list: string[], set: (next: string[]) => void, item: string) =>
    set(list.includes(item) ? list.filter(entry => entry !== item) : [...list, item]);
  const cityLabels = Array.from(new Set([...(cities.data ?? []).filter(city => city.is_active).map(city => city.label), ...areas]));

  if (!editing) {
    const current = saved.data ?? { services: [], cities: [] };
    return (
      <View className="border-border bg-card gap-2 rounded-2xl border p-4">
        <Text className="text-[15px] font-semibold">Services and cities</Text>
        <Text className="text-[13px] leading-5">
          <Text className="text-[13px] font-semibold">Services: </Text>
          {current.services.length ? current.services.map(categoryName).join(', ') : 'None yet'}
        </Text>
        <Text className="text-[13px] leading-5">
          <Text className="text-[13px] font-semibold">Cities: </Text>
          {current.cities.length ? current.cities.join(', ') : 'None yet'}
        </Text>
        {current.services.length === 0 || current.cities.length === 0 ? (
          <Text className="text-[12.5px] text-[#B26A00]">You get no leads until you have at least one service and one city.</Text>
        ) : null}
        <Button variant="outline" onPress={() => setEditing(true)}><Text>Edit services and cities</Text></Button>
      </View>
    );
  }

  return (
    <View className="border-primary/40 bg-card gap-3 rounded-2xl border p-4">
      <Text className="text-[15px] font-semibold">Edit services and cities</Text>
      <Text className="text-muted-foreground text-[12.5px] leading-5">
        {'Your plan covers ' + (limits.services ?? 'any number of') + ' services and ' + (limits.cities ?? 'any number of') + ' cities. Picked: ' + services.length + ' services, ' + areas.length + ' cities.'}
      </Text>
      <Text className="text-[13px] font-semibold">Services</Text>
      <View className="flex-row flex-wrap gap-2">
        {CORE_CATEGORIES.map(category => (
          <Chip key={category.slug} label={category.name} on={services.includes(category.slug)} onPress={() => toggle(services, setServices, category.slug)} />
        ))}
      </View>
      <Text className="text-[13px] font-semibold">Cities you serve</Text>
      <View className="flex-row flex-wrap gap-2">
        {cityLabels.map(label => (
          <Chip key={label} label={label} on={areas.includes(label)} onPress={() => toggle(areas, setAreas, label)} />
        ))}
      </View>
      {problem ? <Text className="text-destructive text-[12.5px] leading-5">{problem}</Text> : null}
      <View className="flex-row gap-2">
        <Button className="flex-1" disabled={save.isPending} onPress={() => save.mutate()}>
          <Text>{save.isPending ? 'Saving…' : 'Save'}</Text>
        </Button>
        <Button variant="outline" disabled={save.isPending} onPress={() => { setEditing(false); setProblem(null); }}>
          <Text>Cancel</Text>
        </Button>
      </View>
    </View>
  );
}