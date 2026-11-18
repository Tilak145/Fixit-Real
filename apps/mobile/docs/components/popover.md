<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/popover.mdx -->
# Popover

Displays rich content in a portal, triggered by a button. Installed in `components/ui/popover.tsx`; read it for the exact props and classes.

## Usage

Overlays render into the `PortalHost` that `app/_layout.tsx` already mounts.

```tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Text } from '@/components/ui/text';

```

```tsx
<Popover>
  <PopoverTrigger>
    <Text>Open</Text>
  </PopoverTrigger>
  <PopoverContent>
    <Text>Place content for the popover here.</Text>
  </PopoverContent>
</Popover>
```
