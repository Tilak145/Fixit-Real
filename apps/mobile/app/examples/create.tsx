import { useState } from 'react';
import { ActivityIndicator, Platform, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { Banknote, Calendar, Car, CircleCheck, CreditCard, House, Landmark, ShoppingBag, Utensils, X, type LucideIcon } from 'lucide-react-native';
import { Screen, goBack } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'spk:example-expense';
const SAMPLE_TODAY = 15;

type Option = { value: string; label: string; icon: LucideIcon };
type Draft = { amount: string; kind: string; category: string; date: string; method: string; note: string; repeat: boolean };
type Status = 'idle' | 'saving' | 'saved' | 'error';

const categories: Option[] = [
  { value: 'groceries', label: 'Groceries', icon: ShoppingBag },
  { value: 'home', label: 'Home', icon: House },
  { value: 'transport', label: 'Transport', icon: Car },
  { value: 'eating-out', label: 'Eating out', icon: Utensils },
];
// The value is how many days ago the expense happened.
const dates: Option[] = [
  { value: '0', label: 'Today', icon: Calendar },
  { value: '1', label: 'Yesterday', icon: Calendar },
  { value: '2', label: '2 days ago', icon: Calendar },
];
const methods: Option[] = [
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'transfer', label: 'Bank transfer', icon: Landmark },
];
const initialDraft: Draft = { amount: '24.50', kind: 'expense', category: 'groceries', date: '0', method: 'card', note: '', repeat: false };

/** Digits and one decimal point, at most two decimals. */
function cleanAmount(text: string) {
  const [whole = '', ...rest] = text.replace(/[^\d.]/g, '').split('.');
  return rest.length > 0 ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}

function ordinal(day: number) {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  return `${day}${teen ? 'th' : (['th', 'st', 'nd', 'rd'][day % 10] ?? 'th')}`;
}

/** The big amount. The hidden copy sizes the field to its text so "$" stays beside the digits. */
function AmountInput({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  const type = 'text-6xl font-semibold tracking-tight tabular-nums';
  return (
    <View className="mt-1 flex-row items-start justify-center gap-1">
      <Text className="text-muted-foreground pt-2 text-2xl font-medium">$</Text>
      <View className="pr-1">
        <Text aria-hidden className={cn(type, 'opacity-0')}>{value || '0.00'}</Text>
        <TextInput
          value={value}
          onChangeText={text => onChangeText(cleanAmount(text))}
          placeholder="0.00"
          keyboardType="decimal-pad"
          maxLength={8}
          accessibilityLabel="Amount"
          className={cn('text-foreground absolute inset-0 p-0', type, Platform.select({ web: 'placeholder:text-muted-foreground outline-none' }))}
          placeholderTextColorClassName="accent-muted-foreground"
          cursorColorClassName="accent-foreground"
        />
      </View>
    </View>
  );
}

function OptionSelect({ labelId, value, options, onChange }: { labelId: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState<number>();
  const selected = options.find(option => option.value === value);
  return (
    <Select
      value={selected ? { value: selected.value, label: selected.label } : undefined}
      onValueChange={option => { if (option) onChange(option.value); }}>
      <SelectTrigger aria-labelledby={labelId} className="w-full" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          {selected ? <Icon as={selected.icon} className="text-muted-foreground size-4" /> : null}
          <SelectValue placeholder="Choose" className="text-base" />
        </View>
      </SelectTrigger>
      <SelectContent insets={{ top: insets.top, bottom: insets.bottom, left: 20, right: 20 }} style={width ? { width } : undefined}>
        {options.map(option => <SelectItem key={option.value} value={option.value} label={option.label} />)}
      </SelectContent>
    </Select>
  );
}

export default function CreatePage({ edges }: { edges?: Edge[] }) {
  const [draft, setDraft] = useState(initialDraft);
  const [status, setStatus] = useState<Status>('idle');
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(current => ({ ...current, [key]: value }));
    setStatus('idle');
  };

  // Local-only: the entry is written to this device's storage and nowhere else.
  const save = async () => {
    setStatus('saving');
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, amount: Number(draft.amount), savedAt: new Date().toISOString() }));
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const saving = status === 'saving';
  return (
    <Screen
      edges={edges}
      className="pt-4"
      header={
        <View className="h-14 flex-row items-center px-2">
          <Button variant="ghost" size="icon" accessibilityLabel="Close" onPress={goBack}>
            <Icon as={X} className="size-[22px]" />
          </Button>
          <Text role="heading" numberOfLines={1} className="flex-1 text-center text-base font-semibold">New expense</Text>
          <View className="size-11" />
        </View>
      }
      footer={
        <View className="gap-2">
          {status === 'saved' ? (
            <View role="status" className="flex-row items-center justify-center gap-1.5">
              <Icon as={CircleCheck} className="text-success size-4" />
              <Text className="text-muted-foreground text-sm">Saved on this device</Text>
            </View>
          ) : null}
          {status === 'error' ? (
            <Text role="alert" className="text-destructive text-center text-sm">Couldn’t save. Your entry is still here.</Text>
          ) : null}
          <Button className="w-full" disabled={saving || !(Number(draft.amount) > 0)} onPress={() => void save()}>
            {saving ? <ActivityIndicator size="small" colorClassName="accent-primary-foreground" /> : null}
            <Text className="text-base">{saving ? 'Saving' : status === 'error' ? 'Try again' : 'Save expense'}</Text>
          </Button>
        </View>
      }>
      <View className="items-center">
        <Text className="text-muted-foreground text-sm">Amount</Text>
        <AmountInput value={draft.amount} onChangeText={text => update('amount', text)} />
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="mt-4"
          value={draft.kind}
          onValueChange={next => { if (next) update('kind', next); }}>
          <ToggleGroupItem value="expense" isFirst><Text>Expense</Text></ToggleGroupItem>
          <ToggleGroupItem value="income" isLast><Text>Income</Text></ToggleGroupItem>
        </ToggleGroup>
      </View>

      <FieldGroup>
        <Field>
          <FieldLabel nativeID="expense-category">Category</FieldLabel>
          <OptionSelect labelId="expense-category" value={draft.category} options={categories} onChange={value => update('category', value)} />
        </Field>
        <View className="flex-row gap-3">
          <Field className="min-w-0 flex-1">
            <FieldLabel nativeID="expense-date">Date</FieldLabel>
            <OptionSelect labelId="expense-date" value={draft.date} options={dates} onChange={value => update('date', value)} />
          </Field>
          <Field className="min-w-0 flex-1">
            <FieldLabel nativeID="expense-method">Paid with</FieldLabel>
            <OptionSelect labelId="expense-method" value={draft.method} options={methods} onChange={value => update('method', value)} />
          </Field>
        </View>
        <Field>
          <FieldLabel nativeID="expense-note">Note</FieldLabel>
          <Textarea
            aria-labelledby="expense-note"
            className="min-h-20"
            placeholder="What was it for?"
            value={draft.note}
            onChangeText={text => update('note', text)}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel nativeID="expense-repeat" className="text-[15px]" onPress={() => update('repeat', !draft.repeat)}>Repeat monthly</FieldLabel>
            <FieldDescription>{`Adds it again on the ${ordinal(SAMPLE_TODAY - Number(draft.date))}`}</FieldDescription>
          </FieldContent>
          <Switch checked={draft.repeat} onCheckedChange={value => update('repeat', value)} aria-labelledby="expense-repeat" accessibilityLabel="Repeat monthly" />
        </Field>
      </FieldGroup>
    </Screen>
  );
}
