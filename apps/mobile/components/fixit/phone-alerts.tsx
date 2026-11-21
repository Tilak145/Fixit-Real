import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { enablePush, pushAlreadyAllowed, pushSupported, refreshPush, type PushResult } from '@/lib/push';

const MESSAGE: Record<PushResult, string> = {
  enabled: 'Phone alerts are on. You will be told the moment a matching lead arrives.',
  denied: 'Notifications are blocked for FixIt. Allow them in the phone settings, then try again.',
  unsupported: 'Phone alerts work in the installed FixIt app, not in this test view. Email alerts still work.',
  error: 'Could not turn alerts on. Check your connection and try again.',
};

/** Turns on phone alerts for new leads. Emails are sent regardless. */
export function PhoneAlerts({ userId }: { userId: string }) {
  const [state, setState] = useState<PushResult | 'idle'>('idle');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (await pushAlreadyAllowed()) {
        await refreshPush(userId);
        setState('enabled');
      } else if (!pushSupported()) {
        setState('unsupported');
      }
    })();
  }, [userId]);

  return (
    <View className="border-border bg-card gap-2 rounded-2xl border p-4">
      <Text className="text-[15px] font-semibold">New lead alerts</Text>
      <Text className="text-muted-foreground text-[12.5px] leading-5">
        We email you about each new lead that matches your services and cities.
        {state === 'enabled' ? '' : ' Turn on phone alerts too, so you hear about it at once.'}
      </Text>
      {state !== 'idle' ? <Text className="text-[12.5px] leading-5">{MESSAGE[state]}</Text> : null}
      {state !== 'enabled' && state !== 'unsupported' ? (
        <Button
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setState(await enablePush(userId));
            setBusy(false);
          }}>
          <Text>{busy ? 'Turning on…' : 'Turn on phone alerts'}</Text>
        </Button>
      ) : null}
    </View>
  );
}