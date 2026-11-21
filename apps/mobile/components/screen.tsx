import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView as NativeSafeAreaView, type Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { withUniwind } from 'uniwind';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MenuButton } from '@/components/fixit/side-menu';
import { TestingBanner } from '@/components/fixit/testing-banner';
import { cn } from '@/lib/utils';

// className on a third-party component goes through withUniwind.
const SafeAreaView = withUniwind(NativeSafeAreaView);

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

type ScreenProps = {
  /** Large title for a top-level screen, or the bar title when `back` is set. */
  title?: string;
  description?: string;
  /** Shows a back button and a compact title bar. */
  back?: boolean;
  /** Trailing header content, such as an icon button. */
  action?: ReactNode;
  /** Replaces the default header entirely. */
  header?: ReactNode;
  /** Pinned under the content, above the bottom safe area: the screen's primary action. */
  footer?: ReactNode;
  /** Shows the menu button at the left of the title bar (the main tab screens). */
  menu?: boolean;
  scroll?: boolean;
  /** Safe-area edges this screen pads. Screens inside the tab bar pass ['top']. */
  edges?: Edge[];
  className?: string;
  children: ReactNode;
};

/** One phone screen: safe areas, a header, scrolling content and an optional pinned footer. */
export function Screen({ title, description, back = false, menu = false, action, header, footer, scroll = true, edges, className, children }: ScreenProps) {
  const content = cn('gap-6 px-5 pb-8 pt-2', className);
  return (
    <SafeAreaView edges={edges ?? ['top', 'bottom']} className="bg-background flex-1">
      <TestingBanner />
      <View className="w-full max-w-[560px] flex-1 self-center">
      {header ?? (title || back || action ? <ScreenHeader title={title} description={description} back={back} menu={menu} action={action} /> : null)}
      {scroll ? (
        <ScrollView className="flex-1" contentContainerClassName={content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View className={cn('flex-1', content)}>{children}</View>
      )}
      {footer ? <View className="border-border bg-background border-t px-5 pb-2 pt-3">{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

export function ScreenHeader({ title, description, back, menu, action }: Pick<ScreenProps, 'title' | 'description' | 'back' | 'menu' | 'action'>) {
  if (back) {
    return (
      <View className="h-14 flex-row items-center gap-1 px-2">
        <Button variant="ghost" size="icon" accessibilityLabel="Go back" onPress={goBack}>
          <Icon as={ChevronLeft} className="size-6" />
        </Button>
        <Text role="heading" numberOfLines={1} className="flex-1 text-base font-semibold">{title}</Text>
        {action ? <View className="flex-row items-center gap-1">{action}</View> : <View className="size-11" />}
      </View>
    );
  }
  return (
    <View className="min-h-14 flex-row items-center justify-between gap-3 px-5 pb-2 pt-2">
      {menu ? <MenuButton /> : null}
      <View className="flex-1 gap-0.5">
        {title ? <Text role="heading" className="text-2xl font-semibold tracking-tight">{title}</Text> : null}
        {description ? <Text className="text-muted-foreground text-sm">{description}</Text> : null}
      </View>
      {action ? <View className="flex-row items-center gap-1">{action}</View> : null}
    </View>
  );
}

/** A titled group of content, e.g. "Today" with a "See all" action. */
export function Section({ title, action, className, children }: { title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <View className={cn('gap-2', className)}>
      <View className="flex-row items-center justify-between px-1">
        <Text role="heading" className="text-base font-semibold">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}
