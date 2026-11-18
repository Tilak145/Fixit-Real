import { useState } from 'react';
import { View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, SquarePen } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Icon } from '@/components/ui/icon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type Thread = { id: string; name: string; initials: string; preview: string; time: string; unread: number };

// Sample conversations. The ids match the threads in app/examples/conversation.tsx.
const sample: Thread[] = [
  { id: 'ana', name: 'Ana Marsh', initials: 'AM', preview: 'Sounds good, see you at 7 then!', time: '9:24', unread: 2 },
  { id: 'ravi', name: 'Ravi Kumar', initials: 'RK', preview: 'Sent the photos from Saturday.', time: 'Yesterday', unread: 0 },
  { id: 'book-club', name: 'Book club', initials: 'BC', preview: 'Sam: Chapter 9 was wild', time: 'Tue', unread: 0 },
  { id: 'sam', name: 'Sam Chen', initials: 'SC', preview: 'You: Thanks, that works for me.', time: 'Mon', unread: 0 },
  { id: 'lena', name: 'Lena Torres', initials: 'LT', preview: 'The recipe was perfect, thank you!', time: 'Oct 8', unread: 0 },
];

export default function InboxPage({ edges }: { edges?: Edge[] }) {
  const [threads, setThreads] = useState(sample);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = threads.filter(thread => `${thread.name} ${thread.preview}`.toLowerCase().includes(needle));

  const open = (thread: Thread) => {
    setThreads(list => list.map(entry => (entry.id === thread.id ? { ...entry, unread: 0 } : entry)));
    router.push({ pathname: '/examples/conversation', params: { id: thread.id } });
  };

  return (
    <Screen
      edges={edges}
      title="Messages"
      className="gap-3 px-0"
      action={
        <Button variant="ghost" size="icon-lg" accessibilityLabel="New message" onPress={() => router.push({ pathname: '/examples/conversation', params: { id: 'new' } })}>
          <Icon as={SquarePen} className="size-5" />
        </Button>
      }>
      <View className="px-5">
        <InputGroup>
          <InputGroupAddon>
            <Icon as={Search} className="text-muted-foreground size-4" />
          </InputGroupAddon>
          <InputGroupInput value={query} onChangeText={setQuery} placeholder="Search" returnKeyType="search" autoCapitalize="none" autoCorrect={false} accessibilityLabel="Search messages" />
        </InputGroup>
      </View>

      {shown.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No messages found</EmptyTitle>
            <EmptyDescription>Try another name or word.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <View className="px-4">
          {shown.map(thread => (
            <Item
              key={thread.id}
              size="sm"
              variant={thread.unread > 0 ? 'muted' : 'default'}
              accessibilityLabel={`${thread.name}, ${thread.preview}, ${thread.time}${thread.unread > 0 ? `, ${thread.unread} unread` : ''}`}
              onPress={() => open(thread)}>
              <Avatar alt={thread.name} className="size-12">
                <AvatarFallback><Text className="text-base">{thread.initials}</Text></AvatarFallback>
              </Avatar>
              <ItemContent>
                <View className="flex-row items-center justify-between gap-2">
                  <ItemTitle className="flex-1">{thread.name}</ItemTitle>
                  <Text className="text-muted-foreground text-xs">{thread.time}</Text>
                </View>
                <View className="flex-row items-center justify-between gap-3">
                  <ItemDescription numberOfLines={1} className={cn('flex-1', thread.unread > 0 && 'text-foreground font-medium')}>
                    {thread.preview}
                  </ItemDescription>
                  {thread.unread > 0 ? (
                    <Badge className="h-5 min-w-5 px-1.5">
                      <Text className="tabular-nums">{thread.unread}</Text>
                    </Badge>
                  ) : null}
                </View>
              </ItemContent>
            </Item>
          ))}
        </View>
      )}
    </Screen>
  );
}
