import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { AccountGate, useAuth } from '@/features/auth';
import { paymentsAvailable, priceLabel, products, useOwnership, visitPayment, type Product } from '@/lib/payments';

/**
 * The project's Stripe products with a checkout button per price. Only the
 * server's entitlements prove ownership; checkout itself never grants access.
 */
export function usePlans() {
  const catalog = useQuery({ queryKey: ['products'], queryFn: products, enabled: paymentsAvailable() });
  const ownership = useOwnership();
  const [pending, setPending] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  async function visit(path: 'checkout' | 'portal', priceId?: string) {
    if (pending) return;
    setPending(priceId ?? path); setError(null);
    try { await visitPayment(path, priceId); await ownership.refetch(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open checkout. Please retry.'); }
    finally { setPending(null); }
  }
  return { available: paymentsAvailable(), catalog, ownership, pending, error, visit };
}

export function Plans() {
  const { available, catalog, pending, error, visit } = usePlans();
  if (!available) return <Text className="text-muted-foreground">Plans are not available yet. Contact the app creator.</Text>;
  return (
    <View className="gap-4">
      {catalog.isPending ? <Text className="text-muted-foreground">Loading plans…</Text> : null}
      {catalog.error ? (
        <View className="gap-3">
          <Text>{catalog.error.message}</Text>
          <Button variant="outline" onPress={() => void catalog.refetch()}><Text>Retry</Text></Button>
        </View>
      ) : null}
      {catalog.data?.items.map((product: Product) => (
        <Card key={product.id}>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
            {product.description ? <CardDescription>{product.description}</CardDescription> : null}
          </CardHeader>
          <CardContent className="gap-3">
            {product.prices.map(price => (
              <Button key={price.id} disabled={pending !== null} onPress={() => void visit('checkout', price.id)}>
                <Text>{pending === price.id ? 'Opening…' : priceLabel(price)}</Text>
              </Button>
            ))}
          </CardContent>
        </Card>
      ))}
      {catalog.data && catalog.data.items.length === 0 ? <Text className="text-muted-foreground">No plans are available.</Text> : null}
      {error ? <Text accessibilityLiveRegion="polite" className="text-destructive">{error}</Text> : null}
      <Button variant="outline" disabled={pending !== null} onPress={() => void visit('portal')}><Text>Manage billing</Text></Button>
    </View>
  );
}

export function PurchaseStatus() {
  const { session } = useAuth();
  if (!session) return <AccountGate><SignedInPurchaseStatus /></AccountGate>;
  return <SignedInPurchaseStatus />;
}

function SignedInPurchaseStatus() {
  const ownership = useOwnership();
  const ready = ownership.data.entitlements.length > 0;
  return (
    <View className="items-center gap-3">
      <Text role="heading" className="text-center text-2xl font-semibold tracking-tight">
        {ownership.isFetching ? 'Checking your purchase…' : ready ? 'Your access is ready' : 'Waiting for confirmation'}
      </Text>
      <Text className="text-muted-foreground text-center">Your access updates when the payment is confirmed.</Text>
      {ownership.error ? <Text className="text-destructive text-center">{ownership.error.message}</Text> : null}
      <Button variant={ready ? 'outline' : 'default'} className="w-full" disabled={ownership.isFetching} onPress={() => void ownership.refetch()}>
        <Text>Check again</Text>
      </Button>
    </View>
  );
}
