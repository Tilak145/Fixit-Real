import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { MIN_LOOKUP_LENGTH, type AddressSuggestion } from '@/lib/address';
import { lookupAddress } from '@/lib/address-lookup';

const inputClass = 'border-input bg-input/30 text-foreground h-11 w-full rounded-full border px-4 text-base';

/**
 * A service address with suggestions while the customer types.
 *
 * Correct addresses matter twice over: the request is matched to professionals
 * by city, and the pro who accepts it drives to the door. A suggestion writes
 * the full address and its city, so what is saved is a complete address rather
 * than a half-typed street. If the lookup is unreachable the typing still works.
 */
export function AddressField({
  value,
  onChange,
  onCity,
  label = 'Service address',
  description = 'Pick your address from the list so we route it to the right pros.',
}: {
  value: string;
  onChange: (value: string) => void;
  onCity?: (city: string) => void;
  label?: string;
  description?: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // The picked label, so choosing a suggestion does not look its own result up.
  const lastPick = useRef('');

  useEffect(() => {
    const query = value.trim();
    if (query.length < MIN_LOOKUP_LENGTH || query === lastPick.current) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    // Debounce: look up a whole street once, not once per letter.
    const timer = setTimeout(async () => {
      setLoading(true);
      const found = await lookupAddress(query);
      if (cancelled) return;
      setLoading(false);
      setSuggestions(found);
      setOpen(found.length > 0);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setLoading(false);
    };
  }, [value]);

  function choose(suggestion: AddressSuggestion) {
    lastPick.current = suggestion.label;
    onChange(suggestion.label);
    onCity?.(suggestion.cityLabel);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <View className="gap-0">
        <View className="justify-center">
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Start typing, e.g. 740 W Market St"
            autoComplete="street-address"
            accessibilityLabel={label}
            className={inputClass}
            placeholderTextColorClassName="accent-muted-foreground"
          />
          {loading ? (
            <View className="absolute right-4">
              <ActivityIndicator size="small" />
            </View>
          ) : null}
        </View>

        {open && suggestions.length > 0 ? (
          <View className="border-border bg-card mt-2 overflow-hidden rounded-2xl border">
            {suggestions.map((suggestion, index) => (
              <Pressable
                key={suggestion.key}
                accessibilityRole="button"
                accessibilityLabel={suggestion.label}
                onPress={() => choose(suggestion)}
                className={index > 0 ? 'border-border flex-row items-start gap-3 border-t px-4 py-3' : 'flex-row items-start gap-3 px-4 py-3'}>
                <Icon as={MapPin} className="text-primary mt-0.5 size-4" />
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-medium">{suggestion.line1}</Text>
                  <Text className="text-muted-foreground text-[13px]">
                    {[suggestion.city, [suggestion.state, suggestion.postcode].filter(Boolean).join(' ')]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

