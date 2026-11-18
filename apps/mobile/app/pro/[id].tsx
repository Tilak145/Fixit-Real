import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Film, Info, Phone, User } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { AccountGate, useAuth } from '@/features/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { categoryName, formatCents } from '@/lib/fixit';
import { formatBudgetRange } from '@/lib/budget';
import {
  getMyBusiness,
  listBusinessLeads,
  sendBusinessQuote,
  type BusinessLead,
} from '@/lib/my-business';
import { cn } from '@/lib/utils';

/** What a box of dollars means, with no rounding surprises: blank is nothing. */
function toCents(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const value = Number(cleaned);
  if (cleaned === '' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

function when(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** The customer's own photos and clip, so a weighty job can be judged first. */
function LeadMedia({ lead }: { lead: BusinessLead }) {
  const shown = lead.media.filter(item => item.url);
  if (shown.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-2">
      {shown.map(item =>
        item.kind === 'video' ? (
          <View key={item.id} className="bg-muted h-24 w-24 items-center justify-center rounded-lg">
            <Icon as={Film} className="text-muted-foreground size-6" />
            <Text className="text-muted-foreground text-[11px]">Video</Text>
          </View>
        ) : (
          <Image key={item.id} source={{ uri: item.url! }} className="h-24 w-24 rounded-lg" accessibilityLabel="Customer photo" />
        ),
      )}
    </View>
  );
}

/** One amount of the price. The parts are separate because that is what makes two prices comparable. */
function MoneyField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Field className="flex-1">
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0.00"
        accessibilityLabel={label}
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

function QuoteComposer({
  lead,
  providerId,
  emergency,
  onSent,
  onRefused,
}: {
  lead: BusinessLead;
  providerId: string;
  emergency: boolean;
  onSent: () => void;
  onRefused: (message: string) => void;
}) {
  // A price already sent reopens with its own numbers, so revising it is a
  // change rather than starting again from nothing.
  const existing = lead.quote;
  const start = (cents: number | null | undefined) => (cents && cents > 0 ? (cents / 100).toFixed(2) : '');
  const [labour, setLabour] = useState(start(existing?.labour_cents));
  const [materials, setMaterials] = useState(start(existing?.materials_cents));
  const [serviceCall, setServiceCall] = useState(start(existing?.service_call_cents));
  const [emergencyFee, setEmergencyFee] = useState(start(existing?.emergency_fee_cents));
  const [other, setOther] = useState(start(existing?.other_cents));
  const [otherLabel, setOtherLabel] = useState(existing?.other_label ?? '');
  const [startDate, setStartDate] = useState(existing?.earliest_start ?? '');
  const [howLong, setHowLong] = useState(existing?.completion_note ?? '');
  const [warranty, setWarranty] = useState(existing?.warranty ?? '');
  const [payment, setPayment] = useState(existing?.payment_terms ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const parts = [labour, materials, serviceCall, emergencyFee, other];
  const total = parts.reduce((sum, part) => sum + toCents(part), 0);
  const missing = [
    !toCents(materials) && 'materials',
    !startDate.trim() && 'a start date',
    !howLong.trim() && 'how long it will take',
    !warranty.trim() && 'your warranty',
    !payment.trim() && 'payment terms',
  ].filter(Boolean) as string[];

  const send = useMutation({
    mutationFn: () =>
      sendBusinessQuote({
        requestId: lead.id,
        providerId,
        labourCents: toCents(labour),
        materialsCents: toCents(materials),
        serviceCallCents: toCents(serviceCall),
        emergencyFeeCents: toCents(emergencyFee),
        otherCents: toCents(other),
        otherLabel,
        earliestStart: startDate.trim() || undefined,
        completionNote: howLong,
        warranty,
        paymentTerms: payment,
        note,
      }),
    onSuccess: () => {
      setError(null);
      onSent();
    },
    onError: (failure: Error) => {
      setError(failure.message);
      onRefused(failure.message);
    },
  });

  if (send.isSuccess) {
    return (
      <Card className="gap-2 py-6">
        <CardContent className="items-center gap-2 px-5">
          <Icon as={CircleCheck} className="size-8 text-[#2E9E4F]" />
          <Text className="text-base font-semibold">Price sent</Text>
          <Text className="text-muted-foreground text-[13px] leading-5 text-center">
            {lead.customer_name} can now accept it. When they do, their phone, email and address are released to you.
          </Text>
          <Button variant="outline" className="mt-2" onPress={onSent}>
            <Text>Back to your leads</Text>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Your price</FieldLabel>
        <FieldDescription>Split it up so the customer can see what they are paying for.</FieldDescription>
        <View className="gap-3">
          <MoneyField label="Labour" value={labour} onChange={setLabour} />
          <MoneyField label="Materials" hint="Leave blank if the customer supplies them" value={materials} onChange={setMaterials} />
          <MoneyField label="Service call" hint="Call-out or diagnostic charge" value={serviceCall} onChange={setServiceCall} />
          {emergency ? (
            <MoneyField label="Emergency fee" hint="This job was flagged as an emergency" value={emergencyFee} onChange={setEmergencyFee} />
          ) : null}
          <MoneyField label="Other" value={other} onChange={setOther} />
          <Field>
            <FieldLabel>What is the other charge?</FieldLabel>
            <Input value={otherLabel} onChangeText={setOtherLabel} placeholder="Permit, disposal" accessibilityLabel="What the other charge is" />
          </Field>
        </View>
      </Field>

      <Field>
        <FieldLabel>Earliest start</FieldLabel>
        <Input value={startDate} onChangeText={setStartDate} placeholder="2026-11-05" accessibilityLabel="Earliest start" />
        <FieldDescription>Year-month-day, e.g. 2026-11-05.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>How long will it take?</FieldLabel>
        <Input value={howLong} onChangeText={setHowLong} placeholder="About four hours, same day" accessibilityLabel="How long it will take" />
      </Field>
      <Field>
        <FieldLabel>Warranty</FieldLabel>
        <Input value={warranty} onChangeText={setWarranty} placeholder="12 months on labour" accessibilityLabel="Warranty" />
      </Field>
      <Field>
        <FieldLabel>Payment terms</FieldLabel>
        <Input value={payment} onChangeText={setPayment} placeholder="Half on arrival, half on completion" accessibilityLabel="Payment terms" />
      </Field>
      <Field>
        <FieldLabel>Anything else (optional)</FieldLabel>
        <Textarea value={note} onChangeText={setNote} placeholder="Includes hauling away the old unit." accessibilityLabel="Anything else" numberOfLines={3} />
      </Field>

      <View className="bg-muted flex-row items-center justify-between rounded-xl px-4 py-3">
        <Text className="text-[13px] font-semibold">Total the customer sees</Text>
        <Text className="text-[22px] font-semibold tabular-nums">{formatCents(total)}</Text>
      </View>

      {missing.length > 0 ? (
        <View className="flex-row gap-2 rounded-md bg-[#FFF4E5] px-3.5 py-2.5">
          <Icon as={Info} className="mt-0.5 size-3.5 text-[#B26A00]" />
          <Text className="flex-1 text-[12.5px] text-[#B26A00]">
            You have not stated {missing.join(', ')}. The customer can still accept, but quotes that answer these are the ones people choose.
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" className="text-destructive text-[13px]">{error}</Text>
      ) : null}

      <Button
        disabled={send.isPending || total <= 0}
        onPress={() => {
          setError(null);
          send.mutate();
        }}
      >
        <Text>{send.isPending ? 'Sending…' : existing ? 'Update price' : 'Send price'}</Text>
      </Button>
      {total <= 0 ? (
        <Text className="text-muted-foreground text-[12px]">Enter at least one amount to send your price.</Text>
      ) : null}
      <Text className="text-muted-foreground text-[12px] leading-4">
        When the customer accepts your price, their phone, email and service address are released to you. If they accept someone else&apos;s, this price is closed.
      </Text>
    </FieldGroup>
  );
}

function LeadDetail() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const business = useQuery({
    queryKey: ['my-business', userId],
    queryFn: () => getMyBusiness(userId),
    enabled: userId !== '',
  });
  const leads = useQuery({
    queryKey: ['business-leads', business.data?.id],
    queryFn: listBusinessLeads,
    enabled: !!business.data,
  });
  // Set when a price goes out but the customer has already chosen someone
  // else: the row cannot be reopened for editing, so the form closes.
  const [locked, setLocked] = useState<string | null>(null);

  if (business.isPending || leads.isPending) {
    return <Skeleton className="h-56 w-full rounded-2xl" />;
  }
  const lead = (leads.data ?? []).find(item => item.id === id) ?? null;
  if (!lead || !business.data) {
    return (
      <Card className="gap-3 py-6">
        <CardContent className="gap-2 px-5">
          <Text className="text-base font-semibold">This job is not available to you</Text>
          <Text className="text-muted-foreground text-[13px] leading-5">
            It is outside your trades or service area, or the customer already chose a professional.
          </Text>
          <Button variant="outline" onPress={() => router.replace('/pro')}><Text>Back to your business</Text></Button>
        </CardContent>
      </Card>
    );
  }
  const pro = business.data;
  const accepted = lead.quote?.status === 'accepted';
  const lost = locked === lead.id || lead.quote?.status === 'declined';
  const closed = lead.status === 'completed' || lead.status === 'cancelled' || accepted;
  const emergency = Boolean(lead.is_emergency);

  return (
    <>
      <Card className="border-border gap-2.5 py-4">
        <CardContent className="gap-2.5 px-4">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-base font-semibold">{categoryName(lead.category_slug)}</Text>
            {emergency ? <Badge variant="destructive"><Text className="text-[11px]">Emergency</Text></Badge> : null}
            {lead.quote && !lost ? (
              <Badge variant="secondary"><Text className="text-[11px]">Price sent</Text></Badge>
            ) : null}
          </View>
          <Text className="text-[14px] leading-5">{lead.description}</Text>
          <Text className="text-muted-foreground text-[12.5px]">
            {lead.customer_name} · {lead.city} · posted {when(lead.created_at)}
          </Text>
          <Text className="text-muted-foreground text-[12.5px]">
            Budget: {formatBudgetRange({ minCents: lead.budget_min_cents, maxCents: lead.budget_max_cents })}
          </Text>
          <LeadMedia lead={lead} />
        </CardContent>
      </Card>

      {accepted && lead.quote ? (
        <Card className="gap-2 py-4">
          <CardContent className="gap-1.5 px-4">
            <View className="flex-row items-center gap-2">
              <Icon as={CircleCheck} className="size-4 text-[#2E9E4F]" />
              <Text className="text-[14px] font-semibold">You won this job</Text>
            </View>
            <Text className="text-[13px]">Your price: {formatCents(lead.quote.amount_cents)}</Text>
            {lead.contact ? (
              <>
                <View className="flex-row items-center gap-2">
                  <Icon as={User} className="text-muted-foreground size-4" />
                  <Text className="text-[13px]">{lead.customer_name}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Icon as={Phone} className="text-muted-foreground size-4" />
                  <Text selectable className="text-[13px]">{lead.contact.phone ?? 'No phone given'}</Text>
                </View>
                <Text className="text-muted-foreground text-[12.5px]">{lead.contact.address ?? 'No address given'}</Text>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {lead.quote && !lost ? (
        <View className="border-border bg-muted/40 flex-row items-center justify-between gap-3 rounded-xl border p-4">
          <View className="flex-1">
            <Text className="text-[13px] font-semibold">Price in leads matching request</Text>
            <Text className="text-muted-foreground text-[12px]">
              Sent — the homeowner can accept it now.
            </Text>
          </View>
          <Text className="text-[16px] font-semibold tabular-nums">{formatCents(lead.quote.amount_cents)}</Text>
        </View>
      ) : null}

      {lost ? (
        <Card className="py-5">
          <CardContent className="px-5">
            <Text className="text-muted-foreground text-sm leading-5">
              The homeowner chose another professional for this job, so your price was closed and a new one cannot be sent.
            </Text>
          </CardContent>
        </Card>
      ) : closed && !accepted ? (
        <Card className="py-5">
          <CardContent className="px-5">
            <Text className="text-muted-foreground text-sm">This job is closed, so a new price cannot be sent.</Text>
          </CardContent>
        </Card>
      ) : (
        <QuoteComposer
          key={lead.id}
          lead={lead}
          providerId={pro.id}
          emergency={emergency}
          onSent={() => {
            void queryClient.invalidateQueries({ queryKey: ['business-leads', pro.id] });
            // Give the answer a moment on screen, then back to the list, where
            // the job now shows as priced.
            setTimeout(() => router.replace('/pro'), 1600);
          }}
          onRefused={(message) => {
            // The database is the authority on whether a price may be sent.
            if (/chose a professional/i.test(message)) setLocked(lead.id);
          }}
        />
      )}
    </>
  );
}

/** One job a business can price: the customer's request, then the price form. */
export default function LeadPage() {
  return (
    <Screen back title="Job details">
      <AccountGate>
        <LeadDetail />
      </AccountGate>
    </Screen>
  );
}


