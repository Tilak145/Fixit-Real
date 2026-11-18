import { config } from '@/lib/config';
import { MIN_LOOKUP_LENGTH, type AddressSuggestion } from '@/lib/address';

/**
 * The app asks the project's own lookup function. It runs the OpenStreetMap
 * search service (Nominatim, the source that carries real US house numbers) on
 * the server — Nominatim sends no CORS header and asks for a descriptive
 * User-Agent, so it cannot be called from the device directly — and answers
 * with one merged list. Typing carries on when the function cannot be reached.
 *
 * Kept apart from the parsing in {@link ./address} so the parsing stays pure and
 * testable in Node without the Expo environment.
 */
export async function lookupAddress(query: string): Promise<AddressSuggestion[]> {
  const text = query.trim();
  if (text.length < MIN_LOOKUP_LENGTH) return [];
  const base = config.backend.replace(/\/$/u, '');
  if (!base) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = base + '/functions/v1/address-lookup?q=' + encodeURIComponent(text);
    const response = await fetch(url, {
      headers: { accept: 'application/json', apikey: config.anonKey, authorization: 'Bearer ' + config.anonKey },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { suggestions?: AddressSuggestion[] };
    return (body.suggestions ?? []).slice(0, 6);
  } catch {
    // Offline or the function is unreachable: the customer keeps typing.
    return [];
  } finally {
    clearTimeout(timer);
  }
}
