import { Share, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Flame, Lock, Settings, Share as ShareIcon, Sunrise, Trophy, type LucideIcon } from 'lucide-react-native';
import type { User } from '@supabase/supabase-js';
import { Screen, Section } from '@/components/screen';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { AccountActions, AccountGate, useAuth } from '@/features/auth';
import { cn } from '@/lib/utils';

// Sample content: replace the numbers and rewards with the app's own.
const stats: [value: string, label: string][] = [['128', 'Check-ins'], ['12', 'Day streak'], ['9', 'Badges']];
const badges: [label: string, icon: LucideIcon][] = [['On fire', Flame], ['Early bird', Sunrise], ['30 days', Trophy]];

/** The signed-in person: their name (or email), initials and the month they joined. */
function identity(user: User) {
  const metadata: Record<string, unknown> = user.user_metadata ?? {};
  const name = [metadata.full_name, metadata.name]
    .find((value): value is string => typeof value === 'string' && value.trim() !== '')
    ?.trim();
  const label = name ?? user.email?.split('@')[0] ?? '';
  const initials = label.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('');
  const joined = new Date(user.created_at);
  return {
    title: name ?? user.email ?? 'Your account',
    initials: initials || '?',
    since: Number.isNaN(joined.getTime()) ? null : joined.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

function Profile() {
  const { session } = useAuth();
  if (!session) return null;
  const { title, initials, since } = identity(session.user);
  return (
    <>
      <View className="items-center">
        <Avatar alt={title} className="size-24">
          <AvatarFallback><Text className="text-3xl font-medium">{initials}</Text></AvatarFallback>
        </Avatar>
        <Text role="heading" className="mt-4 text-center text-2xl font-semibold tracking-tight">{title}</Text>
        {since ? <Text className="text-muted-foreground text-sm">Member since {since}</Text> : null}
        <View className="mt-4 w-full flex-row gap-2">
          <Button variant="outline" className="flex-1" onPress={() => router.push('/examples/settings')}>
            <Text>Edit profile</Text>
          </Button>
          <Button variant="outline" size="icon-lg" accessibilityLabel="Share profile" onPress={() => void Share.share({ message: title }).catch(() => undefined)}>
            <Icon as={ShareIcon} className="size-5" />
          </Button>
        </View>
      </View>

      <View className="border-border flex-row rounded-2xl border py-4">
        {stats.map(([value, label], index) => (
          <View key={label} className={cn('flex-1 items-center', index > 0 && 'border-border border-l')}>
            <Text className="text-xl font-semibold tabular-nums">{value}</Text>
            <Text className="text-muted-foreground text-xs">{label}</Text>
          </View>
        ))}
      </View>

      <Section title="Badges" className="gap-3">
        <View className="flex-row gap-3">
          {badges.map(([label, icon]) => (
            <View key={label} className="flex-1 items-center gap-1.5">
              <View className="bg-muted border-border size-14 items-center justify-center rounded-2xl border">
                <Icon as={icon} className="size-6" />
              </View>
              <Text className="text-muted-foreground text-xs">{label}</Text>
            </View>
          ))}
          <View className="flex-1 items-center gap-1.5">
            <View className="border-border size-14 items-center justify-center rounded-2xl border border-dashed">
              <Icon as={Lock} className="text-muted-foreground size-5" />
            </View>
            <Text className="text-muted-foreground text-xs">100 days</Text>
          </View>
        </View>
      </Section>

      <AccountActions />
    </>
  );
}

/** The signed-in person's profile. Without a session the gate shows the sign-in form instead. */
export default function ProfilePage({ edges }: { edges?: Edge[] }) {
  return (
    <Screen
      edges={edges}
      className="grow"
      header={
        <View className="h-14 flex-row items-center justify-end px-2">
          <Button variant="ghost" size="icon-lg" accessibilityLabel="Settings" onPress={() => router.push('/examples/settings')}>
            <Icon as={Settings} className="size-[22px]" />
          </Button>
        </View>
      }>
      <AccountGate>
        <Profile />
      </AccountGate>
    </Screen>
  );
}
