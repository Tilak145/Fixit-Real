import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Screen, Section } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

const SUPPORT_EMAIL = 'support@fixitls.com';
type Question = { q: string; a: string };

/** Kept in step with the Common questions tables in the customer and professional guides. */
const CUSTOMER_QUESTIONS: Question[] = [
  { q: "Does it cost anything to ask?", a: "No. Asking for prices is free and you are never obliged to accept." },
  { q: "Who can see my phone number and address?", a: "Only the professional whose price you accept." },
  {
    q: "I posted a request and have no prices.",
    a: "Professionals in that trade and city are being matched. If nothing arrives in a day or two, contact us with your customer number.",
  },
  { q: "Can I accept more than one price?", a: "No. Accepting one closes the others." },
  {
    q: "I declined by mistake.",
    a: "Message us with your customer number. The professional can also send a new price.",
  },
  {
    q: "Why must I give a reason to decline?",
    a: "It tells the professional what to change, and they may send a better price.",
  },
  { q: "Can I change my address or phone?", a: "Yes. Open My account and click Edit under Your details." },
  {
    q: "The email code never arrived.",
    a: "Check your spam and promotions folders, then press Resend email. If it still does not arrive, write to us and we will help.",
  },
  {
    q: "How do I pay?",
    a: "You pay the professional directly, on the payment terms in the price. FixIt does not take payment from you.",
  },
  { q: "When can I leave a review?", a: "After the job is finished." },
  {
    q: "What is the customer number for?",
    a: "It lets FixIt find your requests, prices and visits quickly when you contact us. It is on your account page.",
  },
  {
    q: "I forgot my password.",
    a: "Use Forgot password on the log in page; a reset link is emailed to you. Each link works once.",
  },
];

const PRO_QUESTIONS: Question[] = [
  {
    q: "Why is my profile under review?",
    a: "FixIt verifies every new business before it appears publicly. Make sure your licence number and photo ID are in.",
  },
  {
    q: "Why am I not getting leads?",
    a: "Check your status is \"Verified and listed\", that Pause new leads is off, and that your trades and cities match where customers are asking.",
  },
  {
    q: "How do I get more leads?",
    a: "Add every service you offer and every city you serve under Profile & Settings, within your plan's limits.",
  },
  {
    q: "Do I pay per lead?",
    a: "No. You pay a flat monthly plan. Seeing and pricing leads costs nothing extra.",
  },
  { q: "When do I see the customer's phone and address?", a: "Only after they accept your price." },
  {
    q: "The customer declined. Can I try again?",
    a: "Yes. Read their reason and send a new price on the same request.",
  },
  { q: "How do I change my plan?", a: "Open Payments & Plan and click Switch on the plan you want." },
  {
    q: "How does the customer pay me?",
    a: "Directly, on the payment terms in your quote. FixIt does not handle the payment.",
  },
  { q: "A lead looks fake.", a: "Click Report on the lead. FixIt staff review reported leads." },
  {
    q: "I forgot my password.",
    a: "Use Forgot password on the log in page; a reset link is emailed to you.",
  },
];

const GROUPS = [
  { id: 'customers', label: 'For customers', questions: CUSTOMER_QUESTIONS },
  { id: 'professionals', label: 'For professionals', questions: PRO_QUESTIONS },
];

/** One question that opens to show its answer. */
function QuestionRow({ item }: { item: Question }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="border-border border-b last:border-b-0">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)}
        className="flex-row items-center justify-between gap-4 px-4 py-3.5">
        <Text className="flex-1 text-[15px] font-semibold">{item.q}</Text>
        <Icon as={ChevronDown} className={cn('text-muted-foreground size-4', open && 'rotate-180')} />
      </Pressable>
      {open ? <Text className="text-foreground/80 px-4 pb-4 text-[14.5px] leading-6">{item.a}</Text> : null}
    </View>
  );
}

/** Short answers to what customers and professionals ask most. */
export default function HelpPage() {
  return (
    <Screen back title="Common questions">
      <Text className="text-muted-foreground text-sm leading-6">
        Short answers to what customers and professionals ask us most. Tap a question to see its answer.
      </Text>
      {GROUPS.map(group => (
        <Section key={group.id} title={group.label}>
          <View className="border-border bg-card overflow-hidden rounded-xl border">
            {group.questions.map(item => (
              <QuestionRow key={item.q} item={item} />
            ))}
          </View>
        </Section>
      ))}
      <View className="border-border bg-muted/40 gap-1 rounded-xl border p-4">
        <Text className="text-foreground/80 text-[14px] leading-5">Did not find your answer? Write to us:</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('mailto:' + SUPPORT_EMAIL)}>
          <Text className="text-primary text-[14px] font-semibold underline">{SUPPORT_EMAIL}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}