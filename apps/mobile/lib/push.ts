import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { getSupabase } from '@/lib/supabase';

/**
 * Phone alerts for new leads. The server sends them (the notify-leads function);
 * this registers this phone so it knows where to send. It works only in the real
 * installed app: Expo Go and the web preview cannot receive them.
 */
export type PushResult = 'enabled' | 'denied' | 'unsupported' | 'error';

function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/** Whether this build can receive phone alerts at all. */
export function pushSupported(): boolean {
  return Platform.OS === 'android' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && projectId() !== null;
}

async function saveToken(userId: string): Promise<PushResult> {
  const id = projectId();
  if (!id) return 'unsupported';
  const supabase = getSupabase();
  if (!supabase) return 'error';
  await Notifications.setNotificationChannelAsync('leads', {
    name: 'New leads',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' });
  return error ? 'error' : 'enabled';
}

/** Asks permission if needed, then registers this phone for the signed-in pro. */
export async function enablePush(userId: string): Promise<PushResult> {
  try {
    if (!pushSupported()) return 'unsupported';
    let status = (await Notifications.getPermissionsAsync()).status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    return await saveToken(userId);
  } catch {
    return 'error';
  }
}

/** True when permission was already given, so this phone can be refreshed without asking. */
export async function pushAlreadyAllowed(): Promise<boolean> {
  try {
    return pushSupported() && (await Notifications.getPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}

/** Re-registers quietly: a phone's address can change, so it is refreshed each time the dashboard opens. */
export async function refreshPush(userId: string): Promise<void> {
  try {
    if (await pushAlreadyAllowed()) await saveToken(userId);
  } catch {
    // Never let alerts break the dashboard.
  }
}