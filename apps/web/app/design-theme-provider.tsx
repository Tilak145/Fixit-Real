"use client";

import { useLayoutEffect, type PropsWithChildren } from "react";
import { ThemeProvider } from "next-themes";

export interface DesignTheme { defaultTheme: string; themes: string[] }

/** A changed document default must initialize next-themes again, preserving its saved user preference. */
export function DesignThemeProvider({ children, designTheme }: PropsWithChildren<{ designTheme: DesignTheme }>) {
  const configuration = JSON.stringify([designTheme.defaultTheme, [...designTheme.themes].sort()]);
  useLayoutEffect(() => {
    // A newly declared single theme cannot remove the preceding theme's class
    // itself: next-themes only removes names in its current `themes` prop.
    document.documentElement.classList.remove("light", "dark");
  }, [configuration]);
  return <ThemeProvider key={configuration} attribute="class" defaultTheme={designTheme.defaultTheme}
    themes={designTheme.themes} enableSystem={designTheme.themes.length > 1} enableColorScheme={false}
    forcedTheme={designTheme.themes.length === 1 ? designTheme.defaultTheme : undefined}>
    {children}
  </ThemeProvider>;
}
