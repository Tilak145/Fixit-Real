import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Platform, TextInput, View } from 'react-native';

// shadcn/ui's InputGroup (radix-maia) for phones: one pill with an input and
// leading or trailing icons, text or buttons.

function InputGroup({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View
      role="group"
      className={cn(
        'border-input bg-input/30 h-11 w-full flex-row items-center rounded-full border',
        Platform.select({ web: 'has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-ring/50 has-[input:focus-visible]:ring-[3px]' }),
        className
      )}
      {...props}
    />
  );
}

function InputGroupAddon({ className, align = 'inline-start', ...props }: React.ComponentProps<typeof View> & { align?: 'inline-start' | 'inline-end' }) {
  return (
    <TextClassContext.Provider value="text-muted-foreground text-sm">
      <View className={cn('flex-row items-center gap-2', align === 'inline-start' ? 'order-first pl-4' : 'order-last pr-3', className)} {...props} />
    </TextClassContext.Provider>
  );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      className={cn(
        'font-sans text-foreground h-full min-w-0 flex-1 bg-transparent px-3 text-base',
        Platform.select({ web: 'placeholder:text-muted-foreground outline-none' }),
        className
      )}
      placeholderTextColorClassName="accent-muted-foreground"
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupInput };
