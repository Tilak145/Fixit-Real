<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/context-menu.mdx -->
# Context Menu

Displays a menu to the user — such as a set of actions or functions — triggered by a button. Installed in `components/ui/context-menu.tsx`; read it for the exact props and classes.

## Usage

Overlays render into the `PortalHost` that `app/_layout.tsx` already mounts.

```tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Text } from '@/components/ui/text';

```

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <Text>Right click</Text>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>
      <Text>Profile</Text>
    </ContextMenuItem>
    <ContextMenuItem>
      <Text>Billing</Text>
    </ContextMenuItem>
    <ContextMenuItem>
      <Text>Team</Text>
    </ContextMenuItem>
    <ContextMenuItem>
      <Text>Subscription</Text>
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```
