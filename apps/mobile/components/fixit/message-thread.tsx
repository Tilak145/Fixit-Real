import { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { listMessages, sendMessage } from '@/lib/fixit';
import { cn } from '@/lib/utils';

function stamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * The conversation about one quote request. The database refuses a message
 * written for the other side, so a customer only ever writes as the customer.
 */
export function MessageThread({ requestId, counterpart }: { requestId: string; counterpart: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const messages = useQuery({
    queryKey: ['messages', requestId],
    queryFn: () => listMessages(requestId),
    refetchInterval: 20_000,
  });
  const send = useMutation({
    mutationFn: (body: string) => sendMessage({ requestId, body }),
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['messages', requestId] });
    },
  });

  function submit() {
    if (!draft.trim() || send.isPending) return;
    send.mutate(draft);
  }

  return (
    <Card className="gap-4 py-5">
      <CardContent className="gap-3 px-5">
        <View className="gap-1">
          <Text className="text-[15px] font-semibold">Messages</Text>
          <Text className="text-muted-foreground text-[12.5px]">Send {counterpart} a message about this job.</Text>
        </View>

        {messages.isPending ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : messages.isError ? (
          <Text role="alert" className="text-destructive text-sm">We could not load your messages. Try again.</Text>
        ) : messages.data.length === 0 ? (
          <Text className="text-muted-foreground text-sm">
            No messages yet. Agree on a time, a price, or any detail here.
          </Text>
        ) : (
          <View className="gap-2.5">
            {messages.data.map(message => {
              const mine = message.sender_role === 'customer';
              return (
                <View
                  key={message.id}
                  className={cn(
                    'max-w-[85%] gap-1 rounded-xl px-3.5 py-2.5',
                    mine ? 'bg-primary self-end' : 'bg-muted self-start',
                  )}>
                  <Text className={cn('text-[11px] font-bold', mine ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {(mine ? 'You' : counterpart) + ' · ' + stamp(message.created_at)}
                  </Text>
                  <Text className={cn('text-[13px] leading-5', mine && 'text-primary-foreground')}>{message.body}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View className="gap-2">
          <Textarea
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message…"
            accessibilityLabel="Write a message"
            numberOfLines={3}
            editable={!send.isPending}
          />
          <Button onPress={submit} disabled={send.isPending || draft.trim() === ''}>
            <Icon as={Send} className="size-4" />
            <Text>{send.isPending ? 'Sending…' : 'Send'}</Text>
          </Button>
        </View>
        {send.isError ? (
          <Text role="alert" className="text-destructive text-sm">
            {send.error instanceof Error ? send.error.message : 'Your message did not send. Try again.'}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
