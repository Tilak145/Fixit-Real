import { cn } from '@/lib/utils';
import { Platform, TextInput } from 'react-native';

// Uniwind colors the native placeholder from an accent-* class.

function Input({
  className,
  placeholderTextColorClassName = 'accent-muted-foreground',
  ...props
}: React.ComponentProps<typeof TextInput> & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'font-sans border-input bg-input/30 text-foreground flex h-11 w-full min-w-0 flex-row items-center rounded-full border px-4 py-1 text-base leading-5',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
          ),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive'
          ),
        }),
        className
      )}
      placeholderTextColorClassName={placeholderTextColorClassName}
      {...props}
    />
  );
}

export { Input };
