# Tab bar

ExaSpark composition guide. `components/tab-bar.tsx` is the app's bottom tab
bar for Expo Router `Tabs`, styled from the design tokens. `app/tabs/` is a
working example with four tabs.

```tsx
import { Tabs } from 'expo-router';
import { CalendarDays, House } from 'lucide-react-native';
import { TabBar } from '@/components/tab-bar';

const icons = { index: House, calendar: CalendarDays };

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={props => <TabBar {...props} icons={icons} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
    </Tabs>
  );
}
```

- Use three to five tabs for the app's main places; put everything else in
  pushed screens.
- Each tab screen uses `<Screen edges={['top']}>`, because the tab bar pads the
  bottom safe area.
- Keys of `icons` are the route names; `options.title` is the label.
