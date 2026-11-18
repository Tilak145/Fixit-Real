# Item

shadcn/ui's Item for phones: one row with media, a title and description, and
actions. Use it for lists, settings rows and navigation. Installed in
`components/ui/item.tsx`.

## Usage

```tsx
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item';
```

```tsx
<Item onPress={() => router.push('/settings/notifications')}>
  <ItemMedia variant="icon"><Icon as={Bell} className="size-5" /></ItemMedia>
  <ItemContent>
    <ItemTitle>Notifications</ItemTitle>
    <ItemDescription>Reminders and weekly summary</ItemDescription>
  </ItemContent>
  <Icon as={ChevronRight} className="text-muted-foreground size-4" />
</Item>
```

- `onPress` makes the whole row one button. Give it a title or an
  `accessibilityLabel`. A row without `onPress` is a plain view.
- `variant`: `default` (no border), `outline` (bordered card row) or `muted`.
  `size`: `default`, `sm` or `xs`.
- `ItemMedia` `variant`: `icon` (tinted 40 dp tile), `image` (clipped 40 dp
  tile) or `default` (your own size, e.g. `className="size-16 rounded-xl"`).
- Put a `Switch`, `Badge`, value text or icon buttons in `ItemActions`.
- Separate rows with `ItemSeparator`. For a grouped card, wrap the rows in
  `<View className="border-border overflow-hidden rounded-2xl border">` and
  give each row `className="rounded-none"`.
- For long or growing collections, render the rows in a `FlatList` instead of
  mapping inside a `ScrollView`.
