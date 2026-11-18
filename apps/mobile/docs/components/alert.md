<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/alert.mdx -->
# Alert

Displays a callout for user attention. Installed in `components/ui/alert.tsx`; read it for the exact props and classes.

## Usage

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from '@/lib/icons/Terminal';
```

```tsx
<Alert icon={Terminal}>
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>
    You can use a terminal to run commands on your computer.
  </AlertDescription>
</Alert>
```
