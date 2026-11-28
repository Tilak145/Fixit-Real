import { RegisterPage } from "@/features/auth/pages";

export const metadata = { title: "Sign Up — FixIt" };

// The only place a sign-up may send someone back to, besides the home page.
const NEXT_PAGES = ["/manage"];

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RegisterPage redirectTo={next && NEXT_PAGES.includes(next) ? next : "/"} />;
}
