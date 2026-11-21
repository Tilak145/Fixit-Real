import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import {
  Briefcase,
  CircleHelp,
  CircleUserRound,
  ClipboardList,
  House,
  LifeBuoy,
  Menu,
  PlusCircle,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { FixItLogo } from '@/components/fixit/logo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { categoryIcon } from '@/lib/category-icons';
import { CORE_CATEGORIES } from '@/lib/fixit';

const SUPPORT_EMAIL = 'support@fixitls.com';

type Go = (run: () => void) => void;

function Row({ icon, label, onPress, strong = false }: { icon: LucideIcon; label: string; onPress: () => void; strong?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-row items-center gap-3.5 rounded-2xl px-3 py-3 active:bg-muted">
      <Icon as={icon} className="text-primary size-[22px]" />
      <Text className={strong ? 'text-[15.5px] font-semibold' : 'text-[15px]'}>{label}</Text>
    </Pressable>
  );
}

function Heading({ children }: { children: string }) {
  return <Text className="text-muted-foreground px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-widest">{children}</Text>;
}

/**
 * The menu button, and the panel that slides in from the left with most of the
 * app in it: the main places, every service, the business side and help.
 */
export function MenuButton() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  // Close first, then move, so the panel is gone before the next screen shows.
  const go: Go = run => {
    setOpen(false);
    setTimeout(run, 50);
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        hitSlop={8}
        onPress={() => setOpen(true)}
        className="bg-card border-border size-10 items-center justify-center rounded-full border active:opacity-70">
        <Icon as={Menu} className="size-5" />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 flex-row">
          <View className="bg-background h-full w-[82%] max-w-[340px] shadow-2xl">
            <ScrollView contentContainerClassName="px-3 pb-10 pt-14">
              <View className="flex-row items-center justify-between px-3 pb-2">
                <FixItLogo />
                <Pressable accessibilityLabel="Close menu" hitSlop={10} onPress={() => setOpen(false)}>
                  <Icon as={X} className="text-muted-foreground size-6" />
                </Pressable>
              </View>
              <Text className="text-muted-foreground px-3 pb-2 text-[12.5px]">
                {session?.user.email ? 'Signed in as ' + session.user.email : 'Not signed in'}
              </Text>

              <Heading>Menu</Heading>
              <Row icon={House} label="Home" strong onPress={() => go(() => router.replace('/tabs'))} />
              <Row icon={PlusCircle} label="Request a quote" strong onPress={() => go(() => router.push('/request'))} />
              <Row icon={ClipboardList} label="My requests" onPress={() => go(() => router.push('/tabs/requests'))} />
              <Row icon={CircleUserRound} label="My account" onPress={() => go(() => router.push('/tabs/account'))} />

              <Heading>Services</Heading>
              {CORE_CATEGORIES.map(category => (
                <Row
                  key={category.slug}
                  icon={categoryIcon(category.slug)}
                  label={category.name}
                  onPress={() => go(() => router.push({ pathname: '/service/[slug]', params: { slug: category.slug } }))}
                />
              ))}

              <Heading>For professionals</Heading>
              <Row icon={Briefcase} label="My business dashboard" onPress={() => go(() => router.push('/pro'))} />

              <Heading>Help</Heading>
              <Row icon={CircleHelp} label="Common questions" onPress={() => go(() => router.push('/help'))} />
              <Row icon={LifeBuoy} label="Contact support" onPress={() => go(() => void Linking.openURL('mailto:' + SUPPORT_EMAIL))} />
            </ScrollView>
          </View>
          {/* Tapping the dimmed side closes the menu. */}
          <Pressable accessibilityLabel="Close menu" className="flex-1 bg-black/50" onPress={() => setOpen(false)} />
        </View>
      </Modal>
    </>
  );
}