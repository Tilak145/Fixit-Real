# Icon

ExaSpark composition guide. `components/ui/icon.tsx` renders a Lucide React
Native icon with classes.

```tsx
import { Bell } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

<Icon as={Bell} className="text-muted-foreground size-4" />
```

- The default is `size-5` in the foreground color. Inside a `Button`, `Badge`
  or other component that sets a text color, the icon takes that color.
- Use semantic color classes (`text-primary`, `text-muted-foreground`,
  `text-destructive`). Pass `fill="currentColor"` for a filled state, such as a
  saved heart.
- Import icons from `lucide-react-native`, never `lucide-react` or inline DOM
  SVG.
