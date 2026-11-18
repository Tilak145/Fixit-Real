import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { getMyReview, submitReview } from '@/lib/fixit';
import { cn } from '@/lib/utils';

/**
 * Leave or update a review for one professional. A review belongs to a real
 * account, so a signed-out visitor is asked to sign in rather than posting
 * anonymously.
 */
export function ReviewForm({
  providerId,
  providerName,
  userId,
  onRequireSignIn,
}: {
  providerId: string;
  providerName: string;
  userId: string | null;
  onRequireSignIn: () => void;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const mine = useQuery({
    queryKey: ['my-review', providerId, userId],
    queryFn: () => getMyReview(providerId, userId ?? ''),
    enabled: userId !== null && userId !== '',
  });

  useEffect(() => {
    if (mine.data) {
      setRating(mine.data.rating);
      setComment(mine.data.comment);
    }
  }, [mine.data]);

  const submit = useMutation({
    mutationFn: () => submitReview({ providerId, rating, comment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-review', providerId] });
      await queryClient.invalidateQueries({ queryKey: ['reviews', providerId] });
      await queryClient.invalidateQueries({ queryKey: ['pro', providerId] });
    },
  });

  if (!userId) {
    return (
      <Card className="gap-3 py-5">
        <CardContent className="gap-3 px-5">
          <Text className="text-[15px] font-semibold">Worked with {providerName}?</Text>
          <Text className="text-muted-foreground text-[13px] leading-5">
            Sign in to leave a review. Reviews come from real accounts, so customers can trust them.
          </Text>
          <Button variant="outline" onPress={onRequireSignIn}><Text>Sign in to review</Text></Button>
        </CardContent>
      </Card>
    );
  }

  const existing = mine.data ?? null;

  return (
    <Card className="gap-4 py-5">
      <CardContent className="gap-3 px-5">
        <View className="gap-1">
          <Text className="text-[15px] font-semibold">
            {existing ? 'Update your review' : 'Review ' + providerName}
          </Text>
          <Text className="text-muted-foreground text-[13px] leading-5">
            Your review appears on the profile and counts toward their rating.
          </Text>
        </View>

        <View className="flex-row items-center gap-1.5">
          {[1, 2, 3, 4, 5].map(value => (
            <Pressable
              key={value}
              accessibilityLabel={value + ' star' + (value === 1 ? '' : 's')}
              accessibilityState={{ selected: rating === value }}
              onPress={() => setRating(value)}
              className="p-1">
              <Icon
                as={Star}
                className={cn('size-6', value <= rating ? 'text-[#F5A623]' : 'text-muted-foreground')}
                fill={value <= rating ? '#F5A623' : 'transparent'}
              />
            </Pressable>
          ))}
        </View>

        <FieldGroup>
          <Field>
            <FieldLabel>Your review</FieldLabel>
            <Textarea
              value={comment}
              onChangeText={setComment}
              placeholder="How did the job go?"
              accessibilityLabel="Your review"
              numberOfLines={3}
              editable={!submit.isPending}
            />
          </Field>
        </FieldGroup>

        <Button onPress={() => submit.mutate()} disabled={submit.isPending || comment.trim() === ''}>
          <Text>
            {submit.isPending ? 'Posting…' : existing ? 'Update review' : 'Post review'}
          </Text>
        </Button>
        {submit.isError ? (
          <Text role="alert" className="text-destructive text-sm">
            {submit.error instanceof Error ? submit.error.message : 'Your review did not post. Try again.'}
          </Text>
        ) : null}
        {submit.isSuccess ? (
          <Text role="status" accessibilityLiveRegion="polite" className="text-sm">
            Thanks — your review is posted.
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}
