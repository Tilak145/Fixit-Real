import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarClock, ChevronRight, Receipt } from 'lucide-react-native';
import { CoverageEditor } from '@/components/fixit/coverage-editor';
import { PhoneAlerts } from '@/components/fixit/phone-alerts';
import { HoursEditor } from '@/components/fixit/hours-editor';
import { JobDetails } from '@/components/fixit/job-details';
import { Screen, Section } from '@/components/screen';
import { AccountGate, useAuth } from '@/features/auth';
import { VisitsList } from '@/components/fixit/visits-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { categoryName, formatCents } from '@/lib/fixit';
import { config } from '@/lib/config';
import {
  getAcceptingWork,
  getMyBusiness,
  setAcceptingWork,
  listBusinessAppointments,
  listBusinessLeads,
  type BusinessLead,
  type MyBusiness,
} from '@/lib/my-business';
import { nextUpFor } from '@/lib/next-up';
import { cn } from '@/lib/utils';

function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** One figure on the Next up strip: a number, what it means, and where it leads. */
function NextUpItem({
  icon: IconComponent,
  value,
  label,
  detail,
  tone,
  onPress,
}: {
  icon: typeof Bell;
  value: string;
  label: string;
  detail: string;
  tone: 'blue' | 'violet' | 'amber';
  onPress: () => void;
}) {
  const iconTone = {
    blue: 'bg-[#E9F1FB]',
    violet: 'bg-[#F1ECFB]',
    amber: 'bg-[#FFF3E0]',
  }[tone];
  const iconColor = {
    blue: 'text-[#1565C0]',
    violet: 'text-[#6B3FB5]',
    amber: 'text-[#B35C00]',
  }[tone];
  return (
    <Button
      variant="outline"
      onPress={onPress}
      className="h-auto justify-start gap-3 rounded-xl bg-background py-3"
      accessibilityLabel={label}
    >
      <View className={cn('size-10 items-center justify-center rounded-lg', iconTone)}>
        <Icon as={IconComponent} className={cn('size-[18px]', iconColor)} />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-xl font-semibold tabular-nums">{value}</Text>
          <Text className="text-[13px] font-semibold">{label}</Text>
        </View>
        <Text numberOfLines={1} className="text-muted-foreground text-[12px]">{detail}</Text>
      </View>
      <Icon as={ChevronRight} className="text-muted-foreground size-4" />
    </Button>
  );
}

/** A lead waiting for a price, with the facts a pro needs to decide. */
function LeadCard({ lead }: { lead: BusinessLead }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Open ' + categoryName(lead.category_slug) + ' request in ' + lead.city}
      onPress={() => router.push({ pathname: '/pro/[id]', params: { id: lead.id } })}
    >
      <Card className="py-4">
        <CardContent className="flex-row items-center gap-3 px-4">
          <View className="flex-1 gap-1.5">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-[15px] font-semibold">{categoryName(lead.category_slug)}</Text>
              {lead.is_emergency ? (
                <Badge variant="destructive"><Text className="text-[11px]">Emergency</Text></Badge>
              ) : null}
              {lead.media.length > 0 ? (
                <Badge variant="outline">
                  <Text className="text-[11px]">{lead.media.length} photo{lead.media.length === 1 ? '' : 's'}</Text>
                </Badge>
              ) : null}
            </View>
            <JobDetails description={lead.description} compact lines={2} />
            <Text className="text-muted-foreground text-[12.5px]">
              {lead.city} · {when(lead.created_at)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-primary text-[12.5px] font-semibold">Price it</Text>
            <Icon as={ChevronRight} className="text-primary size-4" />
          </View>
        </CardContent>
      </Card>
    </Pressable>
  );
}

/** A price this business sent, still waiting on the homeowner. */
function QuoteRow({ lead }: { lead: BusinessLead }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Quote on ' + categoryName(lead.category_slug) + ' in ' + lead.city}
      onPress={() => router.push({ pathname: '/pro/[id]', params: { id: lead.id } })}
    >
      <Card className="py-3.5">
        <CardContent className="flex-row items-center gap-3 px-4">
          <View className="flex-1 gap-0.5">
            <Text className="text-[14px] font-semibold">
              {categoryName(lead.category_slug)} · {lead.customer_name}
            </Text>
            <Text className="text-muted-foreground text-[12.5px]">{lead.city} · waiting on the homeowner to choose</Text>
          </View>
          <Text className="text-[15px] font-semibold tabular-nums">{formatCents(lead.quote?.amount_cents ?? 0)}</Text>
        </CardContent>
      </Card>
    </Pressable>
  );
}

/** One switch for "I am busy": pauses new work without touching hours or plan. */
function WorkSwitch({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const accepting = useQuery({ queryKey: ['accepting-work', userId], queryFn: () => getAcceptingWork(userId) });
  const toggle = useMutation({
    mutationFn: (next: boolean) => setAcceptingWork(userId, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accepting-work', userId] }),
  });
  if (accepting.isPending) return null;
  const on = accepting.data !== false;
  return (
    <View className={cn('gap-2 rounded-2xl border p-4', on ? 'border-border bg-card' : 'border-[#E8C48A] bg-[#FFF4E5]')}>
      <Text className="text-[15px] font-semibold">{on ? 'You are taking new work' : 'New work is paused'}</Text>
      <Text className="text-muted-foreground text-[12.5px] leading-5">
        {on
          ? 'Customers can see you as available during your hours. Pause when you are too busy.'
          : 'You are not shown as available and not featured. Turn it back on when you are ready.'}
      </Text>
      <Button variant={on ? 'outline' : 'default'} disabled={toggle.isPending} onPress={() => toggle.mutate(!on)}>
        <Text>{toggle.isPending ? 'Saving…' : on ? 'Pause new work' : 'Start taking work again'}</Text>
      </Button>
      {toggle.isError ? <Text className="text-destructive text-[12.5px]">{(toggle.error as Error).message}</Text> : null}
    </View>
  );
}

function BusinessDashboard() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const business = useQuery({
    queryKey: ['my-business', userId],
    queryFn: () => getMyBusiness(userId),
    enabled: userId !== '',
  });
  const enabled = !!business.data;
  const leads = useQuery({ queryKey: ['business-leads', business.data?.id], queryFn: listBusinessLeads, enabled });
  const appointments = useQuery({
    queryKey: ['business-appointments', business.data?.id],
    queryFn: listBusinessAppointments,
    enabled,
  });

  if (business.isPending || !session) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }
  if (business.isError) {
    return (
      <Card className="py-5">
        <CardContent className="gap-3 px-5">
          <Text className="text-muted-foreground text-sm">We could not load your business right now.</Text>
          <Button variant="outline" onPress={() => void business.refetch()}><Text>Try again</Text></Button>
        </CardContent>
      </Card>
    );
  }
  if (!business.data) {
    return (
      <Card className="gap-3 py-6">
        <CardContent className="gap-2 px-5">
          <Text className="text-base font-semibold">This login is not linked to a business</Text>
          <Text className="text-muted-foreground text-[13px] leading-5">
            You are signed in as {session.user.email}, but no FixIt business belongs to this account. Join as a
            professional on the website, then sign in here with the same account.
          </Text>
        </CardContent>
      </Card>
    );
  }

  const pro: MyBusiness = business.data;
  const loading = leads.isPending || appointments.isPending;
  if (loading) return <Skeleton className="h-40 w-full rounded-2xl" />;

  const next = nextUpFor({
    businessId: pro.id,
    leads: leads.data ?? [],
    appointments: appointments.data ?? [],
    now: new Date(),
  });
  const open = leads.data ?? [];

  return (
    <>
      <PhoneAlerts userId={userId} />
      <WorkSwitch userId={userId} />
      <HoursEditor userId={userId} />
      <CoverageEditor providerId={pro.id} plan={pro.plan} />

      {/* Start here: what needs this business next, before any lists. */}
      <View className="bg-muted/40 border-border gap-3 rounded-2xl border p-4">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text role="heading" className="text-[15px] font-semibold">Next up</Text>
          <Text className="text-muted-foreground text-[12px]">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        <NextUpItem
          icon={CalendarClock}
          tone="violet"
          value={String(next.today.length)}
          label={next.today.length === 1 ? 'visit today' : 'visits today'}
          detail={next.next ? 'Next: ' + when(next.next.scheduled_for) : 'Nothing booked yet — new leads are below'}
          onPress={() => router.push('/tabs/requests')}
        />
        <NextUpItem
          icon={Bell}
          tone="blue"
          value={String(next.newLeads.length)}
          label={next.newLeads.length === 1 ? 'new lead' : 'new leads'}
          detail={
            next.emergencies.length > 0
              ? `${next.emergencies.length} emergency ${next.emergencies.length === 1 ? 'request' : 'requests'} waiting`
              : next.newLeads.length > 0
                ? 'Matching your services and area'
                : 'All caught up right now'
          }
          onPress={() => router.push('/tabs/requests')}
        />
        <NextUpItem
          icon={Receipt}
          tone="amber"
          value={String(next.openQuotes.length)}
          label={next.openQuotes.length === 1 ? 'quote sent' : 'quotes sent'}
          detail={
            next.openQuotes.length > 0 ? 'Waiting on the homeowner to choose' : 'No prices waiting on an answer'
          }
          onPress={() => router.push('/tabs/requests')}
        />
      </View>

      <Section title="New leads">
        {next.newLeads.length === 0 ? (
          <Card className="border-dashed py-5">
            <CardContent className="px-5">
              <Text className="text-muted-foreground text-sm leading-5">
                Requests matching your trades and service area appear here automatically.
              </Text>
            </CardContent>
          </Card>
        ) : (
          <View className="gap-2.5">
            {next.newLeads.slice(0, 5).map(lead => <LeadCard key={lead.id} lead={lead} />)}
          </View>
        )}
      </Section>

      <Section title="Quotes sent">
        {next.openQuotes.length === 0 ? (
          <Card className="border-dashed py-5">
            <CardContent className="px-5">
              <Text className="text-muted-foreground text-sm leading-5">
                A price you send from the website appears here until the homeowner answers it.
              </Text>
            </CardContent>
          </Card>
        ) : (
          <View className="gap-2.5">
            {next.openQuotes.map(lead => <QuoteRow key={lead.id} lead={lead} />)}
          </View>
        )}
      </Section>

      <Section
        title="Visits"
        action={
          <Button
            variant="ghost"
            size="sm"
            onPress={() => void Linking.openURL(`${config.siteUrl}/pro/dashboard`)}>
            <Text>Open full dashboard</Text>
          </Button>
        }
      >
        <VisitsList />
      </Section>

      {open.length > 0 ? (
        <Text className="text-muted-foreground text-center text-[12px]">
          {open.length} request{open.length === 1 ? '' : 's'} visible to your business. Send prices, schedule visits
          and report finished jobs from the full dashboard on the website.
        </Text>
      ) : null}
    </>
  );
}

/** The business side of FixIt: what needs doing today, then leads, quotes and visits. */
export default function ProHomePage() {
  return (
    <Screen back title="Your business">
      <AccountGate>
        <BusinessDashboard />
      </AccountGate>
    </Screen>
  );
}

