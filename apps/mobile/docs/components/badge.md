<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/badge.mdx -->
# Badge

Displays a badge or a component that looks like a badge. Installed in `components/ui/badge.tsx`; read it for the exact props and classes.

## Usage

```tsx
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';

```

```tsx
<Badge>
  <Text>Badge</Text>
</Badge>
```

### Link

You can use the `badgeVariants` and `badgeTextVariants` helpers to create a link that looks like a badge.

```tsx
import { badgeVariants, badgeTextVariants } from "@/components/ui/badge"
```

```tsx
<Link className={badgeVariants({ variant: 'outline' })}>
  <Text className={badgeTextVariants({ variant: 'outline' })}>Badge</Text>
</Link>
```
