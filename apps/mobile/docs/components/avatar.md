<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/avatar.mdx -->
# Avatar

An image element with a fallback for representing the user. Installed in `components/ui/avatar.tsx`; read it for the exact props and classes.

## Usage

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';

```

```tsx
<Avatar alt="Zach Nugent's Avatar">
  <AvatarImage source={{ uri: 'https://github.com/mrzachnugent.png' }} />
  <AvatarFallback>
    <Text>ZN</Text>
  </AvatarFallback>
</Avatar>
```
