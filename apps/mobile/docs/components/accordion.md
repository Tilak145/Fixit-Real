<!-- Adapted from the React Native Reusables documentation (MIT): https://raw.githubusercontent.com/mrzachnugent/react-native-reusables/main/apps/docs/content/docs/components/accordion.mdx -->
# Accordion

A vertically stacked set of interactive headings that each reveal a section of content. Installed in `components/ui/accordion.tsx`; read it for the exact props and classes.

## Usage

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';
```

```tsx
<Accordion type='single' collapsible>
  <AccordionItem value='item-1'>
    <AccordionTrigger>
      <Text>Is it accessible?</Text>
    </AccordionTrigger>
    <AccordionContent>
      <Text>Yes. It adheres to the WAI-ARIA design pattern.</Text>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```
