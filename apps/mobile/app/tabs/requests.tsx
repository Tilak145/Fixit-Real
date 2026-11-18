import { useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Film, MessageSquare, Search } from 'lucide-react-native';
import { Screen, Section } from '@/components/screen';
import { AccountGate, useAuth } from '@/features/auth';
import { MessageThread } from '@/components/fixit/message-thread';
import { VisitsList } from '@/components/fixit/visits-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { DECLINE_REASONS, DECLINE_REASON_MAX, DECLINE_REASON_MIN, categoryName, formatCents, listMyRequests, respondToQuote, type JobQuote, type MyRequest } from '@/lib/fixit';
import { quoteGaps, quoteLines } from '@/lib/quote-comparison';

const STATUS_LABEL: Record<string, string> = {
  new: 'Waiting for quotes',
  claimed: 'A pro is on it',
  completed: 'Completed',
};

function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const QUOTE_STATUS: Record<JobQuote['status'], string> = {
  sent: 'Waiting for your answer',
  accepted: 'You chose this one',
  declined: 'Not chosen',
  withdrawn: 'Withdrawn',
};

/**
 * The prices professionals sent on one request. Accepting one releases the
 * customer's contact details to that professional, so this is the control that
 * actually starts the job.
 */
function Quotes({ request }: { request: MyRequest }) {
  const queryClient = useQueryClient();
  // The quote being declined, and why: a decline must say why.
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const respond = useMutation({
    mutationFn: (input: { quoteId: string; response: 'accepted' | 'declined'; reason?: string }) => respondToQuote(input),
    onSuccess: async () => {
      setDeclining(null);
      setReason('');
      await queryClient.invalidateQueries({ queryKey: ['my-requests'] });
    },
  });

  const quotes = request.quotes ?? [];
  if (quotes.length === 0) {
    return (
      <Text className="text-muted-foreground text-[12.5px]">
        {request.claimed_by
          ? 'A pro is preparing a price. It will appear here for you to accept.'
          : 'No prices yet. Local pros in your area are being matched to this request.'}
      </Text>
    );
  }

  return (
    <View className="gap-2.5">
      {quotes.map(quote => (
        <View key={quote.id} className="border-border bg-muted/40 gap-2 rounded-lg border p-3.5">
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <Text className="font-display text-[20px] font-bold">{formatCents(quote.amount_cents)}</Text>
            <Text className="text-muted-foreground text-[13px]">
              from {quote.provider_name ?? 'your pro'}
            </Text>
            <Badge variant={quote.status === 'sent' ? 'secondary' : 'default'}>
              <Text className="text-[11px]">{QUOTE_STATUS[quote.status]}</Text>
            </Badge>
          </View>
          {quote.note ? <Text className="text-[13px]">{quote.note}</Text> : null}

          {/* The parts of the price, because two totals are only comparable when
              you can see what each one is made of. */}
          {quoteLines(quote).length > 1 ? (
            <View className="border-border gap-1 border-t pt-2">
              {quoteLines(quote).map(line => (
                <View key={line.key} className="flex-row items-center justify-between">
                  <Text className="text-muted-foreground text-[13px]">{line.label}</Text>
                  <Text className="text-[13px]">{formatCents(line.cents)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View className="gap-1">
            {[
              { label: 'Can start', value: quote.earliest_start ?? 'Not stated', warn: !quote.earliest_start },
              { label: 'How long', value: quote.completion_note?.trim() || 'Not stated', warn: !quote.completion_note },
              { label: 'Warranty', value: quote.warranty?.trim() || 'Not stated', warn: !quote.warranty },
              { label: 'Payment', value: quote.payment_terms?.trim() || 'Not stated', warn: !quote.payment_terms },
            ].map(row => (
              <View key={row.label} className="flex-row items-center justify-between gap-3">
                <Text className="text-muted-foreground text-[12px] font-bold uppercase">{row.label}</Text>
                <Text className={'flex-1 text-right text-[13px] ' + (row.warn ? 'text-[#B26A00]' : '')}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          {quoteGaps(quote).length > 0 && quote.status === 'sent' ? (
            <View className="gap-1 rounded-md bg-[#FFF4E5] px-3 py-2">
              <Text className="text-[12px] font-bold text-[#B26A00]">
                {'Worth checking (' + quoteGaps(quote).length + ')'}
              </Text>
              {quoteGaps(quote).map(gap => (
                <Text key={gap} className="text-[12px] text-[#B26A00]">{'• ' + gap}</Text>
              ))}
            </View>
          ) : null}

          {quote.status === 'sent' ? (
            <View className="flex-row flex-wrap gap-2">
              <Button
                size="sm"
                accessibilityLabel={'Accept ' + formatCents(quote.amount_cents)}
                disabled={respond.isPending}
                onPress={() => respond.mutate({ quoteId: quote.id, response: 'accepted' })}>
                <Text>{respond.isPending ? 'Saving…' : 'Accept ' + formatCents(quote.amount_cents)}</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={respond.isPending}
                onPress={() => { setDeclining(declining === quote.id ? null : quote.id); setReason(''); }}>
                <Text>Decline</Text>
              </Button>
            </View>
          ) : null}
          {quote.status === 'sent' && declining === quote.id ? (
            <View className="border-border gap-2 rounded-md border bg-white p-3">
              <Text className="text-[13px] font-semibold">Why are you declining? The pro will see this.</Text>
              <View className="flex-row flex-wrap gap-2">
                {DECLINE_REASONS.map(option => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    onPress={() => setReason(option)}
                    className={'rounded-full border px-3 py-1.5 ' + (reason === option ? 'border-primary bg-primary' : 'border-border bg-card')}>
                    <Text className={'text-[12.5px] font-semibold ' + (reason === option ? 'text-primary-foreground' : 'text-foreground')}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={reason}
                onChangeText={setReason}
                maxLength={DECLINE_REASON_MAX}
                placeholder="Or write your own reason"
                accessibilityLabel="Reason for declining"
                className="border-input text-foreground h-11 w-full rounded-full border px-4 text-base"
                placeholderTextColorClassName="accent-muted-foreground"
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={respond.isPending || reason.trim().length < DECLINE_REASON_MIN}
                onPress={() => respond.mutate({ quoteId: quote.id, response: 'declined', reason })}>
                <Text>{respond.isPending ? 'Saving…' : 'Send decline'}</Text>
              </Button>
            </View>
          ) : null}
          {respond.isError && respond.variables?.quoteId === quote.id ? (
            <Text className="text-destructive text-[12.5px]">{(respond.error as Error).message}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** One quote request, with the pro's message thread when they accepted it. */
function RequestCard({ request }: { request: MyRequest }) {
  const [open, setOpen] = useState(false);
  const counterpart = request.provider_name ?? 'the professional';
  return (
    <View className="gap-3">
      <Item
        variant="outline"
        accessibilityLabel={'Quote request for ' + categoryName(request.category_slug)}>
        <ItemMedia variant="icon"><Icon as={ClipboardList} className="text-primary size-5" /></ItemMedia>
        <ItemContent className="gap-1.5">
          <ItemTitle>{categoryName(request.category_slug)}</ItemTitle>
          <ItemDescription numberOfLines={2}>{request.description}</ItemDescription>
          <View className="flex-row flex-wrap items-center gap-2 pt-1">
            <Badge variant={request.status === 'new' ? 'secondary' : 'default'}>
              <Text className="text-[11px]">{STATUS_LABEL[request.status] ?? request.status}</Text>
            </Badge>
            <Text className="text-muted-foreground text-[12px]">{request.city}</Text>
            <Text className="text-muted-foreground text-[12px]">{when(request.created_at)}</Text>
          </View>
          {request.provider_name ? (
            <Text className="text-muted-foreground text-[12.5px]">Pro: {request.provider_name}</Text>
          ) : null}
          {(request.media ?? []).length > 0 ? (
            // What the customer sent, so they can see their job carries the
            // photos the pros are looking at.
            <View className="flex-row flex-wrap gap-2 pt-1">
              {(request.media ?? []).map(item =>
                item.url && item.kind === 'photo' ? (
                  <Image
                    key={item.id}
                    source={{ uri: item.url }}
                    alt={item.file_name}
                    className="border-border h-16 w-16 rounded-lg border"
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    key={item.id}
                    className="border-border bg-muted h-16 w-16 items-center justify-center rounded-lg border">
                    <Icon as={Film} className="text-foreground/50 size-4" />
                    <Text className="text-foreground/60 text-[11px] font-bold">Video</Text>
                  </View>
                ),
              )}
            </View>
          ) : null}
          <Quotes request={request} />
          {request.claimed_by ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-1 self-start"
              onPress={() => setOpen(value => !value)}>
              <Icon as={MessageSquare} className="size-4" />
              <Text>{open ? 'Hide messages' : 'Message the pro'}</Text>
            </Button>
          ) : null}
        </ItemContent>
      </Item>
      {open && request.claimed_by ? <MessageThread requestId={request.id} counterpart={counterpart} /> : null}
    </View>
  );
}

/** The customer's own quote requests, newest first. */
function Requests() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const requests = useQuery({
    queryKey: ['my-requests', userId],
    queryFn: () => listMyRequests(userId),
    enabled: userId !== '',
  });

  if (requests.isPending) {
    return (
      <View className="gap-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </View>
    );
  }

  if (requests.isError) {
    return (
      <Card className="py-5">
        <CardContent className="gap-3 px-5">
          <Text className="text-muted-foreground text-sm">We could not load your requests right now.</Text>
          <Button variant="outline" onPress={() => void requests.refetch()}><Text>Try again</Text></Button>
        </CardContent>
      </Card>
    );
  }

  if (requests.data.length === 0) {
    return (
      <Empty className="py-8">
        <EmptyMedia><Icon as={ClipboardList} className="text-muted-foreground size-5" /></EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No requests yet</EmptyTitle>
          <EmptyDescription>
            Ask for a quote and it will appear here while local professionals respond.
          </EmptyDescription>
        </EmptyHeader>
        <Button onPress={() => router.push('/request')}>
          <Icon as={Search} className="size-4" />
          <Text>Request a quote</Text>
        </Button>
      </Empty>
    );
  }

  return (
    <View className="gap-4">
      {requests.data.map(request => (
        <RequestCard key={request.id} request={request} />
      ))}
    </View>
  );
}

/** The Requests tab: the customer's visits and quote requests, behind sign-in. */
export default function RequestsPage() {
  return (
    <Screen
      edges={['top']}
      title="My requests"
      description="Quotes you asked local professionals for"
      action={
        <Button size="icon" accessibilityLabel="Request a quote" onPress={() => router.push('/request')}>
          <Icon as={Search} className="text-primary-foreground size-5" />
        </Button>
      }>
      <AccountGate>
        <Section title="Scheduled visits">
          <VisitsList />
        </Section>
        <Section title="Your quote requests">
          <Requests />
        </Section>
      </AccountGate>
    </Screen>
  );
}
