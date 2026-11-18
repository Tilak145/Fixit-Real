<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/collapsible.mdx -->
# Collapsible

A control that allows the user to toggle between checked and not checked. Installed in `components/ui/collapsible.tsx`; read it for the exact props and classes.

## Usage

```tsx
import { Collapsible } from "@/components/ui/collapsible"
import { Text } from "@/components/ui/text"

```

```tsx
<Collapsible>
  <CollapsibleTrigger>
    <Text>Can I use this in my project?</Text>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <Text>Yes. Free to use for personal and commercial projects. No attribution required.</Text>
  </CollapsibleContent>
</Collapsible>
```
