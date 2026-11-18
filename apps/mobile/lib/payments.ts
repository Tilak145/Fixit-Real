import { AppState, Linking, Platform } from 'react-native';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { config } from './config';
import { getSupabase } from './supabase';
import { useAuth } from '@/features/auth';

export type Price = { id: string; currency: string; unitAmount: number; recurringInterval?: string | null; recurringIntervalCount?: number; entitlementKey?: string | null };
export type Product = { id: string; name: string; description?: string; prices: Price[] };
export type Ownership = { entitlements: { entitlementKey: string }[]; subscriptions: unknown[]; orders: unknown[] };
export const emptyOwnership: Ownership = { entitlements: [], subscriptions: [], orders: [] };
const attempts = new Map<string, string>();

/** Payments run in FixIt's `billing` function in Supabase, which holds the Stripe keys. */
export function paymentsAvailable() { return Boolean(config.backend && config.anonKey); }

/**
 * Calls the billing function as the signed-in person. The app only ever sends
 * that person's own session token and the public key; no payment secret is
 * here. The function replies `{ data }`, or `{ error: { message } }`.
 */
async function call<T>(path: string, body?: object, requestKey?: string, expectedUserId?: string): Promise<T> {
  if (!paymentsAvailable()) throw new Error('Payments are not set up for this app yet.');
  const session = (await getSupabase()?.auth.getSession())?.data.session;
  if (!session) throw new Error('Sign in to manage your plan.');
  if (expectedUserId && session.user.id !== expectedUserId) throw new Error('You switched accounts. Please try again.');
  const response = await fetch(`${config.backend.replace(/\/+$/u, '')}/functions/v1/billing/${path}`, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: 'application/json',
      apikey: config.anonKey,
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(requestKey ? { 'Idempotency-Key': requestKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || value === null) {
    const error = value && typeof value.error === 'object' && value.error ? (value.error as Record<string, unknown>) : value ?? {};
    throw new Error(typeof error.message === 'string' ? error.message : 'Payments are temporarily unavailable. Please retry.');
  }
  if (expectedUserId && (await getSupabase()?.auth.getSession())?.data.session?.user.id !== expectedUserId) throw new Error('You switched accounts. Please try again.');
  return ('data' in value ? value.data : value) as T;
}
export { priceLabel } from './price';
export const products = () => call<{ items: Product[] }>('products');
export function useOwnership() {
  const { session } = useAuth(), queryClient = useQueryClient();
  const key = ['ownership', session?.user.id ?? null];
  const result = useQuery({ queryKey: key, queryFn: () => call<Ownership>('me', undefined, undefined, session?.user.id), enabled: Boolean(session) && paymentsAvailable(), retry: 1, refetchInterval: 30_000, refetchIntervalInBackground: false });
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['ownership'] }); };
    const activity = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const links = Linking.addEventListener('url', refresh);
    if (Platform.OS === 'web') window.addEventListener('focus', refresh);
    return () => { activity.remove(); links.remove(); if (Platform.OS === 'web') window.removeEventListener('focus', refresh); };
  }, [queryClient]);
  return { ...result, data: session ? result.data ?? emptyOwnership : emptyOwnership };
}
// Reserve a browser tab in the click handler. A network retry retains the
// same idempotency key, including when the first response was lost.
export async function visitPayment(path: 'checkout' | 'portal', priceId?: string) {
  const tab = Platform.OS === 'web' ? window.open('about:blank', '_blank') : null;
  if (tab) tab.opener = null;
  const auth = getSupabase()?.auth;
  const person = (await auth?.getSession())?.data.session?.user.id;
  // Stripe sends the person back to these pages on the website when they finish or cancel.
  const body = path === 'checkout'
    ? { priceId, successPath: '/pro/dashboard?upgraded=1', cancelPath: '/pro/dashboard' }
    : { returnPath: '/pro/dashboard' };
  const identity = JSON.stringify([person, path, body]);
  const key = attempts.get(identity) ?? Crypto.randomUUID(); attempts.set(identity, key);
  try {
    if (!person) throw new Error('Sign in before continuing to payment.');
    const result = await call<{ url?: string; checkoutUrl?: string | null }>(path, body, key, person);
    if ((await auth?.getSession())?.data.session?.user.id !== person) throw new Error('You switched accounts. Please try again.');
    const target = path === 'checkout' ? result.checkoutUrl : result.url;
    if (!target) throw new Error('The payment page could not be opened.');
    const url = new URL(target);
    if (url.protocol !== 'https:') throw new Error('The payment page could not be opened.');
    if (tab) tab.location.replace(url.href);
    else await WebBrowser.openBrowserAsync(url.href);
    attempts.delete(identity);
  } catch (error) { tab?.close(); throw error; }
}
