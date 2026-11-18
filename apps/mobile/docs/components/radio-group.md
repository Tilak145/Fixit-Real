<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/radio-group.mdx -->
# Radio Group

A set of checkable buttons—known as radio buttons—where no more than one of the buttons can be checked at a time. Installed in `components/ui/radio-group.tsx`; read it for the exact props and classes.

## Usage

```tsx
import { View } from "react-native"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
```

```tsx
<RadioGroup defaultValue="comfortable">
  <View className="flex flex-row items-center gap-3">
    <RadioGroupItem value="default" id="r1" />
    <Label htmlFor="r1">Default</Label>
  </View>
  <View className="flex flex-row items-center gap-3">
    <RadioGroupItem value="comfortable" id="r2" />
    <Label htmlFor="r2">Comfortable</Label>
  </View>
  <View className="flex flex-row items-center gap-3">
    <RadioGroupItem value="compact" id="r3" />
    <Label htmlFor="r3">Compact</Label>
  </View>
</RadioGroup>
```
