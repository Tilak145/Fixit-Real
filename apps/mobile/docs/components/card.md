<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/card.mdx -->
# Card

Displays a card with header, content, and footer. Installed in `components/ui/card.tsx`; read it for the exact props and classes.

## Usage

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Text } from '@/components/ui/text';

```

```tsx
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card Description</CardDescription>
  </CardHeader>
  <CardContent>
    <Text>Card Content</Text>
  </CardContent>
  <CardFooter>
    <Text>Card Footer</Text>
  </CardFooter>
</Card>
```
