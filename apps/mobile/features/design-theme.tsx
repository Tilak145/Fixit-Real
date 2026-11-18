import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Uniwind, useUniwind } from 'uniwind';
import design from '@/lib/spk-design-theme';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'spk:theme';
const declared = (value: unknown): value is Theme => (design.themes as readonly string[]).includes(String(value));
const Context = createContext<{ colorScheme: Theme; setColorScheme: (theme: Theme) => void }>({ colorScheme: design.defaultTheme, setColorScheme() {} });

/** DESIGN.md's default theme, or the person's saved choice when DESIGN.md declares both. */
export function DesignThemeProvider({ children }: { children: ReactNode }) {
  const { theme } = useUniwind();
  const [choice, setChoice] = useState<Theme | null>(null);
  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(saved => { if (live && declared(saved)) setChoice(saved); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const active = choice && declared(choice) ? choice : design.defaultTheme;
  useEffect(() => { Uniwind.setTheme(active); }, [active]);
  const setColorScheme = (next: Theme) => {
    if (!declared(next)) return;
    setChoice(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };
  return <Context.Provider value={{ colorScheme: theme === 'dark' ? 'dark' : 'light', setColorScheme }}>{children}</Context.Provider>;
}
export const useDesignTheme = () => useContext(Context);
