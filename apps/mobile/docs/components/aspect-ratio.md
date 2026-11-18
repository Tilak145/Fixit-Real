<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/aspect-ratio.mdx -->
# Aspect Ratio

Displays content within a desired ratio. Installed in `components/ui/aspect-ratio.tsx`; read it for the exact props and classes.

## Usage

```tsx
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Text } from '@/components/ui/text';
```

```tsx
<AspectRatio ratio={16 / 9} className='h-full w-full justify-center items-center'>
  <Text>16:9</Text>
</AspectRatio>
```
