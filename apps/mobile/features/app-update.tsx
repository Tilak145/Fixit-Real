import { useEffect, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { config } from '@/lib/config';
import { Text } from '@/components/ui/text';

export function AppUpdateGate({ children }: { children: ReactNode }) {
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web' || !config.statusUrl || config.versionCode <= 0) return;
    let live = true;
    void fetch(config.statusUrl, { signal: AbortSignal.timeout(10_000) }).then(async response => {
      if (!response.ok) return;
      const value = await response.json();
      if (live && Number.isInteger(value.minimumVersionCode) && value.minimumVersionCode > config.versionCode) setOutdated(true);
    }).catch(() => { /* Offline or unreadable responses never lock out an installed app. */ });
    return () => { live = false; };
  }, []);
  if (!outdated) return <>{children}</>;
  return <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
    <Text variant="h3">Update required</Text><Text className="text-center text-muted-foreground">This version is no longer supported. Open the link you installed the app from to get the latest version.</Text>
  </View>;
}
