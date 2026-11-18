import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { parseDescription } from '@/lib/job-questions';
import { cn } from '@/lib/utils';

/**
 * A request's description shown the way it was meant to be read: the details the
 * customer chose as a short list, then anything they typed. An older request with
 * only plain text is shown as it is.
 */
export function JobDetails({
  description,
  compact = false,
  lines,
}: {
  description: string | null | undefined;
  /** Smaller type, for a row in a list. */
  compact?: boolean;
  /** Cut the typed notes to this many lines (lists only). */
  lines?: number;
}) {
  const { details, notes } = parseDescription(description);
  const size = compact ? 'text-[12.5px] leading-5' : 'text-[14px] leading-5';
  if (details.length === 0) {
    return <Text numberOfLines={lines} className={size}>{notes}</Text>;
  }
  return (
    <View className="gap-1">
      <View className="gap-0.5">
        {details.map(detail => (
          <Text key={detail.label} className={cn(size, 'text-foreground/85')}>
            <Text className={cn(size, 'text-foreground font-semibold')}>{detail.label + ': '}</Text>
            {detail.value}
          </Text>
        ))}
      </View>
      {notes ? <Text numberOfLines={lines} className={size}>{notes}</Text> : null}
    </View>
  );
}
