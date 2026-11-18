import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { ArrowUp, ChevronLeft, MapPin, User } from 'lucide-react-native';
import { Screen, goBack } from '@/components/screen';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type Message = {
  id: string;
  mine: boolean;
  text?: string;
  /** A shared place, shown as a card instead of a bubble. */
  place?: { name: string; detail: string };
};
type Thread = { name: string; initials: string; status: string; stamp?: string; messages: Message[] };

// Sample conversations. The ids match the rows in app/examples/inbox.tsx.
const ana: Thread = {
  name: 'Ana Marsh',
  initials: 'AM',
  status: 'Active now',
  stamp: 'Today 9:12',
  messages: [
    { id: 'm1', mine: false, text: 'Are we still on for dinner tonight?' },
    { id: 'm2', mine: false, text: 'I found a new place near the lake' },
    { id: 'm3', mine: true, text: 'Yes! What time works for you?' },
    { id: 'm4', mine: false, text: '7 o’clock? I’ll book a table.' },
    { id: 'm5', mine: true, text: 'Perfect. See you there' },
    { id: 'm6', mine: false, place: { name: 'Lakeside Kitchen', detail: '12 Harbor St · 7:00 PM' } },
    { id: 'm7', mine: false, text: 'Sounds good, see you at 7 then!' },
  ],
};
const threads: Record<string, Thread> = {
  ana,
  ravi: {
    name: 'Ravi Kumar',
    initials: 'RK',
    status: 'Last seen yesterday',
    stamp: 'Yesterday',
    messages: [
      { id: 'm1', mine: true, text: 'Did you get any good shots on Saturday?' },
      { id: 'm2', mine: false, text: 'Sent the photos from Saturday.' },
    ],
  },
  'book-club': {
    name: 'Book club',
    initials: 'BC',
    status: '5 members',
    stamp: 'Tuesday',
    messages: [
      { id: 'm1', mine: true, text: 'Is everyone caught up on the book?' },
      { id: 'm2', mine: false, text: 'Chapter 9 was wild' },
    ],
  },
  sam: {
    name: 'Sam Chen',
    initials: 'SC',
    status: 'Last seen Monday',
    stamp: 'Monday',
    messages: [
      { id: 'm1', mine: false, text: 'Can we move it to Thursday?' },
      { id: 'm2', mine: true, text: 'Thanks, that works for me.' },
    ],
  },
  lena: {
    name: 'Lena Torres',
    initials: 'LT',
    status: 'Last seen Oct 8',
    stamp: 'Oct 8',
    messages: [
      { id: 'm1', mine: true, text: 'I hope the shakshuka turned out well!' },
      { id: 'm2', mine: false, text: 'The recipe was perfect, thank you!' },
    ],
  },
  new: { name: 'New message', initials: '', status: 'Write your first message below', messages: [] },
};

function Bubble({ message }: { message: Message }) {
  if (message.place) {
    return (
      <View className="bg-muted flex-row items-center gap-2 self-start rounded-3xl px-2 py-1.5">
        <View className="bg-background size-14 items-center justify-center rounded-2xl">
          <Icon as={MapPin} className="size-[22px]" />
        </View>
        <View className="pr-3">
          <Text className="text-sm font-medium">{message.place.name}</Text>
          <Text className="text-muted-foreground text-xs">{message.place.detail}</Text>
        </View>
      </View>
    );
  }
  return (
    <View className={cn('max-w-[80%] rounded-3xl px-4 py-2.5', message.mine ? 'bg-primary self-end' : 'bg-secondary self-start')}>
      <Text className={cn('text-[15px] leading-5', message.mine ? 'text-primary-foreground' : 'text-secondary-foreground')}>{message.text}</Text>
    </View>
  );
}

export default function ConversationPage({ edges }: { edges?: Edge[] }) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const thread = threads[id ?? ''] ?? ana;
  const [messages, setMessages] = useState(thread.messages);
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollView>(null);
  const text = draft.trim();

  // Local-only: the message is added to this conversation on screen and nowhere else.
  const send = () => {
    if (!text) return;
    setMessages(list => [...list, { id: `sent-${list.length + 1}`, mine: true, text }]);
    setDraft('');
  };

  return (
    <Screen
      edges={edges}
      scroll={false}
      className="gap-0 px-0 pb-0 pt-0"
      header={
        <View className="border-border h-14 flex-row items-center gap-2 border-b px-2">
          <Button variant="ghost" size="icon" accessibilityLabel="Go back" onPress={goBack}>
            <Icon as={ChevronLeft} className="size-6" />
          </Button>
          <Avatar alt={thread.name}>
            <AvatarFallback>
              {thread.initials ? <Text className="text-sm">{thread.initials}</Text> : <Icon as={User} className="size-5" />}
            </AvatarFallback>
          </Avatar>
          <View className="flex-1">
            <Text role="heading" numberOfLines={1} className="text-[15px] font-semibold leading-tight">{thread.name}</Text>
            <Text numberOfLines={1} className="text-muted-foreground text-xs">{thread.status}</Text>
          </View>
        </View>
      }
      footer={
        <InputGroup>
          <InputGroupInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={send}
            submitBehavior="submit"
            blurOnSubmit={false}
            placeholder="Message"
            returnKeyType="send"
            accessibilityLabel="Message"
          />
          <InputGroupAddon align="inline-end">
            <Button size="icon-sm" accessibilityLabel="Send message" disabled={!text} onPress={send}>
              <Icon as={ArrowUp} className="text-primary-foreground size-4" />
            </Button>
          </InputGroupAddon>
        </InputGroup>
      }>
      <ScrollView
        ref={scroller}
        className="flex-1"
        contentContainerClassName="gap-2 px-4 pb-4 pt-4"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
        {thread.stamp ? <Text className="text-muted-foreground self-center pb-1 text-xs">{thread.stamp}</Text> : null}
        {messages.length === 0 ? <Text className="text-muted-foreground self-center pt-8 text-sm">No messages yet.</Text> : null}
        {messages.map(message => <Bubble key={message.id} message={message} />)}
      </ScrollView>
    </Screen>
  );
}
