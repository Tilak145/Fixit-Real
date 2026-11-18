import { useState } from 'react';
import { View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Bell, Flame, Receipt, Sparkles, type LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type Group = 'Today' | 'Earlier';
type Notice = {
  id: string;
  group: Group;
  title: string;
  body: string;
  time?: string;
  unread: boolean;
  /** Shown in a round tile. Notices without one show the sender's initials. */
  icon?: LucideIcon;
  initials?: string;
  /** Adds "Open list" and "Dismiss" buttons under the text. */
  actions?: boolean;
};

// Sample content: a real screen reads its own notifications.
const sample: Notice[] = [
  { id: 'streak', group: 'Today', title: '12-day streak', body: 'Your longest run so far. Keep it going tomorrow.', time: '8 min ago', unread: true, icon: Flame },
  { id: 'shared', group: 'Today', title: 'Ana shared “Weekend trip”', body: 'You can now add and check off items.', unread: true, initials: 'AM', actions: true },
  { id: 'payment', group: 'Earlier', title: 'Payment received', body: 'Pro yearly · $39.99. Thanks for your support.', time: 'Yesterday', unread: false, icon: Receipt },
  { id: 'stretch', group: 'Earlier', title: 'Time to stretch', body: 'Your 8:00 PM reminder.', time: 'Mon', unread: false, icon: Bell },
  { id: 'report', group: 'Earlier', title: 'New: weekly report', body: 'See your week at a glance every Sunday.', time: 'Oct 9', unread: false, icon: Sparkles },
];
const groups: Group[] = ['Today', 'Earlier'];

export default function NotificationsPage({ edges }: { edges?: Edge[] }) {
  const [notices, setNotices] = useState(sample);
  const hasUnread = notices.some(notice => notice.unread);
  const markRead = (id: string) => setNotices(list => list.map(notice => (notice.id === id ? { ...notice, unread: false } : notice)));
  const dismiss = (id: string) => setNotices(list => list.filter(notice => notice.id !== id));

  return (
    <Screen
      edges={edges}
      back
      title="Notifications"
      className="gap-4"
      action={
        <Button variant="ghost" disabled={!hasUnread} onPress={() => setNotices(list => list.map(notice => ({ ...notice, unread: false })))}>
          <Text className="text-muted-foreground">Read all</Text>
        </Button>
      }>
      {notices.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>You’re all caught up</EmptyTitle>
            <EmptyDescription>New notifications show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {groups.map(group => {
        const items = notices.filter(notice => notice.group === group);
        if (items.length === 0) return null;
        return (
          <View key={group} className="gap-2">
            <Text role="heading" className={cn('text-muted-foreground px-1 text-sm font-medium', group !== groups[0] && 'pt-2')}>{group}</Text>
            <View>
              {items.map(notice => {
                // Only an unread notice without buttons of its own is pressable: pressing marks it as read.
                const markable = notice.unread && !notice.actions;
                return (
                  <Item
                    key={notice.id}
                    size="sm"
                    className="items-start px-1"
                    accessibilityLabel={markable ? `${notice.title}. ${notice.body}. Unread. Mark as read` : undefined}
                    onPress={markable ? () => markRead(notice.id) : undefined}>
                    {notice.icon ? (
                      <ItemMedia className="bg-muted size-10 rounded-full">
                        <Icon as={notice.icon} className="size-5" />
                      </ItemMedia>
                    ) : (
                      <Avatar alt={notice.title}>
                        <AvatarFallback><Text className="text-sm">{notice.initials}</Text></AvatarFallback>
                      </Avatar>
                    )}
                    <ItemContent>
                      <ItemTitle>{notice.title}</ItemTitle>
                      <ItemDescription>{notice.body}</ItemDescription>
                      {notice.time ? <Text className="text-muted-foreground mt-1 text-xs">{notice.time}</Text> : null}
                      {notice.actions ? (
                        <View className="mt-2 flex-row gap-2">
                          <Button size="sm" onPress={() => { markRead(notice.id); router.push('/examples/list'); }}>
                            <Text>Open list</Text>
                          </Button>
                          <Button size="sm" variant="outline" onPress={() => dismiss(notice.id)}>
                            <Text>Dismiss</Text>
                          </Button>
                        </View>
                      ) : null}
                    </ItemContent>
                    {notice.unread ? <View accessible accessibilityLabel="Unread" className="bg-primary mt-1.5 size-2 rounded-full" /> : null}
                  </Item>
                );
              })}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}
