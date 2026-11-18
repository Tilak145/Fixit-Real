import { Fragment, useState } from 'react';
import { View } from 'react-native';
import { Bell, ChevronRight, FileText, Globe, Moon, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
import { Text } from '@/components/ui/text';

type Message = { id: string; name: string; initials: string; preview: string; time: string; unread: number };

const sampleMessages: Message[] = [
  { id: 'ana', name: 'Ana Marsh', initials: 'AM', preview: 'Sounds good, see you at 7 then!', time: '9:24', unread: 2 },
  { id: 'ravi', name: 'Ravi Kumar', initials: 'RK', preview: 'Sent the photos from Saturday.', time: 'Yesterday', unread: 0 },
  { id: 'sam', name: 'Sam Chen', initials: 'SC', preview: 'You: Thanks, that works for me.', time: 'Mon', unread: 0 },
];
const languages = ['English', 'Deutsch', 'Español'];
const appearances = ['System', 'Light', 'Dark'];

function SectionLabel({ children }: { children: string }) {
  return <Text role="heading" className="text-muted-foreground px-1 text-sm font-medium">{children}</Text>;
}

export default function ListsDemo() {
  const [messages, setMessages] = useState(sampleMessages);
  const [opened, setOpened] = useState(false);
  const [language, setLanguage] = useState(0);
  const [appearance, setAppearance] = useState(0);
  const [notifications, setNotifications] = useState(true);
  const next = (index: number, length: number) => (index + 1) % length;

  const settings: { icon: LucideIcon; title: string; value: string; onPress: () => void }[] = [
    { icon: Globe, title: 'Language', value: languages[language] ?? '', onPress: () => setLanguage(index => next(index, languages.length)) },
    { icon: Moon, title: 'Appearance', value: appearances[appearance] ?? '', onPress: () => setAppearance(index => next(index, appearances.length)) },
    { icon: Bell, title: 'Notifications', value: notifications ? 'On' : 'Off', onPress: () => setNotifications(value => !value) },
  ];

  return (
    <Screen back title="Item">
      <View className="gap-2">
        <SectionLabel>Messages</SectionLabel>
        <ItemGroup className="gap-0">
          {messages.map(message => (
            <Item
              key={message.id}
              size="sm"
              className="px-1"
              accessibilityLabel={`${message.name}, ${message.preview}, ${message.time}${message.unread > 0 ? `, ${message.unread} unread` : ''}`}
              onPress={() => setMessages(list => list.map(entry => (entry.id === message.id ? { ...entry, unread: 0 } : entry)))}>
              <Avatar alt={message.name}>
                <AvatarFallback><Text className="text-sm">{message.initials}</Text></AvatarFallback>
              </Avatar>
              <ItemContent>
                <ItemTitle>{message.name}</ItemTitle>
                <ItemDescription numberOfLines={1}>{message.preview}</ItemDescription>
              </ItemContent>
              <ItemActions className="flex-col items-end gap-1.5">
                <Text className="text-muted-foreground text-xs">{message.time}</Text>
                {message.unread > 0 ? (
                  <Badge className="h-5 min-w-5 px-1.5">
                    <Text className="tabular-nums">{message.unread}</Text>
                  </Badge>
                ) : (
                  <View className="h-5" />
                )}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </View>

      <View className="gap-2">
        <SectionLabel>Outline</SectionLabel>
        <Item variant="outline">
          <ItemMedia className="bg-muted size-10 rounded-lg">
            <Icon as={FileText} className="size-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>October report.pdf</ItemTitle>
            <ItemDescription>{opened ? '2.4 MB · Opened just now' : '2.4 MB · Edited 2 hours ago'}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline" size="sm" onPress={() => setOpened(true)}>
              <Text>Open</Text>
            </Button>
          </ItemActions>
        </Item>
        <Item variant="muted">
          <ItemMedia className="bg-background size-10 rounded-lg">
            <Icon as={ShieldCheck} className="size-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Two-step sign in</ItemTitle>
            <ItemDescription>Add a code when you sign in on a new phone.</ItemDescription>
          </ItemContent>
        </Item>
      </View>

      <View className="gap-2">
        <SectionLabel>Settings rows</SectionLabel>
        <ItemGroup className="border-border overflow-hidden rounded-2xl border">
          {settings.map((row, index) => (
            <Fragment key={row.title}>
              {index > 0 ? <ItemSeparator className="ml-11 w-auto" /> : null}
              <Item size="sm" className="rounded-none" accessibilityLabel={`${row.title}, ${row.value}`} onPress={row.onPress}>
                <Icon as={row.icon} className="text-muted-foreground size-[18px]" />
                <ItemContent>
                  <ItemTitle className="font-normal">{row.title}</ItemTitle>
                </ItemContent>
                <Text className="text-muted-foreground text-sm">{row.value}</Text>
                <Icon as={ChevronRight} className="text-muted-foreground size-4" />
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      </View>
    </Screen>
  );
}
