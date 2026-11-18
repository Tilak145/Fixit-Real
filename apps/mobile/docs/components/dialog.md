<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/dialog.mdx -->
# Dialog

A window overlaid on either the primary window or another dialog window, rendering the content underneath inert. Installed in `components/ui/dialog.tsx`; read it for the exact props and classes.

## Usage

Overlays render into the `PortalHost` that `app/_layout.tsx` already mounts.

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
```

```tsx
<Dialog>
  <DialogTrigger>
    <Text>Open</Text>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Are you absolutely sure?</DialogTitle>
      <DialogDescription>
        This action cannot be undone. This will permanently delete your account and remove your data
        from our servers.
      </DialogDescription>
    </DialogHeader>
  </DialogContent>
</Dialog>
```
