import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/fixit/site-chrome";
import { SITE_EMAIL } from "@/lib/site-contact";

export const metadata: Metadata = {
  title: "Common questions — FixIt",
  description: "Answers to the questions customers and professionals ask most about FixIt.",
};

type Question = { q: string; a: string };

/** Kept in step with the Common questions tables in the customer and professional guides. */
const CUSTOMER_QUESTIONS: Question[] = [
  { q: "Does it cost anything to ask?", a: "No. Asking for prices is free and you are never obliged to accept." },
  { q: "Who can see my phone number and address?", a: "Only the professional whose price you accept." },
  {
    q: "I posted a request and have no prices.",
    a: "Professionals in that trade and city are being matched. If nothing arrives in a day or two, contact us with your customer number.",
  },
  { q: "Can I accept more than one price?", a: "No. Accepting one closes the others." },
  {
    q: "I declined by mistake.",
    a: "Message us with your customer number. The professional can also send a new price.",
  },
  {
    q: "Why must I give a reason to decline?",
    a: "It tells the professional what to change, and they may send a better price.",
  },
  { q: "Can I change my address or phone?", a: "Yes. Open My account and click Edit under Your details." },
  {
    q: "The email code never arrived.",
    a: "Check your spam and promotions folders, then press Resend email. If it still does not arrive, write to us and we will help.",
  },
  {
    q: "How do I pay?",
    a: "You pay the professional directly, on the payment terms in the price. FixIt does not take payment from you.",
  },
  { q: "When can I leave a review?", a: "After the job is finished." },
  {
    q: "What is the customer number for?",
    a: "It lets FixIt find your requests, prices and visits quickly when you contact us. It is on your account page.",
  },
  {
    q: "I forgot my password.",
    a: "Use Forgot password on the log in page; a reset link is emailed to you. Each link works once.",
  },
];

const PRO_QUESTIONS: Question[] = [
  {
    q: "Why is my profile under review?",
    a: "FixIt verifies every new business before it appears publicly. Make sure your licence number and photo ID are in.",
  },
  {
    q: "Why am I not getting leads?",
    a: "Check your status is \"Verified and listed\", that Pause new leads is off, and that your trades and cities match where customers are asking.",
  },
  {
    q: "How do I get more leads?",
    a: "Add every service you offer and every city you serve under Profile & Settings, within your plan's limits.",
  },
  {
    q: "Do I pay per lead?",
    a: "No. You pay a flat monthly plan. Seeing and pricing leads costs nothing extra.",
  },
  { q: "When do I see the customer's phone and address?", a: "Only after they accept your price." },
  {
    q: "The customer declined. Can I try again?",
    a: "Yes. Read their reason and send a new price on the same request.",
  },
  { q: "How do I change my plan?", a: "Open Payments & Plan and click Switch on the plan you want." },
  {
    q: "How does the customer pay me?",
    a: "Directly, on the payment terms in your quote. FixIt does not handle the payment.",
  },
  { q: "A lead looks fake.", a: "Click Report on the lead. FixIt staff review reported leads." },
  {
    q: "I forgot my password.",
    a: "Use Forgot password on the log in page; a reset link is emailed to you.",
  },
];

const GROUPS = [
  { id: "customers", label: "For customers", questions: CUSTOMER_QUESTIONS },
  { id: "professionals", label: "For professionals", questions: PRO_QUESTIONS },
];

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-12 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        <aside className="mb-8 lg:mb-0">
          <nav aria-label="Common questions" className="grid gap-1 lg:sticky lg:top-24">
            <span className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-muted-foreground">On this page</span>
            {GROUPS.map((group) => (
              <a
                key={group.id}
                href={`#${group.id}`}
                className="rounded-md px-3 py-2 text-[14px] text-foreground/75 hover:bg-muted"
              >
                {group.label}
              </a>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 max-w-[720px]">
          <p className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-primary">Help</p>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Common questions</h1>
          <p className="mt-6 text-[15.5px] leading-relaxed text-foreground/85">
            Short answers to what customers and professionals ask us most. Click a question to see its answer.
          </p>
          <div className="mt-8 grid gap-10">
            {GROUPS.map((group) => (
              <section key={group.id} id={group.id} className="scroll-mt-24">
                <h2 className="mb-3 font-display text-xl font-semibold">{group.label}</h2>
                <div className="divide-y divide-border rounded-xl border border-border bg-card">
                  {group.questions.map((item) => (
                    <details key={item.q} className="group">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-foreground hover:text-primary [&::-webkit-details-marker]:hidden">
                        {item.q}
                        <ChevronDown
                          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                          aria-hidden="true"
                        />
                      </summary>
                      <p className="px-5 pb-4 text-[15px] leading-relaxed text-foreground/80">{item.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-10 rounded-xl border border-border bg-muted/40 p-5 text-[14px] leading-relaxed text-foreground/80">
            Did not find your answer? Write to{" "}
            <a className="font-semibold text-primary underline" href={`mailto:${SITE_EMAIL}`}>
              {SITE_EMAIL}
            </a>
            . Support hours are Monday to Friday, 8am to 6pm Eastern. Have your customer number or FixIt pro number
            ready. Thinking of joining?{" "}
            <Link className="font-semibold text-primary underline" href="/for-businesses">
              Join as a pro
            </Link>
            .
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
