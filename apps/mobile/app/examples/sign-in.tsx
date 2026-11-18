import type { Edge } from 'react-native-safe-area-context';
import { Screen } from '@/components/screen';
import { Text } from '@/components/ui/text';
import { AccountActions, AccountGate } from '@/features/auth';

/** The real sign-in form. With a session, the gate shows what follows it instead. */
export default function SignInPage({ edges }: { edges?: Edge[] }) {
  return (
    <Screen edges={edges} className="grow px-6 pb-10 pt-14">
      <AccountGate initialMode="login">
        <Text role="heading" className="text-2xl font-semibold tracking-tight">You are signed in</Text>
        <AccountActions />
      </AccountGate>
    </Screen>
  );
}
