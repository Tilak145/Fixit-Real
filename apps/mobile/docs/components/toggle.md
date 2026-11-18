<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/toggle.mdx -->
# Toggle

A two-state button that can be either on or off. Installed in `components/ui/toggle.tsx`; read it for the exact props and classes.

## Usage

```tsx
import { Toggle } from "@/components/ui/toggle"
```

```tsx
const [pressed, setPressed] = React.useState(false);

return (
  <Toggle pressed={pressed} onPressedChange={setPressed} />
)
```
