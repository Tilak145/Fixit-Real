import type { Metadata } from "next";
import Script from "next/script";
import { Poppins, Nunito_Sans } from "next/font/google";
import "./globals.css";
import "./spk-theme.css";
import { AppShell } from "@/components/app/app-shell";
import { AppProviders } from "./providers";
import designTheme from "./spk-design-theme.mjs";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const nunito = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FixIt — Local Services Marketplace",
  description:
    "Find trusted local professionals for plumbing, electrical, HVAC, garage doors, roofing, cleaning and more. Fast. Easy. Reliable.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${poppins.variable} ${nunito.variable}`}>
      <body>
        <Script src="/spk-runtime-config.js" strategy="beforeInteractive" />
        <AppProviders designTheme={designTheme}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
