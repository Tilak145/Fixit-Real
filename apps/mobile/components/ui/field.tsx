import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View } from 'react-native';

// shadcn/ui's Field (radix-maia) for phones: a labelled control with its
// description and error. Give the control the label's nativeID through
// aria-labelledby, e.g. <FieldLabel nativeID="email"> + <Input aria-labelledby="email" />.

function FieldGroup({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('flex w-full flex-col gap-5', className)} {...props} />;
}

const fieldVariants = cva('flex w-full gap-2', {
  variants: {
    orientation: {
      vertical: 'flex-col',
      horizontal: 'flex-row items-center justify-between gap-4',
    },
  },
  defaultVariants: { orientation: 'vertical' },
});

function Field({ className, orientation, ...props }: React.ComponentProps<typeof View> & VariantProps<typeof fieldVariants>) {
  return <View role="group" className={cn(fieldVariants({ orientation }), className)} {...props} />;
}

function FieldContent({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('min-w-0 flex-1 gap-1', className)} {...props} />;
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label className={cn('text-sm font-medium', className)} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('text-muted-foreground text-sm leading-normal', className)} {...props} />;
}

/** Renders nothing without a message, so it can stay in place. */
function FieldError({ className, children, ...props }: React.ComponentProps<typeof Text>) {
  if (children === undefined || children === null || children === false || children === '') return null;
  return <Text role="alert" className={cn('text-destructive text-sm', className)} {...props}>{children}</Text>;
}

export { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel };
