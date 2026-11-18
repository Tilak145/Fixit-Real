import { View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { goBack, Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { AccountActions, AccountGate } from '@/features/auth';

/** The code step of sign-up and email sign-in. Opened directly it has no email to verify yet. */
export default function VerifyEmailPage({ edges }: { edges?: Edge[] }) {
  return (
    <Screen
      edges={edges}
      className="grow px-6 pb-10 pt-6"
      header={
        <View className="h-14 flex-row items-center px-2">
          <Button variant="ghost" size="icon-lg" accessibilityLabel="Go back" onPress={goBack}>
            <Icon as={ChevronLeft} className="size-[22px]" />
          </Button>
        </View>
      }>
      <AccountGate initialMode="code">
        <Text role="heading" className="text-2xl font-semibold tracking-tight">You are signed in</Text>
        <AccountActions />
      </AccountGate>
    </Screen>
  );
}
