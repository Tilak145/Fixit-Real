import { useEffect, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider, SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { config } from '@/lib/config';

type PreviewWindow = Window & { __spkInsets?: EdgeInsets; __spkApp?: { setInsets: (value: EdgeInsets) => void; back: () => void; navigate: (path: string) => void; capture: (ratio: number) => Promise<string> } };
export function PreviewProvider({ children }: { children: ReactNode }) {
  const preview = config.preview && Platform.OS === 'web';
  const [insets, setInsets] = useState<EdgeInsets>(preview ? (window as PreviewWindow).__spkInsets ?? { top: 0, bottom: 0, left: 0, right: 0 } : { top: 0, bottom: 0, left: 0, right: 0 });
  useEffect(() => {
    if (!preview) return;
    const host = window as PreviewWindow;
    host.__spkApp = {
      setInsets,
      back: () => { if (router.canGoBack()) router.back(); else router.replace('/'); },
      navigate: path => router.replace(path as Href),
      capture: async ratio => {
        const { toPng } = await import('html-to-image');
        const element = document.getElementById('spk-app-screen');
        if (!element) throw new Error('The app has not finished loading.');
        return toPng(element, { pixelRatio: ratio });
      },
    };
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('spk:app-mounted')));
    return () => { cancelAnimationFrame(frame); delete host.__spkApp; };
  }, [preview]);
  return <SafeAreaProvider><View nativeID="spk-app-screen" className="flex-1 bg-background">
    {preview ? <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider> : children}
  </View></SafeAreaProvider>;
}
