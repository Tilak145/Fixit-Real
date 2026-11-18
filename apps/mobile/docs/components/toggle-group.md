<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/toggle-group.mdx -->
# Toggle Group

A set of two-state buttons that can be toggled on or off. Installed in `components/ui/toggle-group.tsx`; read it for the exact props and classes.

## Usage

```tsx
import { Bold, Italic, Underline } from 'lucide-react-native';
import { ToggleGroup, ToggleGroupIcon, ToggleGroupItem } from '@/components/ui/toggle-group';
import * as React from 'react';
```

```tsx
  const [value, setValue] = React.useState<string[]>([]);
  return (
    <ToggleGroup value={value} onValueChange={setValue} variant='outline' type='multiple'>
      <ToggleGroupItem isFirst value='bold' aria-label='Toggle bold'>
        <ToggleGroupIcon as={Bold} />
      </ToggleGroupItem>
      <ToggleGroupItem value='italic' aria-label='Toggle italic'>
        <ToggleGroupIcon as={Italic} />
      </ToggleGroupItem>
      <ToggleGroupItem isLast value='strikethrough' aria-label='Toggle strikethrough'>
        <ToggleGroupIcon as={Underline} />
      </ToggleGroupItem>
    </ToggleGroup>
  );
```
