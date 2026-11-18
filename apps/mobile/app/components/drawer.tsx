import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { NativeOnlyAnimatedView } from '@/components/ui/native-only-animated-view';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

type Entry = { id: string; title: string; category?: string; done: boolean };

const sample: Entry[] = [
  { id: 'bread', title: 'Sourdough bread', done: false },
  { id: 'eggs', title: 'A dozen eggs', done: false },
  { id: 'spinach', title: 'Spinach', done: false },
];
const categories = ['Dairy', 'Bakery', 'Produce', 'Other'];

/**
 * A bottom sheet on the native Modal: a dimmed backdrop that closes it, and a panel with a handle.
 * Android Back and Escape on the web call onClose through onRequestClose.
 */
function AddItemSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (title: string, category: string) => void }) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('Oat milk');
  const [category, setCategory] = useState('Dairy');
  const [remind, setRemind] = useState(true);
  const title = name.trim();

  const add = () => {
    if (!title) return;
    onAdd(title, category);
    setName('');
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable accessibilityLabel="Close" onPress={onClose} className="absolute inset-0 bg-black/50" />
        <NativeOnlyAnimatedView entering={SlideInDown.duration(250).reduceMotion(ReduceMotion.System)}>
          <View
            role="dialog"
            aria-modal
            aria-label="Add item"
            className="bg-background border-border w-full max-w-md self-center rounded-t-4xl border border-b-0"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
            <View className="bg-muted mt-2 h-1.5 w-24 self-center rounded-full" />
            <View className="items-center gap-0.5 p-4">
              <Text role="heading" className="text-lg font-medium">Add item</Text>
              <Text className="text-muted-foreground text-sm">It goes to the top of Groceries.</Text>
            </View>
            <View className="gap-4 px-4">
              <Input accessibilityLabel="Item name" value={name} onChangeText={setName} placeholder="Item name" returnKeyType="done" onSubmitEditing={add} />
              <View className="flex-row flex-wrap gap-2">
                {categories.map(option => (
                  <Toggle key={option} variant="outline" pressed={category === option} onPressedChange={() => setCategory(option)} accessibilityLabel={option}>
                    <Text>{option}</Text>
                  </Toggle>
                ))}
              </View>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel nativeID="sheet-remind" className="text-[15px]" onPress={() => setRemind(value => !value)}>Remind me at the store</FieldLabel>
                </FieldContent>
                <Switch checked={remind} onCheckedChange={setRemind} aria-labelledby="sheet-remind" accessibilityLabel="Remind me at the store" />
              </Field>
            </View>
            <View className="gap-2 p-4">
              <Button disabled={!title} onPress={add}>
                <Text className="text-[15px]">Add to list</Text>
              </Button>
              <Button variant="outline" onPress={onClose}>
                <Text className="text-[15px]">Cancel</Text>
              </Button>
            </View>
          </View>
        </NativeOnlyAnimatedView>
      </View>
    </Modal>
  );
}

export default function DrawerDemo() {
  const [entries, setEntries] = useState(sample);
  const [open, setOpen] = useState(false);
  const toggle = (id: string) => setEntries(list => list.map(entry => (entry.id === id ? { ...entry, done: !entry.done } : entry)));

  return (
    <Screen
      back
      title="Sheet"
      action={
        <Button variant="ghost" size="icon" accessibilityLabel="Add item" onPress={() => setOpen(true)}>
          <Icon as={Plus} className="size-[22px]" />
        </Button>
      }>
      <View className="gap-4">
        <Text role="heading" className="text-muted-foreground px-1 text-sm font-medium">Groceries</Text>
        {entries.map(entry => (
          <Field key={entry.id} orientation="horizontal" className="justify-start gap-3">
            <Checkbox checked={entry.done} onCheckedChange={() => toggle(entry.id)} accessibilityLabel={entry.title} />
            <View className="min-w-0 flex-1 flex-row">
              <FieldLabel
                nativeID={`entry-${entry.id}`}
                className={cn('text-[15px] font-normal', entry.done && 'text-muted-foreground line-through')}
                onPress={() => toggle(entry.id)}>
                {entry.title}
              </FieldLabel>
            </View>
            {entry.category ? <Text className="text-muted-foreground text-sm">{entry.category}</Text> : null}
          </Field>
        ))}
      </View>
      <AddItemSheet
        open={open}
        onClose={() => setOpen(false)}
        onAdd={(title, category) => setEntries(list => [{ id: `entry-${Date.now()}`, title, category, done: false }, ...list])}
      />
    </Screen>
  );
}
