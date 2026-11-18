import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CORE_CATEGORIES, categoryName, listCities, submitQuoteRequest } from '@/lib/fixit';
import { AddressField } from '@/components/fixit/address-field';
import { MediaPicker, type PendingPhoto } from '@/components/fixit/media-picker';
import { uploadRequestMedia } from '@/lib/fixit';
import { useAuth } from '@/features/auth';
import { BUDGET_PRESETS, parseDollarsToCents, presetRange, validateBudgetRange } from '@/lib/budget';

type Status = 'idle' | 'sending' | 'done' | 'error';

const inputClass = 'border-input bg-input/30 text-foreground h-11 w-full rounded-full border px-4 text-base';

// The service a customer picked stays picked until they choose another one.
const SERVICE_KEY = 'fixit.request.service';

/** Ask for a free quote: the job, the place and how to reach the customer. */
export default function RequestPage() {
  const params = useLocalSearchParams<{ service?: string; pro?: string }>();
  const { session } = useAuth();
  const [category, setCategory] = useState(params.service ?? 'plumbing');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Akron, OH');
  // The cities the owner serves, offered in place of typing. Until the list
  // arrives or if it is empty, the field stays a plain text input.
  const cities = useQuery({ queryKey: ['service-cities'], queryFn: listCities, staleTime: 5 * 60_000 });
  const cityOptions = (cities.data ?? []).filter(option => option.is_active);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  // Photos and a clip chosen on the phone, held until the request is sent.
  const [media, setMedia] = useState<PendingPhoto[]>([]);
  // Optional budget: what the customer expects to spend, offered as bands.
  const [budgetId, setBudgetId] = useState('');
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');

  function resolveBudget() {
    if (budgetId === 'custom') {
      return { minCents: parseDollarsToCents(customMin), maxCents: parseDollarsToCents(customMax) };
    }
    return presetRange(budgetId);
  }

  // Reuse the service chosen last time, unless this visit names one
  // (?service=roofing) or the customer changes it here.
  useEffect(() => {
    if (params.service) return;
    let active = true;
    AsyncStorage.getItem(SERVICE_KEY)
      .then(saved => {
        if (active && saved && CORE_CATEGORIES.some(item => item.slug === saved)) setCategory(saved);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [params.service]);

  function chooseService(slug: string) {
    setCategory(slug);
    AsyncStorage.setItem(SERVICE_KEY, slug).catch(() => {});
  }

  async function submit() {
    if (status === 'sending') return;
    if (description.trim().length < 5) {
      setStatus('error');
      setError('Describe the job in a few words so we can match the right pros.');
      return;
    }
    if (name.trim() === '' || email.trim() === '') {
      setStatus('error');
      setError('Add your name and email so professionals can send you quotes.');
      return;
    }
    if (address.trim() === '') {
      setStatus('error');
      setError('Add the service address so the professional knows where the work is.');
      return;
    }
    const budget = resolveBudget();
    const budgetProblem = validateBudgetRange(budget.minCents, budget.maxCents);
    if (budgetProblem) {
      setStatus('error');
      setError(budgetProblem);
      return;
    }
    setStatus('sending');
    setError(null);
    try {
      const requestId = await submitQuoteRequest({
        categorySlug: category,
        description: description.trim(),
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim() || null,
        customerAddress: address.trim(),
        city: city.trim(),
        userId: session?.user.id ?? null,
        budgetMinCents: budget.minCents,
        budgetMaxCents: budget.maxCents,
      });
      // The job exists now, so its photos can go up. One that fails does not
      // lose the request; the customer is told which file did not make it.
      const failed: string[] = [];
      for (const item of media) {
        try {
          await uploadRequestMedia({
            requestId,
            uri: item.uri,
            fileName: item.fileName,
            mimeType: item.mimeType,
            size: item.size,
          });
        } catch {
          failed.push(item.fileName);
        }
      }
      setUploadWarning(
        failed.length > 0
          ? 'Your request was sent, but these files did not upload: ' + failed.join(', ')
          : null,
      );
      setStatus('done');
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'Your request did not send. Check your connection and retry.');
    }
  }

  if (status === 'done') {
    return (
      <Screen back title="Request a quote">
        <Card className="items-center gap-4 py-8">
          <CardContent className="items-center gap-3 px-6">
            <View className="size-16 items-center justify-center rounded-full bg-[#E6F4EA]">
              <Icon as={CircleCheck} className="size-8 text-[#2E9E4F]" />
            </View>
            <Text role="heading" className="text-center text-xl font-semibold">Your request is in!</Text>
            <Text className="text-muted-foreground text-center text-sm leading-6">
              {media.length > 0
                ? 'Matching ' + categoryName(category).toLowerCase() + ' professionals in ' + city +
                  ' will look at your ' + (media.length === 1 ? 'photo' : 'photos and video') +
                  ' and respond with free quotes, usually within a few hours.'
                : 'Matching ' + categoryName(category).toLowerCase() + ' professionals in ' + city +
                  ' will respond with free quotes, usually within a few hours.'}
            </Text>
            {uploadWarning ? (
              <Text className="rounded-md bg-[#FFF4E5] px-3 py-2 text-center text-[13px] text-[#B26A00]">
                {uploadWarning}
              </Text>
            ) : null}
            <View className="w-full gap-2 pt-2">
              <Button className="w-full" onPress={() => router.replace('/tabs')}>
                <Text>Back to home</Text>
              </Button>
              <Button variant="outline" className="w-full" onPress={() => setStatus('idle')}>
                <Text>Send another request</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      back
      title="Request a quote"
      footer={
        <Button size="lg" className="w-full" disabled={status === 'sending'} onPress={() => void submit()}>
          {status === 'sending' ? <ActivityIndicator size="small" /> : null}
          <Text className="text-base font-semibold">{status === 'sending' ? 'Sending…' : 'Send my request'}</Text>
        </Button>
      }>
      <Text className="text-muted-foreground text-sm leading-6">
        Tell us what you need. We route your request to trusted local professionals who send their own free quotes.
      </Text>

      {error ? (
        <Card className="border-destructive/30 py-4">
          <CardContent className="px-4">
            <Text className="text-destructive text-sm leading-5">{error}</Text>
          </CardContent>
        </Card>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel>Service needed</FieldLabel>
          <Select
            value={{ value: category, label: categoryName(category) }}
            onValueChange={option => { if (option) chooseService(option.value); }}>
            <SelectTrigger className="h-11 w-full" accessibilityLabel="Service needed">
              <SelectValue placeholder="Choose a service" />
            </SelectTrigger>
            <SelectContent>
              {CORE_CATEGORIES.map(item => (
                <SelectItem key={item.slug} value={item.slug} label={item.name} />
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Describe the job</FieldLabel>
          <Textarea
            value={description}
            onChangeText={setDescription}
            placeholder="For example: kitchen faucet is leaking, needs a repair or replacement"
            accessibilityLabel="Describe the job"
            numberOfLines={Platform.select({ web: 4, native: 5 })}
          />
          <FieldDescription>What is wrong, and anything a pro should know before quoting.</FieldDescription>
        </Field>

        {/* Photos sit with the description, because that is where the customer
            is looking at the problem they are about to photograph. */}
        <MediaPicker
          media={media}
          onChange={setMedia}
          disabled={!session}
          disabledNote="Sign in to add photos — they are kept with your request and shown only to the pros who can see the job."
        />

        <Field>
          <FieldLabel>Roughly what do you expect this to cost? (optional)</FieldLabel>
          <View className="flex-row flex-wrap gap-2">
            {BUDGET_PRESETS.map(preset => (
              <Pressable
                key={preset.id}
                onPress={() => setBudgetId(budgetId === preset.id ? '' : preset.id)}
                className={
                  'rounded-full border px-3.5 py-2 ' +
                  (budgetId === preset.id ? 'border-primary bg-primary' : 'border-border bg-card')
                }>
                <Text
                  className={
                    'text-[13px] font-bold ' +
                    (budgetId === preset.id ? 'text-primary-foreground' : 'text-foreground')
                  }>
                  {preset.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setBudgetId(budgetId === 'custom' ? '' : 'custom')}
              className={
                'rounded-full border px-3.5 py-2 ' +
                (budgetId === 'custom' ? 'border-primary bg-primary' : 'border-border bg-card')
              }>
              <Text
                className={
                  'text-[13px] font-bold ' +
                  (budgetId === 'custom' ? 'text-primary-foreground' : 'text-foreground')
                }>
                Enter an amount
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setBudgetId('')}
              className={
                'rounded-full border px-3.5 py-2 ' +
                (budgetId === '' ? 'border-primary bg-primary' : 'border-border bg-card')
              }>
              <Text
                className={
                  'text-[13px] font-bold ' + (budgetId === '' ? 'text-primary-foreground' : 'text-foreground')
                }>
                Not sure
              </Text>
            </Pressable>
          </View>
          {budgetId === 'custom' ? (
            <View className="flex-row items-center gap-2 pt-1">
              <TextInput
                value={customMin}
                onChangeText={setCustomMin}
                placeholder="At least"
                keyboardType="number-pad"
                accessibilityLabel="Lowest amount"
                className={inputClass}
                placeholderTextColorClassName="accent-muted-foreground"
              />
              <Text className="text-muted-foreground text-sm">to</Text>
              <TextInput
                value={customMax}
                onChangeText={setCustomMax}
                placeholder="At most"
                keyboardType="number-pad"
                accessibilityLabel="Highest amount"
                className={inputClass}
                placeholderTextColorClassName="accent-muted-foreground"
              />
            </View>
          ) : null}
          <FieldDescription>
            A guide for professionals, not a commitment. Pros pay nothing per lead, so a budget just
            helps them quote the right job.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Your name</FieldLabel>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Jordan Lee"
            autoComplete="name"
            accessibilityLabel="Your name"
            className={inputClass}
            placeholderTextColorClassName="accent-muted-foreground"
          />
        </Field>

        <Field>
          <FieldLabel>Email</FieldLabel>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="Email"
            className={inputClass}
            placeholderTextColorClassName="accent-muted-foreground"
          />
        </Field>

        <Field>
          <FieldLabel>Phone (optional)</FieldLabel>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="(234) 555-0100"
            keyboardType="phone-pad"
            accessibilityLabel="Phone number, optional"
            className={inputClass}
            placeholderTextColorClassName="accent-muted-foreground"
          />
        </Field>

        <AddressField
          value={address}
          onChange={setAddress}
          onCity={picked => setCity(picked)}
        />

        <Field>
          <FieldLabel>City</FieldLabel>
          {cityOptions.length > 0 ? (
            <Select
              value={{ value: city, label: city }}
              onValueChange={option => { if (option) setCity(option.value); }}>
              <SelectTrigger className="h-11 w-full" accessibilityLabel="City">
                <SelectValue placeholder="Choose your city" />
              </SelectTrigger>
              <SelectContent>
                {cityOptions.map(option => (
                  <SelectItem key={option.label} value={option.label} label={option.label} />
                ))}
              </SelectContent>
            </Select>
          ) : (
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Akron, OH"
              accessibilityLabel="City"
              className={inputClass}
              placeholderTextColorClassName="accent-muted-foreground"
            />
          )}
          <FieldDescription>Where the job is, so we match pros who serve that area.</FieldDescription>
        </Field>
      </FieldGroup>
    </Screen>
  );
}
