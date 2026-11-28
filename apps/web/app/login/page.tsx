import { LoginPage } from "@/features/auth/pages";

export const metadata = { title: "Log In — FixIt" };

/** Only these places may be asked for after logging in, never an outside address. */
const NEXT_PAGES = ["/pro/onboarding", "/manage"];

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginPage redirectTo={next && NEXT_PAGES.includes(next) ? next : "/"} />;
}
