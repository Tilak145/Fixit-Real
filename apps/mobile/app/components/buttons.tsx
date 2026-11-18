import { useState } from 'react';
import { ActivityIndicator, Share, View } from 'react-native';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Heart, Plus, Share as ShareIcon } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const variants = [
  ['default', 'Default'],
  ['secondary', 'Secondary'],
  ['outline', 'Outline'],
  ['ghost', 'Ghost'],
  ['destructive', 'Delete'],
  ['link', 'Learn more'],
] as const;

function SectionLabel({ children }: { children: string }) {
  return <Text role="heading" className="text-muted-foreground text-sm font-medium">{children}</Text>;
}

function dayLabel(offset: number) {
  if (offset === 0) return 'Today';
  if (offset === -1) return 'Yesterday';
  if (offset === 1) return 'Tomorrow';
  return offset < 0 ? `${-offset} days ago` : `In ${offset} days`;
}

export default function ButtonsDemo() {
  const [liked, setLiked] = useState(false);
  const [offset, setOffset] = useState(0);

  return (
    <Screen
      back
      title="Button"
      className="gap-7"
      footer={
        <View className="gap-2">
          <Button className="w-full">
            <Text className="text-base">Get started</Text>
          </Button>
          <Button variant="ghost" className="w-full">
            <Text className="text-base">I already have an account</Text>
          </Button>
        </View>
      }>
      <View className="gap-3">
        <SectionLabel>Variants</SectionLabel>
        <View className="gap-2">
          {[variants.slice(0, 2), variants.slice(2, 4), variants.slice(4)].map((row, index) => (
            <View key={index} className="flex-row gap-2">
              {row.map(([variant, label]) => (
                <Button key={variant} variant={variant} className="flex-1">
                  <Text className="text-[15px]">{label}</Text>
                </Button>
              ))}
            </View>
          ))}
        </View>
      </View>

      <View className="gap-3">
        <SectionLabel>Sizes and icons</SectionLabel>
        <View className="flex-row flex-wrap items-center gap-2">
          <Button variant="outline" size="sm">
            <Text>Small</Text>
          </Button>
          <Button variant="outline">
            <Text>Default</Text>
          </Button>
          <Button variant="outline" size="lg">
            <Text>Large</Text>
          </Button>
        </View>
        <View className="flex-row flex-wrap items-center gap-2">
          <Button>
            <Icon as={Plus} className="size-4" />
            <Text>Add item</Text>
          </Button>
          <Button variant="outline">
            <Text>Next</Text>
            <Icon as={ArrowRight} className="size-4" />
          </Button>
          <Button variant="outline" size="icon-lg" accessibilityLabel={liked ? 'Unlike' : 'Like'} onPress={() => setLiked(value => !value)}>
            <Icon as={Heart} fill={liked ? 'currentColor' : 'none'} className={cn('size-5', liked && 'text-destructive')} />
          </Button>
          <Button variant="secondary" size="icon-lg" accessibilityLabel="Share" onPress={() => void Share.share({ message: 'Button example' }).catch(() => undefined)}>
            <Icon as={ShareIcon} className="size-5" />
          </Button>
        </View>
      </View>

      <View className="gap-3">
        <SectionLabel>Groups</SectionLabel>
        <View className="flex-row items-center gap-2">
          <View className="flex-row">
            <Button variant="outline" size="icon-lg" accessibilityLabel="Previous day" className="rounded-r-none" onPress={() => setOffset(value => value - 1)}>
              <Icon as={ChevronLeft} className="size-5" />
            </Button>
            <Button variant="outline" className="min-w-24 rounded-none border-l-0" onPress={() => setOffset(0)}>
              <Text>{dayLabel(offset)}</Text>
            </Button>
            <Button variant="outline" size="icon-lg" accessibilityLabel="Next day" className="rounded-l-none border-l-0" onPress={() => setOffset(value => value + 1)}>
              <Icon as={ChevronRight} className="size-5" />
            </Button>
          </View>
          <View className="flex-row">
            <Button className="rounded-r-none">
              <Text>Save</Text>
            </Button>
            <Button size="icon-lg" accessibilityLabel="More save options" className="border-primary-foreground/20 rounded-l-none border-l">
              <Icon as={ChevronDown} className="size-5" />
            </Button>
          </View>
        </View>
      </View>

      <View className="gap-3">
        <SectionLabel>States</SectionLabel>
        <View className="flex-row items-center gap-2">
          <Button disabled>
            <ActivityIndicator size="small" colorClassName="accent-primary-foreground" />
            <Text>Saving</Text>
          </Button>
          <Button variant="outline" disabled>
            <Text>Disabled</Text>
          </Button>
        </View>
      </View>
    </Screen>
  );
}
