import { Fragment, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Bell, ChevronRight, Languages, LogIn, Mail, Sparkles, SunMoon, User, type LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { AccountActions, useAuth } from '@/features/auth';
import { useDesignTheme } from '@/features/design-theme';
import { config } from '@/lib/config';
import design from '@/lib/spk-design-theme';

/** One row of a group: an icon, a title, then a value or a control. A row with onPress is a link. */
function Row({ icon, title, value, onPress, children }: { icon: LucideIcon; title: string; value?: string; onPress?: () => void; children?: ReactNode }) {
  return (
    <Item size="sm" className="rounded-none" onPress={onPress} accessibilityLabel={onPress ? title : undefined}>
      <Icon as={icon} className="text-muted-foreground size-[18px]" />
      <ItemContent>
        <ItemTitle className="font-normal">{title}</ItemTitle>
      </ItemContent>
      {value || children ? (
        <ItemActions className="shrink">
          {value ? <Text numberOfLines={1} className="shrink">{value}</Text> : null}
          {children}
        </ItemActions>
      ) : null}
      {onPress ? <Icon as={ChevronRight} className="text-muted-foreground size-4" /> : null}
    </Item>
  );
}

/** A labelled group of rows in one rounded border, with a separator between rows. */
function Group({ title, rows }: { title: string; rows: ReactNode[] }) {
  const shown = rows.filter(Boolean);
  if (!shown.length) return null;
  return (
    <View className="gap-2">
      <Text role="heading" className="text-muted-foreground px-1 text-sm font-medium">{title}</Text>
      <View className="border-border overflow-hidden rounded-2xl border">
        {shown.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <ItemSeparator className="ml-11 w-auto" /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export default function SettingsPage({ edges }: { edges?: Edge[] }) {
  const { session, loading } = useAuth();
  const { colorScheme, setColorScheme } = useDesignTheme();
  // Notifications is a local choice. Dark appearance follows the design: it is offered only when
  // DESIGN.md declares both a light and a dark theme.
  const [notifications, setNotifications] = useState(true);
  const themes: readonly string[] = design.themes;
  const metadata: Record<string, unknown> = session?.user.user_metadata ?? {};
  const name = [metadata.full_name, metadata.name]
    .find((value): value is string => typeof value === 'string' && value.trim() !== '')
    ?.trim();
  const appVersion = Constants.expoConfig?.version;

  const accountRows = loading
    ? []
    : session
      ? [
          name ? <Row key="name" icon={User} title="Name" value={name} /> : null,
          session.user.email ? <Row key="email" icon={Mail} title="Email" value={session.user.email} /> : null,
        ]
      : [<Row key="sign-in" icon={LogIn} title="Sign in" onPress={() => router.push('/examples/sign-in')} />];

  const preferenceRows = [
    <Row key="notifications" icon={Bell} title="Notifications">
      <Switch checked={notifications} onCheckedChange={setNotifications} accessibilityLabel="Notifications" hitSlop={12} />
    </Row>,
    themes.includes('light') && themes.includes('dark') ? (
      <Row key="appearance" icon={SunMoon} title="Dark appearance">
        <Switch
          checked={colorScheme === 'dark'}
          onCheckedChange={dark => setColorScheme(dark ? 'dark' : 'light')}
          accessibilityLabel="Dark appearance"
          hitSlop={12}
        />
      </Row>
    ) : null,
    <Row key="language" icon={Languages} title="Language" value="English" />,
  ];

  return (
    <Screen edges={edges} back title="Settings" className="gap-5">
      <Item variant="outline" size="sm" onPress={() => router.push('/examples/paywall')} accessibilityLabel="Upgrade to Pro">
        <ItemMedia variant="icon" className="bg-primary">
          <Icon as={Sparkles} className="text-primary-foreground size-5" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Upgrade to Pro</ItemTitle>
          <ItemDescription>Unlimited lists, reports and themes</ItemDescription>
        </ItemContent>
        <Icon as={ChevronRight} className="text-muted-foreground size-4" />
      </Item>

      <Group title="Account" rows={accountRows} />
      <Group title="Preferences" rows={preferenceRows} />

      {session ? <AccountActions /> : null}
      {appVersion ? (
        <Text className="text-muted-foreground pb-6 text-center text-xs">
          Version {appVersion}{config.versionCode > 0 ? ` (${config.versionCode})` : ''}
        </Text>
      ) : null}
    </Screen>
  );
}
