<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/menubar.mdx -->
# Menubar

A visually persistent menu common in desktop applications that provides quick access to a consistent set of commands. Installed in `components/ui/menubar.tsx`; read it for the exact props and classes.

## Usage

Overlays render into the `PortalHost` that `app/_layout.tsx` already mounts.

```tsx
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar"
import { Text } from '@/components/ui/text';

```

```tsx
<Menubar>
  <MenubarMenu>
    <MenubarTrigger>
      <Text>File</Text>
    </MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        <Text>New Tab</Text> <MenubarShortcut>⌘T</MenubarShortcut>
      </MenubarItem>
      <MenubarItem>
        <Text>New Window</Text>
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem>
        <Text>Share</Text>
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem>
        <Text>Print</Text>
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>
```
