import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck, Ellipsis, Info, ListChecks, Pencil, Share as ShareIcon, SlidersHorizontal, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type Option } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Entry = { id: string; title: string; done: boolean; category: string };
type Notice = { title: string; detail: string; restore: Entry[] };

const sample: Entry[] = [
  { id: 'bread', title: 'Sourdough bread', done: false, category: 'Bakery' },
  { id: 'eggs', title: 'A dozen eggs', done: false, category: 'Dairy' },
  { id: 'spinach', title: 'Spinach', done: false, category: 'Produce' },
  { id: 'milk', title: 'Oat milk', done: true, category: 'Dairy' },
];
const sorts: Exclude<Option, undefined>[] = [
  { value: 'added', label: 'Date added' },
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
];
const NOTICE_SECONDS = 6;

export default function MenuDemo() {
  const insets = useSafeAreaInsets();
  const contentInsets = { top: insets.top, bottom: insets.bottom, left: 12, right: 12 };
  const [entries, setEntries] = useState(sample);
  const [listName, setListName] = useState('Groceries');
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [sort, setSort] = useState<Option>(sorts[0]);
  const [sortWidth, setSortWidth] = useState<number>();
  const [showDone, setShowDone] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [notice]);

  const toggle = (id: string) => setEntries(list => list.map(entry => (entry.id === id ? { ...entry, done: !entry.done } : entry)));
  const startRename = () => {
    setNameDraft(listName);
    setRenaming(true);
  };
  const finishRename = () => {
    const next = nameDraft.trim();
    if (next) setListName(next);
    setRenaming(false);
  };
  const share = () => {
    const lines = entries.map(entry => `- [${entry.done ? 'x' : ' '}] ${entry.title}`);
    void Share.share({ message: [listName, ...lines].join('\n') }).catch(() => undefined);
  };
  const clearDone = () => {
    const removed = entries.filter(entry => entry.done);
    if (removed.length === 0) return;
    setEntries(list => list.filter(entry => !entry.done));
    setNotice({
      title: `${removed.length} ${removed.length === 1 ? 'item' : 'items'} cleared`,
      detail: removed.length === 1 ? `${removed[0]?.title} was removed.` : `${removed.length} items were removed.`,
      restore: entries,
    });
  };
  const deleteList = () => {
    if (entries.length === 0) return;
    setEntries([]);
    setNotice({ title: 'List emptied', detail: `Everything on ${listName} was removed.`, restore: entries });
  };

  const shown = entries
    .filter(entry => showDone || !entry.done)
    .sort((a, b) => {
      if (sort?.value === 'name') return a.title.localeCompare(b.title);
      if (sort?.value === 'category') return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
      return 0;
    });

  return (
    <Screen
      back
      title="Menu"
      className="gap-5"
      action={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-lg" accessibilityLabel="More">
              <Icon as={Ellipsis} className="size-[22px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" insets={contentInsets} className="w-60">
            <DropdownMenuItem onPress={startRename}>
              <Icon as={Pencil} className="size-4" />
              <Text className="text-[15px]">Rename</Text>
            </DropdownMenuItem>
            <DropdownMenuItem onPress={share}>
              <Icon as={ShareIcon} className="size-4" />
              <Text className="text-[15px]">Share list</Text>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!entries.some(entry => entry.done)} onPress={clearDone}>
              <Icon as={ListChecks} className="size-4" />
              <Text className="text-[15px]">Clear done items</Text>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={entries.length === 0} onPress={deleteList}>
              <Icon as={Trash2} className="size-4" />
              <Text className="text-[15px]">Delete list</Text>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      footer={
        notice ? (
          <View role="status" className="bg-popover border-border flex-row items-center gap-3 rounded-2xl border p-4">
            <Icon as={CircleCheck} className="size-5" />
            <View className="flex-1">
              <Text className="text-sm font-medium">{notice.title}</Text>
              <Text className="text-muted-foreground text-sm">{notice.detail}</Text>
            </View>
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                setEntries(notice.restore);
                setNotice(null);
              }}>
              <Text>Undo</Text>
            </Button>
          </View>
        ) : undefined
      }>
      <View className="min-h-11 flex-row items-center gap-1">
        {renaming ? (
          <Input
            autoFocus
            accessibilityLabel="List name"
            className="flex-1"
            value={nameDraft}
            onChangeText={setNameDraft}
            returnKeyType="done"
            onSubmitEditing={finishRename}
            onBlur={finishRename}
          />
        ) : (
          <>
            <Text role="heading" numberOfLines={1} className="shrink text-xl font-semibold tracking-tight">{listName}</Text>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" accessibilityLabel="About checked items">
                  <Icon as={Info} className="text-muted-foreground size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <Text>Checked items stay on the list until you clear them.</Text>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </View>

      <View className="flex-row items-end gap-2">
        <Field className="min-w-0 flex-1">
          <FieldLabel nativeID="menu-sort">Sort by</FieldLabel>
          <Select value={sort} onValueChange={option => { if (option) setSort(option); }}>
            <SelectTrigger aria-labelledby="menu-sort" className="w-full" onLayout={event => setSortWidth(event.nativeEvent.layout.width)}>
              <SelectValue placeholder="Sort by" className="text-base" />
            </SelectTrigger>
            <SelectContent insets={contentInsets} style={sortWidth ? { width: sortWidth } : undefined}>
              {sorts.map(option => <SelectItem key={option.value} value={option.value} label={option.label} />)}
            </SelectContent>
          </Select>
        </Field>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" accessibilityLabel="Filter items">
              <Icon as={SlidersHorizontal} className="size-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" insets={contentInsets} className="w-64 gap-3">
            <Text className="text-sm font-medium">Filter</Text>
            <Field orientation="horizontal">
              <FieldLabel nativeID="menu-show-done" className="text-[15px]" onPress={() => setShowDone(value => !value)}>Show checked items</FieldLabel>
              <Switch checked={showDone} onCheckedChange={setShowDone} aria-labelledby="menu-show-done" accessibilityLabel="Show checked items" />
            </Field>
          </PopoverContent>
        </Popover>
      </View>

      <View className="gap-4">
        {shown.map(entry => (
          <Field key={entry.id} orientation="horizontal" className="justify-start gap-3">
            <Checkbox checked={entry.done} onCheckedChange={() => toggle(entry.id)} accessibilityLabel={entry.title} />
            <View className="min-w-0 flex-1 flex-row">
              <FieldLabel
                nativeID={`menu-${entry.id}`}
                className={cn('text-[15px] font-normal', entry.done && 'text-muted-foreground line-through')}
                onPress={() => toggle(entry.id)}>
                {entry.title}
              </FieldLabel>
            </View>
          </Field>
        ))}
        {shown.length === 0 ? (
          <Text className="text-muted-foreground text-sm">{entries.length === 0 ? 'This list is empty.' : 'Every item is checked off and hidden.'}</Text>
        ) : null}
      </View>
    </Screen>
  );
}
