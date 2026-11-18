import { useState } from 'react';
import { View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Text } from '@/components/ui/text';

type List = { id: string; title: string; items: number; done: number };

const sample: List[] = [
  { id: 'groceries', title: 'Groceries', items: 12, done: 4 },
  { id: 'weekend-trip', title: 'Weekend trip', items: 8, done: 1 },
  { id: 'gift-ideas', title: 'Gift ideas', items: 5, done: 0 },
];

function summary(list: List) {
  if (list.items === 0) return 'No items yet';
  return `${list.items} ${list.items === 1 ? 'item' : 'items'}${list.done > 0 ? ` · ${list.done} done` : ''}`;
}

/** A confirmation that interrupts: the person has to answer before going on. */
function DeleteList({ list, onDelete }: { list: List; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" accessibilityLabel={`Delete ${list.title}`}>
          <Icon as={Trash2} className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <View className="bg-muted size-14 items-center justify-center self-center rounded-2xl">
            <Icon as={Trash2} className="size-7" />
          </View>
          <AlertDialogTitle className="text-center">{`Delete “${list.title}”?`}</AlertDialogTitle>
          <AlertDialogDescription className="text-center">{list.items > 0 ? `This removes the list and its ${list.items} ${list.items === 1 ? 'item' : 'items'} from this device.` : 'This removes the list from this device.'}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            <Text>Cancel</Text>
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onPress={() => {
              setOpen(false);
              onDelete();
            }}>
            <Text>Delete list</Text>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A dialog with a form: it can be dismissed by tapping outside or with Cancel. */
function NewList({ onCreate }: { onCreate: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const name = title.trim();
  const create = () => {
    if (!name) return;
    onCreate(name);
    setOpen(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) setTitle('');
      }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" accessibilityLabel="New list">
          <Icon as={Plus} className="size-[22px]" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New list</DialogTitle>
          <DialogDescription>Give it a name. You can add items later.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel nativeID="new-list-name">Name</FieldLabel>
          <Input aria-labelledby="new-list-name" autoFocus value={title} onChangeText={setTitle} placeholder="Weekend errands" returnKeyType="done" onSubmitEditing={create} />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">
              <Text>Cancel</Text>
            </Button>
          </DialogClose>
          <Button disabled={!name} onPress={create}>
            <Text>Create list</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OverlaysDemo() {
  const [lists, setLists] = useState(sample);
  return (
    <Screen
      back
      title="Dialog"
      className="gap-2"
      action={<NewList onCreate={title => setLists(current => [{ id: `list-${Date.now()}`, title, items: 0, done: 0 }, ...current])} />}>
      {lists.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No lists yet</EmptyTitle>
            <EmptyDescription>Tap + to create one.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      {lists.map(list => (
        <Item key={list.id} variant="outline">
          <ItemContent>
            <ItemTitle>{list.title}</ItemTitle>
            <ItemDescription>{summary(list)}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <DeleteList list={list} onDelete={() => setLists(current => current.filter(entry => entry.id !== list.id))} />
          </ItemActions>
        </Item>
      ))}
    </Screen>
  );
}
