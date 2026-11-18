<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/text.mdx -->
# Text

A component for displaying text. Installed in `components/ui/text.tsx`; read it for the exact props and classes.

## Inheritance system

In React Native, child components don't automatically get styles from their parent. This causes issues for things like buttons, where the text inside should change based on the button's style.

To fix this, we use something called `TextClassContext` to pass styles down. The parent (like a Button) wraps its content with this context, and the `Text` component uses the styles from it.

## Usage

```tsx
import { Text } from "@/components/ui/text"
```

```tsx
<Text>Hello, world!</Text>
```
