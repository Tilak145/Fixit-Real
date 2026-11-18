import { Separator } from '@/components/ui/separator';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';

// shadcn/ui's Item (radix-maia) for phones: a row with media, content and actions.

const itemVariants = cva('group flex-row items-center rounded-2xl border', {
  variants: {
    variant: {
      default: 'border-transparent',
      outline: 'border-border',
      muted: 'bg-muted/50 border-transparent',
    },
    size: {
      default: 'gap-3.5 px-4 py-3.5',
      sm: 'gap-3.5 px-3.5 py-3',
      xs: 'gap-2.5 px-3 py-2.5',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

type ItemProps = Omit<React.ComponentProps<typeof Pressable>, 'children'> &
  VariantProps<typeof itemVariants> & { children?: React.ReactNode };

/** Pass onPress to make the whole row a button; it then needs an accessibilityLabel or a title. */
function Item({ className, variant, size, onPress, children, ...props }: ItemProps) {
  const classes = cn(itemVariants({ variant, size }), className);
  if (!onPress) return <View className={classes} {...(props as React.ComponentProps<typeof View>)}>{children}</View>;
  return (
    <Pressable
      role="button"
      onPress={onPress}
      className={cn(classes, 'active:bg-muted/60', Platform.select({ web: 'hover:bg-muted/50 cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50' }))}
      {...props}>
      {children}
    </Pressable>
  );
}

function ItemGroup({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View role="list" className={cn('flex flex-col', className)} {...props} />;
}

function ItemSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator className={cn('my-0', className)} {...props} />;
}

const itemMediaVariants = cva('shrink-0 items-center justify-center', {
  variants: {
    variant: {
      default: '',
      icon: 'size-10 rounded-xl bg-muted',
      image: 'size-10 overflow-hidden rounded-xl',
    },
  },
  defaultVariants: { variant: 'default' },
});

function ItemMedia({ className, variant, ...props }: React.ComponentProps<typeof View> & VariantProps<typeof itemMediaVariants>) {
  return <View className={cn(itemMediaVariants({ variant }), className)} {...props} />;
}

function ItemContent({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('min-w-0 flex-1 gap-1', className)} {...props} />;
}

function ItemTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text numberOfLines={1} className={cn('text-[15px] font-medium leading-snug', className)} {...props} />;
}

function ItemDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text numberOfLines={2} className={cn('text-muted-foreground text-sm', className)} {...props} />;
}

function ItemActions({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <TextClassContext.Provider value="text-muted-foreground text-sm">
      <View className={cn('flex-row items-center gap-2', className)} {...props} />
    </TextClassContext.Provider>
  );
}

function ItemHeader({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('w-full flex-row items-center justify-between gap-2', className)} {...props} />;
}

function ItemFooter({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('w-full flex-row items-center justify-between gap-2', className)} {...props} />;
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  itemVariants,
};
