import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

// shadcn/ui's Empty (radix-maia) for phones: what a screen shows before it has content.

function Empty({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('flex-1 items-center justify-center gap-5 rounded-2xl p-8', className)} {...props} />;
}

function EmptyHeader({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('max-w-sm items-center gap-2', className)} {...props} />;
}

function EmptyMedia({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('bg-muted mb-2 size-12 items-center justify-center rounded-2xl', className)} {...props} />;
}

function EmptyTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text role="heading" className={cn('text-center text-lg font-medium tracking-tight', className)} {...props} />;
}

function EmptyDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('text-muted-foreground text-center text-sm leading-relaxed', className)} {...props} />;
}

function EmptyContent({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('w-full max-w-sm items-center gap-3', className)} {...props} />;
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
