import { Tabs } from 'expo-router';
import { ClipboardList, CircleUserRound, House } from 'lucide-react-native';
import { TabBar } from '@/components/tab-bar';

const icons = { index: House, requests: ClipboardList, account: CircleUserRound };

/** FixIt's three customer places: Home, My Requests and Account. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={props => <TabBar {...props} icons={icons} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="requests" options={{ title: 'Requests' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
