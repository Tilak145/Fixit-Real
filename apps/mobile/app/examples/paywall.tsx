import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check, Sparkles, X } from 'lucide-react-native';
import { goBack, Screen } from '@/components/screen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { usePlans } from '@/features/plans';
import { priceLabel, type Price, type Product } from '@/lib/payments';
import { cn } from '@/lib/utils';

// Sample copy: say what the paid plan unlocks in this app. Prices never come from here.
const benefits = [
  'Unlimited lists and reminders',
  'Weekly and monthly reports',
  'Sync across all your devices',
  'Themes and custom icons',
];

type Plan = { id: string; title: string; detail: string; saving: string | null };

const periods: Record<string, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' };

/** "Yearly", "Every 3 months"; null for a one-time price. */
function periodLabel(price: Price) {
  if (!price.recurringInterval) return null;
  const count = price.recurringIntervalCount ?? 1;
  return count > 1 ? `Every ${count} ${price.recurringInterval}s` : periods[price.recurringInterval] ?? price.recurringInterval;
}

/** What a yearly price saves against twelve monthly payments for the same access. */
function saving(product: Product, price: Price) {
  if (price.recurringInterval !== 'year' || (price.recurringIntervalCount ?? 1) !== 1) return null;
  const monthly = product.prices.find(item =>
    item.recurringInterval === 'month' && (item.recurringIntervalCount ?? 1) === 1 &&
    item.currency === price.currency && item.entitlementKey === price.entitlementKey);
  if (!monthly || monthly.unitAmount <= 0) return null;
  const percent = Math.round((1 - price.unitAmount / (monthly.unitAmount * 12)) * 100);
  return percent > 0 ? `Save ${percent}%` : null;
}

/** One choice per price in the project's catalog. */
function toPlans(items: Product[]): Plan[] {
  return items.flatMap(product => product.prices.map(price => {
    const period = periodLabel(price);
    return {
      id: price.id,
      title: period ? (items.length > 1 ? `${product.name} · ${period}` : period) : product.name,
      detail: priceLabel(price),
      saving: saving(product, price),
    };
  }));
}

/** The paywall: the plans of the project's Stripe catalog, and checkout for the chosen one. */
export default function PaywallPage({ edges }: { edges?: Edge[] }) {
  const { session, loading } = useAuth();
  const { available, catalog, ownership, pending, error, visit } = usePlans();
  const [choice, setChoice] = useState<string | null>(null), [restoring, setRestoring] = useState(false);
  const plans = toPlans(catalog.data?.items ?? []);
  const selected = plans.find(plan => plan.id === choice) ?? plans[0];
  const owned = ownership.data.entitlements.length > 0;
  const signedOut = !loading && !session;

  async function restore() {
    setRestoring(true);
    try { await ownership.refetch(); } finally { setRestoring(false); }
  }

  return (
    <Screen
      edges={edges}
      className="grow gap-0 px-6 pb-9 pt-0"
      header={
        <View className="h-14 flex-row items-center justify-between px-2">
          <Button variant="ghost" size="icon-lg" accessibilityLabel="Close" onPress={goBack}>
            <Icon as={X} className="size-[22px]" />
          </Button>
          {available && session ? (
            <Button variant="ghost" disabled={restoring} onPress={() => void restore()}>
              <Text className="text-muted-foreground">{restoring ? 'Restoring…' : 'Restore'}</Text>
            </Button>
          ) : null}
        </View>
      }>
      <Badge variant="secondary" className="self-start">
        <Icon as={Sparkles} className="size-3" />
        <Text>Pro</Text>
      </Badge>
      <Text role="heading" className="mt-3 text-3xl font-semibold tracking-tight">Do more with Pro</Text>
      <View className="mt-5 gap-3">
        {benefits.map(benefit => (
          <View key={benefit} className="flex-row items-center gap-3">
            <Icon as={Check} className="size-4" />
            <Text className="text-[15px]">{benefit}</Text>
          </View>
        ))}
      </View>

      {available ? (
        <View className="mt-7 gap-3">
          {catalog.isPending ? <Text className="text-muted-foreground">Loading plans…</Text> : null}
          {catalog.error ? (
            <View className="gap-3">
              <Text className="text-destructive text-sm">{catalog.error.message}</Text>
              <Button variant="outline" onPress={() => void catalog.refetch()}><Text>Retry</Text></Button>
            </View>
          ) : null}
          {catalog.data && !plans.length ? <Text className="text-muted-foreground">No plans are available.</Text> : null}
          {plans.length ? (
            <RadioGroup value={selected?.id} onValueChange={setChoice} disabled={pending !== null}>
              {plans.map(plan => {
                const checked = plan.id === selected?.id;
                return (
                  <Pressable
                    key={plan.id}
                    accessible={false}
                    tabIndex={-1}
                    disabled={pending !== null}
                    onPress={() => setChoice(plan.id)}
                    className={cn('flex-row items-center gap-4 rounded-2xl border p-4', checked ? 'border-primary bg-primary/5' : 'border-border')}>
                    <View className="flex-1 gap-1">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="text-[15px] font-medium">{plan.title}</Text>
                        {plan.saving ? <Badge><Text>{plan.saving}</Text></Badge> : null}
                      </View>
                      <Text className="text-muted-foreground text-sm">{plan.detail}</Text>
                    </View>
                    <RadioGroupItem value={plan.id} aria-label={plan.title} />
                  </Pressable>
                );
              })}
            </RadioGroup>
          ) : null}
        </View>
      ) : null}

      <View className="mt-auto gap-3 pt-6">
        {available ? (
          <>
            {owned ? <Text className="text-center text-sm font-medium">Your access is active.</Text> : null}
            {ownership.error ? <Text role="alert" className="text-destructive text-center text-sm">{ownership.error.message}</Text> : null}
            {error ? <Text role="alert" accessibilityLiveRegion="polite" className="text-destructive text-center text-sm">{error}</Text> : null}
            <Button
              className="w-full"
              disabled={loading || pending !== null || (!signedOut && !selected)}
              onPress={() => {
                if (signedOut) router.push('/examples/sign-in');
                else if (selected) void visit('checkout', selected.id);
              }}>
              <Text className="text-base">{pending !== null ? 'Opening…' : signedOut ? 'Sign in to continue' : 'Continue'}</Text>
            </Button>
            <Text className="text-muted-foreground text-center text-xs">Checkout opens in your browser.</Text>
          </>
        ) : (
          <Text className="text-muted-foreground text-center">Plans are not available yet.</Text>
        )}
      </View>
    </Screen>
  );
}
