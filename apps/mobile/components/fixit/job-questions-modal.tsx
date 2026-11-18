import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { cleanAnswers, questionsFor, toggleAnswer, type JobAnswers } from '@/lib/job-questions';
import { cn } from '@/lib/utils';

/**
 * Its own window for the quick questions about a job, shown before the quote
 * form: one question at a time, with tap-to-choose answers. Every question can
 * be skipped, and closing keeps whatever was chosen so far.
 */
export function JobQuestionsModal({
  visible,
  categorySlug,
  serviceName,
  initial,
  onDone,
}: {
  visible: boolean;
  categorySlug: string;
  serviceName: string;
  initial: JobAnswers;
  onDone: (answers: JobAnswers) => void;
}) {
  const questions = questionsFor(categorySlug);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<JobAnswers>({});

  // Each time the window opens it starts at question one with the saved answers.
  useEffect(() => {
    if (visible) {
      setStep(0);
      setAnswers(cleanAnswers(categorySlug, initial));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, categorySlug]);

  const question = questions[Math.min(step, questions.length - 1)];
  if (!question) return null;
  const last = step >= questions.length - 1;
  const chosen = answers[question.id] ?? [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => onDone(answers)}>
      <View className="flex-1 justify-end bg-black/60">
        {/* Tapping the dimmed area closes the window and keeps the answers. */}
        <Pressable accessibilityLabel="Close and keep my answers" className="flex-1" onPress={() => onDone(answers)} />
        <View className="bg-card max-h-[85%] rounded-t-3xl px-5 pb-6 pt-5">
          <View className="flex-row items-center justify-between gap-3 pb-2">
            <Text className="text-primary flex-1 text-[12px] font-bold uppercase tracking-wide">
              {serviceName + ' · question ' + (step + 1) + ' of ' + questions.length}
            </Text>
            <Pressable accessibilityLabel="Close and keep my answers" hitSlop={10} onPress={() => onDone(answers)}>
              <Text className="text-muted-foreground text-2xl leading-6">×</Text>
            </Pressable>
          </View>
          <View className="mb-4 flex-row gap-1.5">
            {questions.map((item, index) => (
              <View key={item.id} className={cn('h-1.5 flex-1 rounded-full', index <= step ? 'bg-primary' : 'bg-border')} />
            ))}
          </View>

          <ScrollView className="flex-grow-0" contentContainerClassName="gap-3 pb-2">
            <Text role="heading" className="text-[21px] font-semibold leading-7">{question.label}</Text>
            <Text className="text-muted-foreground text-[13px]">
              {(question.kind === 'multi' ? 'Choose any that apply.' : 'Choose one.') + ' Skip it if none fit.'}
            </Text>
            <View className="flex-row flex-wrap gap-2 pt-1">
              {question.options.map(option => {
                const on = chosen.includes(option.id);
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => setAnswers(current => toggleAnswer(categorySlug, current, question.id, option.id))}
                    className={cn(
                      'min-h-[44px] justify-center rounded-full border px-4 py-2',
                      on ? 'border-primary bg-primary' : 'border-border bg-card',
                    )}>
                    <Text className={cn('text-[14px] font-semibold', on ? 'text-primary-foreground' : 'text-foreground')}>
                      {(on ? '✓ ' : '') + option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View className="flex-row items-center justify-between gap-3 pt-4">
            {step > 0 ? (
              <Pressable accessibilityRole="button" onPress={() => setStep(current => current - 1)} className="px-3 py-3">
                <Text className="text-foreground/70 text-sm font-bold">← Back</Text>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => onDone({})} className="px-3 py-3">
                <Text className="text-foreground/60 text-sm font-bold">Skip these questions</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => (last ? onDone(answers) : setStep(current => current + 1))}
              className="bg-accent active:bg-accent/90 h-12 items-center justify-center rounded-full px-6">
              <Text className="text-accent-foreground text-[15px] font-semibold">
                {last ? 'Continue to my request →' : chosen.length > 0 ? 'Next →' : 'Skip this one →'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
