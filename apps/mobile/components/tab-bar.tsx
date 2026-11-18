import type { ComponentProps } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * The app's bottom tab bar, styled from the design tokens.
 * Use it as <Tabs tabBar={props => <TabBar {...props} icons={icons} />}> with one
 * Lucide icon per route name.
 */
export function TabBar({ state, descriptors, navigation, icons }: TabBarProps & { icons: Record<string, LucideIcon> }) {
  const insets = useSafeAreaInsets();
  return (
    <View role="tablist" className="border-border bg-background flex-row border-t px-2 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options ?? {};
        const label = typeof options.title === 'string' ? options.title : route.name;
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        const icon = icons[route.name];
        return (
          <Pressable
            key={route.key}
            role="tab"
            aria-selected={focused}
            accessibilityLabel={label}
            onPress={onPress}
            className={cn('min-h-12 flex-1 items-center justify-center gap-1 rounded-xl', Platform.select({ web: 'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50' }))}>
            {icon ? <Icon as={icon} className={cn('size-[22px]', focused ? 'text-foreground' : 'text-muted-foreground')} /> : null}
            <Text className={cn('text-[11px] font-medium', focused ? 'text-foreground' : 'text-muted-foreground')}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
