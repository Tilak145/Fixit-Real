import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, Minus, ShoppingBag } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const categories = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'transport', label: 'Transport' },
  { value: 'home', label: 'Home' },
  { value: 'eating-out', label: 'Eating out' },
];
const OTP_LENGTH = 6;

function CategorySelect({ labelId }: { labelId: string }) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState(categories[0]);
  const [width, setWidth] = useState<number>();
  return (
    <Select value={category} onValueChange={option => { if (option) setCategory(option); }}>
      <SelectTrigger aria-labelledby={labelId} className="w-full" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <Icon as={ShoppingBag} className="text-muted-foreground size-4" />
          <SelectValue placeholder="Choose a category" className="text-base" />
        </View>
      </SelectTrigger>
      <SelectContent insets={{ top: insets.top, bottom: insets.bottom, left: 20, right: 20 }} style={width ? { width } : undefined}>
        {categories.map(option => <SelectItem key={option.value} value={option.value} label={option.label} />)}
      </SelectContent>
    </Select>
  );
}

function OtpGroup({ digits, start, active }: { digits: string[]; start: number; active: number }) {
  return (
    <View className="border-input bg-input/30 flex-row overflow-hidden rounded-2xl border">
      {digits.map((digit, index) => {
        const position = start + index;
        return (
          <View key={position} className={cn('size-11 items-center justify-center', index > 0 && 'border-input border-l', position === active && 'border-ring bg-input/50 border')}>
            {digit ? <Text className="text-base tabular-nums">{digit}</Text> : null}
            {!digit && position === active ? <View className="bg-foreground h-4 w-px" /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Six boxes drawn over one invisible text field, so the code can be typed or pasted from an SMS. */
function OtpField({ labelId, value, onChange }: { labelId: string; value: string; onChange: (value: string) => void }) {
  const [focused, setFocused] = useState(false);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] ?? '');
  const active = focused ? Math.min(value.length, OTP_LENGTH - 1) : -1;
  return (
    <View className="self-start">
      <View className="flex-row items-center">
        <OtpGroup digits={digits.slice(0, 3)} start={0} active={active} />
        <View className="px-1.5">
          <Icon as={Minus} className="text-muted-foreground size-4" />
        </View>
        <OtpGroup digits={digits.slice(3)} start={3} active={active} />
      </View>
      <TextInput
        value={value}
        onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, OTP_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        aria-labelledby={labelId}
        accessibilityLabel="Verification code"
        caretHidden
        className="absolute inset-0 opacity-0"
      />
    </View>
  );
}

export default function InputsDemo() {
  const [name, setName] = useState('Jordan Lee');
  const [email, setEmail] = useState('jordan@');
  const [password, setPassword] = useState('secret-pass');
  const [showPassword, setShowPassword] = useState(false);
  const [amount, setAmount] = useState('24.50');
  const [code, setCode] = useState('481');
  const [note, setNote] = useState('');
  const emailInvalid = email.length > 0 && !/^\S+@\S+\.\S+$/.test(email);

  return (
    <Screen back title="Input">
      <FieldGroup className="gap-6">
        <Field>
          <FieldLabel nativeID="demo-name">Display name</FieldLabel>
          <Input aria-labelledby="demo-name" value={name} onChangeText={setName} autoComplete="name" />
          <FieldDescription>Shown on your profile and receipts.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel nativeID="demo-email" className={cn(emailInvalid && 'text-destructive')}>Email</FieldLabel>
          <Input
            aria-labelledby="demo-email"
            aria-invalid={emailInvalid}
            className={cn(emailInvalid && 'border-destructive')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <FieldError>{emailInvalid ? 'Enter a full email address.' : undefined}</FieldError>
        </Field>

        <Field>
          <FieldLabel nativeID="demo-password">Password</FieldLabel>
          <InputGroup>
            <InputGroupInput
              aria-labelledby="demo-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
            />
            <InputGroupAddon align="inline-end">
              <Button variant="ghost" size="icon-sm" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(value => !value)}>
                <Icon as={showPassword ? EyeOff : Eye} className="size-4" />
              </Button>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel nativeID="demo-amount">Amount</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Text className="text-base">$</Text>
            </InputGroupAddon>
            <InputGroupInput aria-labelledby="demo-amount" className="tabular-nums" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <InputGroupAddon align="inline-end">
              <Text>USD</Text>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel nativeID="demo-category">Category</FieldLabel>
          <CategorySelect labelId="demo-category" />
        </Field>

        <Field>
          <FieldLabel nativeID="demo-code">Verification code</FieldLabel>
          <OtpField labelId="demo-code" value={code} onChange={setCode} />
        </Field>

        <Field>
          <FieldLabel nativeID="demo-note">Note</FieldLabel>
          <Textarea aria-labelledby="demo-note" className="min-h-20" placeholder="Add a note for later" value={note} onChangeText={setNote} />
        </Field>
      </FieldGroup>
    </Screen>
  );
}
