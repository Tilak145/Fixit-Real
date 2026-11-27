import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getSupabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Notice {
  id: string;
  tone: 'good' | 'bad' | 'info';
  title: string;
  body: string;
}

const TONES: Record<Notice['tone'], string> = {
  good: 'border-[#BFE3C8] bg-[#EAF7EE]',
  bad: 'border-[#F0C4C0] bg-[#FDECEA]',
  info: 'border-[#BFD7F2] bg-[#EEF5FD]',
};

/**
 * What FixIt decided about this business (license, insurance, registration,
 * approval), asked for every few seconds. Each stays until the pro closes it.
 */
export function AdminNotices({ providerId }: { providerId: string }) {
  const queryClient = useQueryClient();
  const notices = useQuery({
    queryKey: ['provider-notices', providerId],
    refetchInterval: 3_000,
    retry: false,
    queryFn: async (): Promise<Notice[]> => {
      const supabase = getSupabase();
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('provider_notices')
        .select('id,tone,title,body,created_at')
        .eq('provider_id', providerId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return (data ?? []) as Notice[];
    },
  });
  const close = useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { error } = await supabase.from('provider_notices').update({ read_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provider-notices', providerId] }),
  });

  if (!notices.data?.length) return null;
  return (
    <View className="gap-2">
      {notices.data.map(notice => (
        <View key={notice.id} className={cn('gap-2 rounded-2xl border p-4', TONES[notice.tone])}>
          <Text className="text-[15px] font-semibold text-[#17262B]">{notice.title}</Text>
          <Text className="text-[13px] leading-5 text-[#17262B]">{notice.body}</Text>
          <Button variant="outline" size="sm" className="self-start" disabled={close.isPending} onPress={() => close.mutate(notice.id)}>
            <Text>Got it</Text>
          </Button>
        </View>
      ))}
    </View>
  );
}