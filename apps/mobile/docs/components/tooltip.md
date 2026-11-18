<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/tooltip.mdx -->
# Tooltip

A popup that displays information related to an element when the element receives keyboard focus, the mouse hovers over it, or when it is pressed. Installed in `components/ui/tooltip.tsx`; read it for the exact props and classes.

## Usage

Overlays render into the `PortalHost` that `app/_layout.tsx` already mounts.

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Text } from "@/components/ui/text"
```

```tsx
<Tooltip>
  <TooltipTrigger><Text>Hover</Text></TooltipTrigger>
  <TooltipContent>
    <Text>Add to library</Text>
  </TooltipContent>
</Tooltip>
```
