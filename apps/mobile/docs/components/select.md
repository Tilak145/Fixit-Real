<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/select.mdx -->
# Select

Displays a list of options for the user to pick from—triggered by a button. Installed in `components/ui/select.tsx`; read it for the exact props and classes.

## Usage

Overlays render into the `PortalHost` that `app/_layout.tsx` already mounts.

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
```

```tsx
 <Select>
  <SelectTrigger className='w-[180px]'>
    <SelectValue placeholder='Select a fruit' />
  </SelectTrigger>
  <SelectContent insets={contentInsets} className='w-[180px]'>
    <SelectGroup>
      <SelectLabel>Fruits</SelectLabel>
      <SelectItem label='Apple' value='apple'>
        Apple
      </SelectItem>
      <SelectItem label='Banana' value='banana'>
        Banana
      </SelectItem>
      <SelectItem label='Blueberry' value='blueberry'>
        Blueberry
      </SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

## Long lists

`react-native-gesture-handler` is installed. For a long list, add this `NativeSelectScrollView` to the file that uses the select and wrap the items in it.

```tsx
import { ScrollView } from 'react-native-gesture-handler';
/**
 * @platform Native only
 * Returns the children on the web
 */
function NativeSelectScrollView({ className, ...props }: React.ComponentProps<typeof ScrollView>) {
  if (Platform.OS === 'web') {
    return <>{props.children}</>;
  }
  return <ScrollView className={cn('max-h-52', className)} {...props} />;
}
```
