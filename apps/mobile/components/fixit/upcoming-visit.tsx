import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { getSupabase } from '@/lib/supabase';
import { visitWhen } from '@/lib/visit-when';

interface Visit {
  id: string;
  scheduled_for: string;
  city: string | null;
  customer_name: string | null;
  providers: { business_name: string | null } | null;
}

/**
 * A card that cannot be missed when a visit is booked. With a providerId it
 * shows that business's next visit; without one, the signed-in customer's own.
 * Filtered to the owner here too, because a staff account may read every visit.
 */
export function UpcomingVisit({ providerId }: { providerId?: string }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const visits = useQuery({
    queryKey: ['upcoming-visit', providerId ?? 'customer', userId],
    enabled: userId !== '',
    refetchInterval: 30_000,
    retry: false,
    queryFn: async (): Promise<Visit[]> => {
      const supabase = getSupabase();
      if (!supabase) return [];
      // A visit stays up for two hours after its start, while it is under way.
      const since = new Date(Date.now() - 2 * 3_600_000).toISOString();
      let query = supabase
        .from('appointments')
        .select(
          providerId
            ? 'id,scheduled_for,city,customer_name,providers(business_name)'
            : 'id,scheduled_for,city,customer_name,providers(business_name),quote_requests!inner(customer_user_id)',
        )
        .eq('status', 'scheduled')
        .gte('scheduled_for', since)
        .order('scheduled_for', { ascending: true })
        .limit(5);
      query = providerId ? query.eq('provider_id', providerId) : query.eq('quote_requests.customer_user_id', userId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Visit[];
    },
  });

  const next = visits.data?.[0];
  if (!next) return null;
  const more = (visits.data?.length ?? 1) - 1;
  const who = providerId ? next.customer_name ?? 'your customer' : next.providers?.business_name ?? 'your professional';
  const detail =
    'With ' + who + (next.city ? ' · ' + next.city : '') + (more > 0 ? ' · and ' + more + ' more after this' : '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Visit coming up: ' + visitWhen(next.scheduled_for)}
      onPress={() => router.push('/tabs/requests')}
      className="flex-row items-center gap-3 rounded-2xl bg-[#157A43] p-4 active:opacity-90">
      <Icon as={CalendarClock} className="size-7 text-white" />
      <View className="flex-1 gap-0.5">
        <Text className="text-[12px] font-bold uppercase tracking-wide text-white/80">You have a visit coming up</Text>
        <Text className="text-[17px] font-bold leading-6 text-white">{visitWhen(next.scheduled_for)}</Text>
        <Text className="text-[13px] text-white/90">{detail}</Text>
      </View>
    </Pressable>
  );
}