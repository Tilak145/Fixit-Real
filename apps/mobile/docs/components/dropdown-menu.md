<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/dropdown-menu.mdx -->
# Dropdown Menu

Displays a menu to the user — such as a set of actions or functions — triggered by a button. Installed in `components/ui/dropdown-menu.tsx`; read it for the exact props and classes.

## Usage

Overlays render into the `PortalHost` that `app/_layout.tsx` already mounts.

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Text } from '@/components/ui/text';

```

```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <Text>Open</Text>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>
      <Text>My Account</Text>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
      <Text>Profile</Text>
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Text>Team</Text>
    </DropdownMenuItem> 
  </DropdownMenuContent>
</DropdownMenu>
```
