# Screen

ExaSpark composition guide. `components/screen.tsx` provides `Screen`,
`ScreenHeader`, `Section` and `goBack`.

```tsx
import { Screen, Section } from '@/components/screen';
```

A top-level screen with a large title and a header action:

```tsx
<Screen title="Recipes" description="12 saved" action={<Button size="icon" accessibilityLabel="New recipe" onPress={create}><Icon as={Plus} /></Button>}>
  <Section title="This week" action={<Button variant="link" size="sm"><Text>See all</Text></Button>}>
    …
  </Section>
</Screen>
```

A pushed screen with Back and a pinned primary action:

```tsx
<Screen back title="New recipe" footer={<Button disabled={saving} onPress={save}><Text>{saving ? 'Saving…' : 'Save recipe'}</Text></Button>}>
  …
</Screen>
```

- `Screen` handles the safe areas, scrolling, keyboard taps and the header.
  `back` shows a Back button and a compact title bar; `goBack` falls back to
  `/` when there is no history.
- `footer` stays above the bottom safe area and the scrolling content. Use it
  for the screen's primary action.
- Screens inside the tab bar pass `edges={['top']}`: the tab bar owns the
  bottom safe area.
- `header` replaces the default header, e.g. for a search field or a custom
  top bar. `scroll={false}` gives a fixed screen for a `FlatList`, chat or map.
- For long collections, use `scroll={false}` with a `FlatList` rather than
  mapping inside the scroll view.
- When you use `SafeAreaView` yourself, put padding classes on a `View`
  inside it. In Preview it sets every edge's padding inline, which replaces
  `px-*`/`p-*` classes on the same element.
