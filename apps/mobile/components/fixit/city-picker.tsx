import { Pressable, View } from 'react-native';
import { ChevronDown, MapPin } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Text } from '@/components/ui/text';

/**
 * The "where are you shopping?" control. Choosing a city changes which
 * professionals the whole app shows, and is remembered on this phone. With one
 * city it is just a label.
 */
export function CityPicker({
  city,
  options,
  onChange,
}: {
  city: string | null;
  options: string[];
  onChange: (label: string) => void;
}) {
  if (!city) return null;
  if (options.length < 2) {
    return (
      <View className="bg-muted h-9 flex-row items-center gap-1.5 rounded-full px-3">
        <Icon as={MapPin} className="text-accent size-3.5" />
        <Text className="text-muted-foreground text-[12.5px] font-semibold">{city}</Text>
      </View>
    );
  }
  return (
    <Select value={{ value: city, label: city }} onValueChange={option => { if (option) onChange(option.value); }}>
      <SelectTrigger accessibilityLabel={'City: ' + city + '. Change city'} className="bg-muted h-9 rounded-full border-0 px-3">
        <SelectValue placeholder="Choose your city" />
      </SelectTrigger>
      <SelectContent>
        {options.map(label => (
          <SelectItem key={label} value={label} label={label} />
        ))}
      </SelectContent>
    </Select>
  );
}

/** A plain pressable chip row, for places where a dropdown does not fit. */
export function CityChips({
  city,
  options,
  onChange,
}: {
  city: string | null;
  options: string[];
  onChange: (label: string) => void;
}) {
  if (options.length < 2) return null;
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map(label => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityState={{ selected: label === city }}
          onPress={() => onChange(label)}
          className={
            'flex-row items-center gap-1 rounded-full border px-3.5 py-2 ' +
            (label === city ? 'border-primary bg-primary' : 'border-border bg-card')
          }>
          <Icon as={ChevronDown} className="hidden size-0" />
          <Text className={'text-[13px] font-bold ' + (label === city ? 'text-primary-foreground' : 'text-foreground')}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
