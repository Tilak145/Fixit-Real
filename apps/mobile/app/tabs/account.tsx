import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, CalendarDays, ClipboardList, ChevronRight, CircleHelp, Search } from 'lucide-react-native';
import type { User } from '@supabase/supabase-js';
import { Screen, Section } from '@/components/screen';
import { AccountActions, AccountGate, useAuth } from '@/features/auth';
import { VisitsList } from '@/components/fixit/visits-list';
import { getMyCustomerNumber } from '@/lib/customer-number';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { listMyRequests } from '@/lib/fixit';

/** The signed-in person's name, initials and join month. */
function identity(user: User) {
  const metadata: Record<string, unknown> = user.user_metadata ?? {};
  const name = [metadata.full_name, metadata.name]
    .find((value): value is string => typeof value === 'string' && value.trim() !== '')
    ?.trim();
  const label = name ?? user.email?.split('@')[0] ?? '';
  const initials = label.split(/[s._-]+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  const joined = new Date(user.created_at);
  return {
    title: name ?? user.email ?? 'Your account',
    initials: initials || '?',
    since: Number.isNaN(joined.getTime()) ? null : joined.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

function Account() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const requests = useQuery({
    queryKey: ['my-requests', userId],
    queryFn: () => listMyRequests(userId),
    enabled: userId !== '',
  });
  const customerNumber = useQuery({
    queryKey: ['my-customer-number', userId],
    queryFn: () => getMyCustomerNumber(userId),
    enabled: userId !== '',
  });
  if (!session) return null;
  const { title, initials, since } = identity(session.user);
  const open = (requests.data ?? []).filter(request => request.status !== 'completed').length;
  const number = customerNumber.data ?? null;

  return (
    <>
      <View className="items-center gap-1">
        <Avatar alt={title} className="size-24">
          <AvatarFallback><Text className="text-3xl font-medium">{initials}</Text></AvatarFallback>
        </Avatar>
        <Text role="heading" className="mt-3 text-center text-2xl font-semibold tracking-tight">{title}</Text>
        {since ? <Text className="text-muted-foreground text-sm">Member since {since}</Text> : null}
        {number !== null ? (
          <View className="bg-muted mt-2 items-center gap-0.5 rounded-lg px-4 py-2">
            <Text className="text-muted-foreground text-[11px] uppercase tracking-wider">Your FixIt number</Text>
            <Text selectable className="text-xl font-semibold tabular-nums">{String(number)}</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row gap-3">
        <Card className="flex-1 gap-1 py-4">
          <CardContent className="items-center gap-1 px-4">
            <Text className="text-2xl font-semibold tabular-nums">{requests.data?.length ?? 0}</Text>
            <Text className="text-muted-foreground text-xs">Requests sent</Text>
          </CardContent>
        </Card>
        <Card className="flex-1 gap-1 py-4">
          <CardContent className="items-center gap-1 px-4">
            <Text className="text-2xl font-semibold tabular-nums">{open}</Text>
            <Text className="text-muted-foreground text-xs">Open now</Text>
          </CardContent>
        </Card>
      </View>

      <Section title="Scheduled visits">
        <VisitsList />
      </Section>

      <Section title="Your home">
        <View className="gap-2">
          <Button variant="outline" className="justify-start" onPress={() => router.push('/request')}>
            <Icon as={Search} className="size-4" />
            <Text className="flex-1 text-left">Request a new quote</Text>
          </Button>
          <Button variant="outline" className="justify-start" onPress={() => router.push('/tabs/requests')}>
            <Icon as={ClipboardList} className="size-4" />
            <Text className="flex-1 text-left">My quote requests</Text>
          </Button>
          <Button variant="outline" className="justify-start" onPress={() => router.push('/tabs/requests')}>
            <Icon as={CalendarDays} className="size-4" />
            <Text className="flex-1 text-left">Visits and messages</Text>
          </Button>
        </View>
      </Section>

      <Button variant="outline" className="justify-start" onPress={() => router.push('/help')}>
        <Icon as={CircleHelp} className="size-4" />
        <Text className="flex-1 text-left">Common questions</Text>
      </Button>

      <Card className="gap-2 py-5">
        <CardContent className="gap-2 px-5">
          <View className="flex-row items-center gap-2">
            <Icon as={Briefcase} className="text-primary size-4" />
            <Text className="text-sm font-semibold">Your business</Text>
          </View>
          <Text className="text-muted-foreground text-[13px] leading-5">
            Signed in as a professional too? See today&apos;s visits, new leads and the quotes you sent.
          </Text>
          <Button className="justify-between" onPress={() => router.push('/pro')}>
            <Text>Open my business dashboard</Text>
            <Icon as={ChevronRight} className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <AccountActions />
    </>
  );
}

/** The Account tab: the signed-in customer, or the sign-in form. */
export default function AccountPage() {
  return (
    <Screen edges={['top']} className="grow" title="Account" menu>
      <AccountGate>
        <Account />
      </AccountGate>
    </Screen>
  );
}
