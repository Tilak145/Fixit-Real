<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/hover-card.mdx -->
# Hover Card

For sighted users to preview content available behind a link. Installed in `components/ui/hover-card.tsx`; read it for the exact props and classes.

## Usage

Overlays render into the `PortalHost` that `app/_layout.tsx` already mounts.

```tsx
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Text } from '@/components/ui/text';

```

```tsx
<HoverCard>
  <HoverCardTrigger>
    <Text>Hover</Text>
  </HoverCardTrigger>
  <HoverCardContent>
    <Text>The React Framework – created and maintained by @vercel.</Text>
  </HoverCardContent>
</HoverCard>
```
