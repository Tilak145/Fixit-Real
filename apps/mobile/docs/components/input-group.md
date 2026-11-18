# Input Group

shadcn/ui's InputGroup for phones: one rounded field with icons, text or
buttons inside it, such as a search box. Installed in
`components/ui/input-group.tsx`.

## Usage

```tsx
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
```

```tsx
<InputGroup>
  <InputGroupAddon><Icon as={Search} className="text-muted-foreground size-4" /></InputGroupAddon>
  <InputGroupInput placeholder="Search recipes" value={query} onChangeText={setQuery} accessibilityLabel="Search recipes" />
  <InputGroupAddon align="inline-end">
    <Button variant="ghost" size="icon-sm" accessibilityLabel="Filters" onPress={openFilters}>
      <Icon as={SlidersHorizontal} className="size-4" />
    </Button>
  </InputGroupAddon>
</InputGroup>
```

- `InputGroupAddon` defaults to `align="inline-start"`; use `inline-end` for a
  trailing clear, show-password or filter button.
- `InputGroupInput` takes every `TextInput` prop. Give it an
  `accessibilityLabel` when no visible label names it.
