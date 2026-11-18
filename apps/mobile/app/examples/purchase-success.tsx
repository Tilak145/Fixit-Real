import { View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Check, Clock } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { PurchaseStatus, usePlans } from '@/features/plans';
import { cn } from '@/lib/utils';

/** The mark above the status: a check only once the server confirms the purchase. */
function StatusMark({ ready }: { ready: boolean }) {
  return (
    <View className={cn('size-16 items-center justify-center rounded-full', ready ? 'bg-primary' : 'bg-muted')}>
      <Icon as={ready ? Check : Clock} className={cn('size-[30px]', ready ? 'text-primary-foreground' : 'text-muted-foreground')} />
    </View>
  );
}

/** Where checkout returns. Only the account's entitlements say whether the purchase went through. */
export default function PurchaseSuccessPage({ edges }: { edges?: Edge[] }) {
  const { session } = useAuth();
  const { available, ownership, pending, error, visit } = usePlans();
  const ready = ownership.data.entitlements.length > 0;
  return (
    <Screen edges={edges} className={cn('grow px-6 pb-10', session ? 'pt-24' : 'pt-14')}>
      {session ? <View className="items-center"><StatusMark ready={ready} /></View> : null}
      <PurchaseStatus />
      {session ? (
        <View className="mt-auto gap-2">
          {error ? <Text role="alert" accessibilityLiveRegion="polite" className="text-destructive text-center text-sm">{error}</Text> : null}
          <Button variant={ready ? 'default' : 'outline'} className="w-full" onPress={() => router.replace('/')}>
            <Text className="text-base">Done</Text>
          </Button>
          {available ? (
            <Button variant="ghost" className="w-full" disabled={pending !== null} onPress={() => void visit('portal')}>
              <Text className="text-base">{pending === 'portal' ? 'Opening…' : 'Manage billing'}</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
