# Empty

shadcn/ui's Empty for phones: what a list or screen shows before it has
content, or when a search finds nothing. Installed in `components/ui/empty.tsx`.

## Usage

```tsx
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
```

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia><Icon as={Inbox} className="size-6" /></EmptyMedia>
    <EmptyTitle>No messages yet</EmptyTitle>
    <EmptyDescription>Messages from your team show up here.</EmptyDescription>
  </EmptyHeader>
  <EmptyContent>
    <Button onPress={invite}><Text>Invite a teammate</Text></Button>
  </EmptyContent>
</Empty>
```

Say what will appear and offer the one action that fills the screen. For a
search with no results, suggest changing the words or filters.
