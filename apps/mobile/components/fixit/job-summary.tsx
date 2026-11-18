import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { composeDescription, hasAnswers, parseDescription, type JobAnswers } from '@/lib/job-questions';

/**
 * What the customer told us about the job, shown in the quote form once the
 * questions window has closed, with a way back into it.
 */
export function JobSummary({
  categorySlug,
  serviceName,
  answers,
  onOpen,
}: {
  categorySlug: string;
  serviceName: string;
  answers: JobAnswers;
  onOpen: () => void;
}) {
  if (!hasAnswers(categorySlug, answers)) {
    return (
      <View className="border-border bg-muted/30 gap-3 rounded-xl border border-dashed px-4 py-3.5">
        <Text className="text-foreground/80 text-[13px] leading-5">
          <Text className="text-foreground text-[13px] font-semibold">
            {'Tell the pros more about your ' + serviceName.toLowerCase() + ' job. '}
          </Text>
          A few quick taps gets you more accurate prices.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          className="border-primary h-10 items-center justify-center self-start rounded-full border px-4">
          <Text className="text-primary text-[13px] font-bold">Answer a few questions</Text>
        </Pressable>
      </View>
    );
  }
  const { details } = parseDescription(composeDescription(categorySlug, answers, ''));
  return (
    <View className="border-border bg-muted/30 gap-1.5 rounded-xl border px-4 py-3.5">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-foreground/60 text-[12px] font-bold uppercase tracking-wide">
          {'Your ' + serviceName.toLowerCase() + ' job'}
        </Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onOpen}>
          <Text className="text-primary text-[13px] font-bold">Change</Text>
        </Pressable>
      </View>
      {details.map(detail => (
        <Text key={detail.label} className="text-foreground/85 text-[13.5px] leading-5">
          <Text className="text-foreground text-[13.5px] font-semibold">{detail.label + ': '}</Text>
          {detail.value}
        </Text>
      ))}
    </View>
  );
}
