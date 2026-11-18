<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/button.mdx -->
# Button

Displays a button or a component that looks like a button. Installed in `components/ui/button.tsx`; read it for the exact props and classes.

## Usage

```tsx
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

```

```tsx
<Button>
  <Text>Button</Text>
</Button>
```

### Link

You can use the `buttonVariants` and `buttonTextVariants` helpers to create a link that looks like a button.

```tsx
import { buttonVariants, buttonTextVariants } from "@/components/ui/button"
```

```tsx
<Link className={buttonVariants({ variant: 'outline' })}>
  <Text className={buttonTextVariants({ variant: 'outline' })}>Click here</Text>
</Link>
```

Alternatively, you can set the `asChild` parameter and nest the link component.

```tsx
<Link href="/login" asChild>
  <Button>
    <Text>Login</Text>
  </Button>
</Link>
```

## Variants and sizes

`variant`: `default` (the screen's one primary action), `secondary`, `outline`,
`ghost`, `destructive` and `link`.

`size`: `default` is 48 dp high and the size for primary actions; `sm` is 40 dp,
`lg` is 56 dp. Icon-only buttons use `icon` (44 dp), `icon-sm` (36 dp) or
`icon-lg` (48 dp) and need an `accessibilityLabel`.

An `Icon` or `Text` inside a button takes the button's text color, so it needs
no color class:

```tsx
<Button size="icon" accessibilityLabel="New recipe" onPress={create}>
  <Icon as={Plus} />
</Button>
```

Show progress in the label and disable the button while the action runs:

```tsx
<Button disabled={saving} onPress={save}>
  <Text>{saving ? 'Saving…' : 'Save'}</Text>
</Button>
```
