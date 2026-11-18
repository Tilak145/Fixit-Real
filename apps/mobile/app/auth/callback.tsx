import { AccountActions, AccountGate } from '@/features/auth';
import { Screen } from '@/components/screen';

// Email links return here: the gate finishes the sign-in or password recovery.
export default function Callback() {
  return <Screen back title="Your account"><AccountGate><AccountActions /></AccountGate></Screen>;
}
