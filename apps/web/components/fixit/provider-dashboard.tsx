"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Bell,
  MessageSquare,
  MessagesSquare,
  Briefcase,
  Star,
  CreditCard,
  MapPin,
  Settings,
  Receipt,
  LifeBuoy,
  Percent,
  Crown,
  Search,
  Clock,
  CalendarClock,
  MapPinned,
  Check,
  X,
  Mail,
  Phone,
  Globe,
  FileText,
  Hash,
  Film,
  Filter,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { SITE_EMAIL } from "@/lib/site-contact";
import { getSupabase, requireSupabase } from "@/lib/supabase";
import { currentPrice } from "@/lib/payments-price";
import { getMyPaymentState, listPaymentProducts, type MyPaymentState } from "@/lib/payments";
import { BillingPortalButton, CheckoutButton } from "@/components/payments";
import { MessageThread } from "@/components/fixit/thread";
import { PLANS, PLAN_LABELS, planByKey } from "@/features/plans";
import {
  QUOTE_FIELDS,
  getRequestMedia,
  listMyAppointments,
  uploadProviderLogo,
  type Appointment,
  type JobQuote,
  type RequestMedia,
} from "@/lib/fixit";
import { QuoteComposer } from "@/components/fixit/quote-form";
import { CommissionSection, CommissionTerms } from "@/components/fixit/commission-section";
import { formatCents, getCommissionSettings, listMyCommissions, listMyLeadUsage } from "@/lib/commission";
import { contactDetailsReleased, quoteState } from "@/lib/quote-release";
import { estimateJob, formatEstimateRange } from "@/lib/fixit-estimate";
import { AvailabilityCalendar } from "@/components/fixit/availability-calendar";
import { isOpenAt, nextOpening, formatMinute } from "@/lib/fixit-availability";
import { getMyAvailability, setAcceptingWork } from "@/lib/fixit";
import { availabilityState, availabilityLabel } from "@/lib/fixit-live-availability";
import { budgetOverlaps, formatBudgetRange, type BudgetRange } from "@/lib/fixit-budget";
import { leadFunnel, formatFunnel } from "@/lib/fixit-lead-stats";
import { trialState, trialMessage, trialReminder } from "@/lib/fixit-trial";
import { groupNumber } from "@/lib/fixit-numbers";

interface ProviderRow {
  id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  status: string;
  plan: string;
  rating: number;
  review_count: number;
  logo_url: string | null;
  years_in_business: string | null;
  employees: string | null;
  /** The registration number the pro gave, and whether it was checked. */
  business_registration_number?: string | null;
  business_registration_status?: string | null;
  /** When the free founding period ends, if they are on one. */
  trial_ends_at?: string | null;
  /** Permanent FixIt business number, nine digits. Given once, never changed. */
  pro_number?: number | string | null;
  /** The shop's point, set when the address is picked. Drives dispatch distance. */
  lat?: number | null;
  lng?: number | null;
}

interface Lead {
  id: string;
  category_slug: string;
  description: string;
  customer_name: string;
  city: string;
  status: string;
  claimed_by: string | null;
  created_at: string;
  /** The customer said the job cannot wait. These leads sort to the top. */
  is_emergency?: boolean;
  /** Straight-line miles from this shop to the job; emergencies only. */
  miles?: number | null;
  /**
   * The customer's contact details. They live in their own table, which the
   * database only hands to the professional who accepted the lead, so these
   * stay null on a lead that is still up for grabs.
   */
  customer_email?: string | null;
  customer_phone?: string | null;
  /** Where the work is; released with the contact details once a quote is accepted. */
  customer_address?: string | null;
  /** The price this pro has offered on the lead, if any (one per lead). */
  quote?: JobQuote | null;
  /** Null when the request came from a guest with no account to accept a price. */
  customer_user_id?: string | null;
  /** Photos and a video the customer sent, each with a short-lived private link. */
  media?: Array<RequestMedia & { url: string | null }>;
  /** What the customer expects to spend, if they said. Cents. */
  budget_min_cents?: number | null;
  budget_max_cents?: number | null;
  /** A dispute this pro has already filed on the lead, if any. */
  disputed?: boolean;
}

interface Review {
  id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

type Section =
  | "dashboard"
  | "leads"
  | "messages"
  | "jobs"
  | "availability"
  | "reviews"
  | "commission"
  | "profile"
  | "plan"
  | "support";

// Plans come from the shared definition so the dashboard and the sign-up page
// can never disagree about what a plan costs or includes.
const PLAN_ORDER = PLANS.map((plan) => plan.key);

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  [
    "plumbing",
    "electrical",
    "hvac",
    "garage-doors",
    "roofing",
    "appliance-repair",
    "handyman",
    "cleaning",
    "pest-control",
    "landscaping",
  ].map((s) => [s, s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())]),
);

function formatWhen(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h3 className="font-display text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** A single headline number, styled like the rest of the console. */
function StatCard({
  icon: Icon,
  tone,
  value,
  label,
  sub,
  onClick,
}: {
  icon: typeof LayoutDashboard;
  tone: "blue" | "green" | "amber" | "violet" | "slate";
  value: string;
  label: string;
  sub?: string;
  onClick?: () => void;
}) {
  const tones: Record<typeof tone, string> = {
    blue: "bg-[#E9F1FB] text-[#1565C0]",
    green: "bg-[#E6F4EA] text-[#2E9E4F]",
    amber: "bg-[#FDF3D7] text-[#B8860B]",
    violet: "bg-[#EFEAFB] text-[#6D4ACA]",
    slate: "bg-muted text-foreground/70",
  };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      {...(onClick ? { onClick, type: "button" as const } : {})}
      className={`flex min-w-[190px] flex-1 items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-shadow ${
        onClick ? "hover:border-primary/40 hover:shadow-md" : ""
      }`}
    >
      <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-[21px] w-[21px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <strong className="block font-display text-[25px] font-bold leading-tight tabular-nums">{value}</strong>
        <span className="block truncate text-[12.5px] font-semibold text-foreground/70">{label}</span>
        {sub ? <span className="block truncate text-[11.5px] text-muted-foreground">{sub}</span> : null}
      </span>
    </Comp>
  );
}

/**
 * The customer's phone, email and service address for one job. The database
 * releases these to the professional who accepted the lead, so an appointment
 * the caller may see always carries them; anything withheld renders nothing.
 */
function ContactDetails({ label, phone, email, address }: { label: string; phone?: string | null; email?: string | null; address?: string | null }) {
  if (!phone && !email && !address) return null;
  return (
    <span className="mt-1.5 flex flex-col gap-1 text-[12.5px]">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      {phone ? (
        <a href={`tel:${phone}`} className="flex items-center gap-1.5 font-bold text-primary hover:underline">
          <Phone className="h-3.5 w-3.5 flex-none" aria-hidden="true" /> {phone}
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className="flex items-center gap-1.5 font-bold text-primary hover:underline">
          <Mail className="h-3.5 w-3.5 flex-none" aria-hidden="true" /> {email}
        </a>
      ) : null}
      {address ? (
        <span className="flex items-start gap-1.5 text-foreground/80">
          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-none text-accent" aria-hidden="true" /> {address}
        </span>
      ) : null}
    </span>
  );
}

/** The heading that opens every section, so the console reads like a product. */
function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-[24px] font-bold tracking-[-0.02em]">{title}</h1>
      <p className="mt-1 text-[13.5px] text-muted-foreground">{description}</p>
    </div>
  );
}

/** One line of the "next up" strip: a number, what it means, and where it leads. */
function NextUpItem({
  icon: Icon,
  value,
  label,
  detail,
  tone,
  onClick,
  action,
}: {
  icon: typeof Bell;
  value: string;
  label: string;
  detail: string;
  tone: "blue" | "violet" | "amber";
  onClick: () => void;
  action: string;
}) {
  const iconTone = {
    blue: "bg-[#E9F1FB] text-[#1565C0]",
    violet: "bg-[#F1ECFB] text-[#6B3FB5]",
    amber: "bg-[#FFF3E0] text-[#B35C00]",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 basis-[240px] items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition hover:border-primary/40 hover:shadow-sm"
    >
      <span className={`grid h-10 w-10 flex-none place-items-center rounded-lg ${iconTone}`}>
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <strong className="font-display text-[22px] font-bold leading-none tabular-nums">{value}</strong>
          <span className="text-[12.5px] font-bold text-foreground/80">{label}</span>
        </span>
        <span className="mt-1 block truncate text-[12px] text-muted-foreground">{detail}</span>
      </span>
      <span className="flex flex-none items-center gap-1 text-[12px] font-bold text-primary">
        {action}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}

/**
 * The professionals' own sign-in, on the same door as their dashboard. One
 * FixIt account drives everything; this screen just gets a service provider
 * into their console without hunting through the customer login first.
 */
function ProSignIn() {
  return <ProSignInForm />;
}

/** The sign-in form alone, so the header can open it without leaving the page. */
export function ProSignInForm({ onSignedIn }: { onSignedIn?: () => void } = {}) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await auth.signIn(email.trim(), password);
    setPending(false);
    if (!result.ok) {
      setError(result.message ?? "Sign in failed. Check your details and try again.");
      return;
    }
    // In the dashboard's own gate, a full navigation lands them on the
    // console. Opened over a page, the caller decides what happens next.
    if (onSignedIn) onSignedIn();
    else window.location.replace("/pro/dashboard");
  };

  const benefits = [
    { icon: Bell, title: "Local leads, matched to you", text: "Requests in your services and service area, never outside your coverage." },
    { icon: Briefcase, title: "Jobs and quotes in one place", text: "Accept a lead, schedule the visit and report the finished job." },
    { icon: Percent, title: "One flat monthly price", text: "No charge per lead and no commission on the work — ever." },
  ];

  // Opened over a page, the form stands alone: the dashboard's own artwork
  // would be squeezed into the width of a dialog.
  if (onSignedIn) {
    return (
      <div>
        <h2 id="pro-signin" className="font-display text-[22px] font-semibold text-secondary">
          Pro sign in
        </h2>
        <p className="mt-1 pr-8 text-[13.5px] text-muted-foreground">
          Sign in with the account you joined FixIt as a professional with.
        </p>
        <form
          onSubmit={submit}
          className="mt-5 grid gap-3.5"
        >
          <label className="block">
            <span className="mb-1 block text-[12.5px] font-bold text-foreground/75">Email address</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-input px-3 text-[15px] outline-none ring-ring focus:ring-2"
              placeholder="you@yourbusiness.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[12.5px] font-bold text-foreground/75">
              Password
              <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
                Forgot password?
              </Link>
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-md border border-input bg-input px-3 text-[15px] outline-none ring-ring focus:ring-2"
            />
          </label>
          {error ? (
            <p role="alert" className="rounded-md border border-[#F6C9C6] bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B3261E]">
              {error}
            </p>
          ) : null}
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Signing in takes you straight to your dashboard. Your home page tab stays where it was.
          </p>
          <button
            type="submit"
            disabled={pending || auth.status === "loading"}
            className="flex h-12 w-full items-center justify-center rounded-md bg-primary font-display text-[16px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in to your dashboard"}
          </button>
        </form>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          New to FixIt?{" "}
          <Link href="/for-businesses" className="font-bold text-primary hover:underline">
            Join as a pro
          </Link>
          <span className="mx-1.5 text-border">·</span>
          <Link href="/login" className="font-bold text-primary hover:underline">
            Customer sign-in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-secondary p-10 text-white lg:flex">
        <Link href="/" className="font-display text-2xl font-bold">
          Fix<span className="text-accent">It</span>{" "}
          <span className="text-[15px] font-semibold text-[#B9C8DC]">for Pros</span>
        </Link>
        <div className="max-w-[440px]">
          <h1 className="mb-3 font-display text-[34px] font-bold leading-tight">
            Your business, one professional workspace.
          </h1>
          <p className="mb-9 text-[15px] leading-relaxed text-[#B9C8DC]">
            Sign in to see new leads, manage jobs and keep on top of everything FixIt sends your way.
          </p>
          <ul className="space-y-6">
            {benefits.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/10">
                  <Icon className="h-5 w-5 text-[#F59A3D]" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block text-[15px]">{title}</strong>
                  <span className="text-[13.5px] leading-relaxed text-[#B9C8DC]">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[12.5px] text-[#8397AE]">© 2026 FixIt Local Services</p>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link href="/" className="font-display text-xl font-bold text-secondary">
              Fix<span className="text-accent">It</span>
            </Link>
            <Link href="/" className="text-[13px] font-bold text-muted-foreground hover:text-primary">
              Back to site
            </Link>
          </div>
          <h2 className="font-display text-[26px] font-bold tracking-[-0.02em]">Welcome back</h2>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            Sign in with the account you used to join FixIt as a professional.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-bold text-foreground/70">Email address</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@yourbusiness.com"
                className="h-[46px] w-full rounded-lg border border-input bg-input px-3.5 text-sm outline-none ring-ring focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-bold text-foreground/70">
                Password
                <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
                  Forgot password?
                </Link>
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-[46px] w-full rounded-lg border border-input bg-input px-3.5 text-sm outline-none ring-ring focus:ring-2"
              />
            </label>
            {error ? (
              <p role="alert" className="rounded-lg bg-[#FDECEA] px-3.5 py-2.5 text-[13px] text-[#D93025]">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending || auth.status === "loading"}
              className="h-[50px] w-full rounded-lg bg-primary font-display text-[15px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in to your dashboard"}
            </button>
          </form>

          <p className="mt-6 border-t border-border pt-5 text-center text-[13px] text-muted-foreground">
            New to FixIt?{" "}
            <Link href="/for-businesses" className="font-bold text-primary hover:underline">
              Join as a pro
            </Link>
          </p>
          <p className="mt-3 text-center text-[12px] text-muted-foreground">
            Are you a customer?{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Use the customer sign-in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function ProviderDashboard() {
  const { user, status, signOut } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("dashboard");
  const [tab, setTab] = useState<"new" | "claimed" | "all">("new");
  // What this professional actually wants to see, rather than every request in
  // their trade. The filters are theirs alone and change nothing for the
  // customer; they only stop a busy pro reading jobs they would never take.
  const [filterTrade, setFilterTrade] = useState<string>("");
  const [filterArea, setFilterArea] = useState<string>("");
  const [filterUrgency, setFilterUrgency] = useState<"any" | "emergency" | "regular">("any");
  const [filterBudget, setFilterBudget] = useState<string>("any");
  const [showFilters, setShowFilters] = useState(false);
  // A lead the pro is reporting as invalid.
  const [disputeFor, setDisputeFor] = useState<Lead | null>(null);
  const [disputeReason, setDisputeReason] = useState("fake");
  const [disputeDetail, setDisputeDetail] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Lead | null>(null);
  const [quoteFor, setQuoteFor] = useState<Lead | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [threadLead, setThreadLead] = useState<Lead | null>(null);
  const [query, setQuery] = useState("");
  const [logoMessage, setLogoMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [workMessage, setWorkMessage] = useState<string | null>(null);

  const provider = useQuery({
    queryKey: ["my-provider", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ProviderRow | null> => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("providers")
        .select(
          "id,business_name,email,phone,website,address,description,status,plan,rating,review_count,logo_url,years_in_business,employees,business_registration_number,business_registration_status,trial_ends_at,lat,lng,pro_number",
        )
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  // The pro's own hours. The scheduling dialog uses them to point out a visit
  // booked outside working time, rather than silently allowing a clash.
  const myAvailability = useQuery({
    queryKey: ["my-availability"],
    enabled: !!provider.data,
    queryFn: getMyAvailability,
  });

  const leads = useQuery({
    queryKey: ["my-leads", provider.data?.id],
    enabled: !!provider.data,
    queryFn: async (): Promise<Lead[]> => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("quote_requests")
        .select("id,category_slug,description,customer_name,city,status,claimed_by,is_emergency,created_at,customer_user_id,budget_min_cents,budget_max_cents")
        // An emergency the customer flagged comes first: these are the leads a
        // pro should answer before anything else on the list.
        .order("is_emergency", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Lead[];
      // Contact details arrive as a separate list: the database only returns
      // the rows this professional may see, which is the lead they accepted.
      const { data: contacts } = await supabase
        .from("quote_request_contacts")
        .select("quote_request_id,customer_email,customer_phone,customer_address")
        .eq("provider_id", provider.data!.id);
      const byRequest = new Map(
        (contacts ?? []).map((c) => [
          c.quote_request_id as string,
          {
            customer_email: c.customer_email as string | null,
            customer_phone: c.customer_phone as string | null,
            customer_address: c.customer_address as string | null,
          },
        ]),
      );
      // The pro's own quote on each lead. It is what the customer compares, and
      // once accepted it is what releases the contact details above. Row Level
      // Security returns only this professional's own rows, so a pro never sees
      // a competitor's price.
      const { data: quotes } = rows.length
        ? await supabase
            .from("quotes")
            .select(QUOTE_FIELDS)
            .in("quote_request_id", rows.map((row) => row.id))
        : { data: [] as JobQuote[] };
      const quoteByRequest = new Map((quotes ?? []).map((q) => [q.quote_request_id as string, q as JobQuote]));
      // The customer's photos and video, so the pro can look before quoting.
      // Only files on jobs this professional may see come back, with a private
      // link that expires.
      const mediaByRequest = rows.length
        ? await getRequestMedia(rows.map((row) => row.id))
        : ({} as Record<string, Array<RequestMedia & { url: string | null }>>);
      // The pro's own lead reports, so a lead they have already reported shows
      // that it is in review rather than inviting a second report.
      const { data: disputes } = rows.length
        ? await supabase
            .from("lead_disputes")
            .select("quote_request_id,status,reason")
            .in("quote_request_id", rows.map((row) => row.id))
        : { data: [] as Array<{ quote_request_id: string }> };
      const disputedIds = new Set((disputes ?? []).map((d) => d.quote_request_id as string));
      // Emergencies carry the distance from this shop, so the list can say how
      // far a job is without ever showing the customer's address.
      const emergencyIds = rows.filter((row) => row.is_emergency).map((row) => row.id);
      const milesById = new Map<string, number | null>();
      if (emergencyIds.length > 0) {
        const distances = await Promise.all(
          emergencyIds.map(async (id) => {
            const { data } = await supabase.rpc("my_lead_distance", { p_request_id: id });
            return [id, typeof data === "number" ? data : null] as const;
          }),
        );
        for (const [id, miles] of distances) milesById.set(id, miles);
      }
      return rows.map((row) => ({
        miles: row.is_emergency ? milesById.get(row.id) ?? null : null,
        ...row,
        ...(byRequest.get(row.id) ?? {}),
        quote: quoteByRequest.get(row.id) ?? null,
        media: mediaByRequest[row.id] ?? [],
        disputed: disputedIds.has(row.id),
      }));
    },
    refetchInterval: 30_000,
  });

  const reviews = useQuery({
    queryKey: ["my-reviews", provider.data?.id],
    enabled: !!provider.data,
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("reviews")
        .select("id,author_name,rating,comment,created_at")
        .eq("provider_id", provider.data!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as Review[];
    },
  });

  const areas = useQuery({
    queryKey: ["my-areas", provider.data?.id],
    enabled: !!provider.data,
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("provider_service_areas")
        .select("city")
        .eq("provider_id", provider.data!.id);
      if (error) throw new Error(error.message);
      return (data ?? []).map((a) => a.city);
    },
  });

  const services = useQuery({
    queryKey: ["my-services", provider.data?.id],
    enabled: !!provider.data,
    queryFn: async () => {
      const supabase = requireSupabase();
      const { data, error } = await supabase
        .from("provider_services")
        .select("category_slug")
        .eq("provider_id", provider.data!.id);
      if (error) throw new Error(error.message);
      return (data ?? []).map((s) => s.category_slug);
    },
  });

  const appointments = useQuery({
    queryKey: ["my-appointments", provider.data?.id],
    enabled: !!provider.data,
    queryFn: listMyAppointments,
    refetchInterval: 60_000,
  });

  const paymentState = useQuery({
    queryKey: ["my-payment-state"],
    queryFn: getMyPaymentState,
    retry: false,
    staleTime: 30_000,
  });

  const products = useQuery({
    queryKey: ["payment-products"],
    queryFn: listPaymentProducts,
    retry: false,
    staleTime: 60_000,
  });

  // The dashboard headline figures reuse the same commission reads as the
  // Commissions section, so the two can never disagree.
  const leadUsage = useQuery({
    queryKey: ["my-lead-usage"],
    enabled: !!provider.data,
    queryFn: listMyLeadUsage,
  });
  const myCommissions = useQuery({
    queryKey: ["my-commissions", provider.data?.id],
    enabled: !!provider.data,
    queryFn: () => listMyCommissions(provider.data!.id),
  });
  const commissionSettings = useQuery({
    queryKey: ["commission-settings"],
    queryFn: getCommissionSettings,
  });

  // A logo can be added or replaced from the profile without going back
  // through onboarding. It is stored first, then the provider row is pointed
  // at the new public address.
  const saveLogo = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadProviderLogo(file);
      const supabase = requireSupabase();
      const { error } = await supabase.from("providers").update({ logo_url: url }).eq("id", provider.data!.id);
      if (error) throw new Error(error.message);
      return url;
    },
    onSuccess: async () => {
      setLogoMessage({ kind: "ok", text: "Logo saved. It will show on your public profile." });
      await queryClient.invalidateQueries({ queryKey: ["my-provider"] });
    },
    onError: (e) =>
      setLogoMessage({ kind: "error", text: e instanceof Error ? e.message : "The logo upload failed." }),
  });

  const priceByPlan = useMemo(() => {
    const map: Record<string, string> = {};
    for (const product of products.data ?? []) {
      const chosen = currentPrice(product.prices);
      const key = chosen?.entitlementKey ?? "";
      const plan = key.replace(/_.*/, "");
      if (plan && chosen) map[plan] = chosen.id;
    }
    return map;
  }, [products.data]);

  // The work switch. Flipped from the header because it is the control a pro
  // reaches for the moment they get busy, and it must not need a page change.
  const toggleWork = useMutation({
    mutationFn: (accepting: boolean) => setAcceptingWork(accepting),
    onSuccess: async () => {
      setWorkMessage(null);
      await queryClient.invalidateQueries({ queryKey: ["my-availability"] });
      await queryClient.invalidateQueries({ queryKey: ["my-leads"] });
    },
    onError: (e) =>
      setWorkMessage(e instanceof Error ? e.message : "The switch could not be saved. Try again."),
  });

  // Report a lead that turned out to be fake, duplicated, or not the trade the
  // customer asked for. It is recorded against the lead so management can look
  // once, and this professional sees it is in review.
  const disputeLead = useMutation({
    mutationFn: async (input: { lead: Lead; reason: string; detail: string }) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from("lead_disputes").insert({
        quote_request_id: input.lead.id,
        provider_id: provider.data!.id,
        reason: input.reason,
        detail: input.detail.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setDisputeFor(null);
      setDisputeDetail("");
      setDisputeReason("fake");
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["my-leads", provider.data?.id] });
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : String(e)),
  });

  const bookVisit = useMutation({
    mutationFn: async (input: { lead: Lead; scheduledFor: string; notes: string }) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from("appointments").insert({
        provider_id: provider.data!.id,
        quote_request_id: input.lead.id,
        title: `${CATEGORY_LABEL[input.lead.category_slug] ?? input.lead.category_slug} visit`,
        customer_name: input.lead.customer_name,
        city: input.lead.city,
        scheduled_for: new Date(input.scheduledFor).toISOString(),
        notes: input.notes.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setScheduleFor(null);
      setScheduleAt("");
      setScheduleNotes("");
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["my-appointments", provider.data?.id] });
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : String(e)),
  });

  const setAppointmentStatus = useMutation({
    mutationFn: async (input: { id: string; status: "completed" | "cancelled"; requestId: string | null }) => {
      const supabase = requireSupabase();
      const { error } = await supabase
        .from("appointments")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
      // Closing the visit closes the job, which is what the customer watches in
      // their account.
      if (input.status === "completed" && input.requestId) {
        const { error: requestError } = await supabase
          .from("quote_requests")
          .update({ status: "completed" })
          .eq("id", input.requestId);
        if (requestError) throw new Error(requestError.message);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-appointments", provider.data?.id] });
      await queryClient.invalidateQueries({ queryKey: ["my-leads"] });
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : String(e)),
  });

  // A professional who signed up but has no profile yet belongs in the
  // onboarding wizard, not on a dashboard with nothing in it. Move them
  // straight there instead of asking them to click through.
  const needsOnboarding = !!user && provider.isSuccess && !provider.data;
  useEffect(() => {
    if (needsOnboarding) router.replace("/pro/onboarding");
  }, [needsOnboarding, router]);

  const myLeads = useMemo(
    () => (leads.data ?? []).filter((l) => l.claimed_by === provider.data?.id),
    [leads.data, provider.data],
  );

  const stats = useMemo(() => {
    const all = leads.data ?? [];
    const available = all.filter((l) => !l.claimed_by);
    const upcoming = (appointments.data ?? []).filter((a) => a.status === "scheduled");
    const planKey = provider.data?.plan ?? "default";
    const settings =
      (commissionSettings.data ?? []).find((c) => c.plan_key === planKey) ??
      (commissionSettings.data ?? []).find((c) => c.plan_key === "default");
    const usage = (leadUsage.data ?? [])[0];
    const included = settings?.included_leads ?? 0;
    const leadsUsed = usage?.total ?? 0;
    const pending = (myCommissions.data ?? [])
      .filter((c) => c.status === "pending" || c.status === "payable")
      .reduce((sum, c) => sum + c.amount_cents, 0);
    return {
      newLeads: available.length,
      booked: myLeads.length,
      upcoming: upcoming.length,
      rating: provider.data?.rating ?? 0,
      reviewCount: provider.data?.review_count ?? 0,
      leadsUsed,
      leadsRemaining: Math.max(included - leadsUsed, 0),
      included,
      pendingCents: pending,
      rateBps: settings?.commission_rate_bps ?? null,
    };
  }, [leads.data, myLeads.length, appointments.data, provider.data, leadUsage.data, myCommissions.data, commissionSettings.data]);

  // The budget the pro is willing to work in, resolved from the dropdown. It
  // and the funnel below sit above the early returns so the same hooks run on
  // every render; a hook after an early return changes the hook order the
  // moment the loading state clears, which React reports as a bug.
  const budgetPref = useMemo<BudgetRange | null>(() => {
    switch (filterBudget) {
      case "under-500":
        return { minCents: null, maxCents: 50_000 };
      case "500-1500":
        return { minCents: 50_000, maxCents: 150_000 };
      case "1500-plus":
        return { minCents: 150_000, maxCents: null };
      default:
        return null;
    }
  }, [filterBudget]);

  // The honest record: this pro's own leads, counted from rows they can see.
  const funnel = useMemo(
    () =>
      leadFunnel(
        (leads.data ?? []).map((l) => ({
          claimedByMe: l.claimed_by === provider.data?.id,
          quotedByMe: Boolean(l.quote),
          completed: l.status === "completed",
        })),
      ),
    [leads.data, provider.data],
  );

  // The short version of "where do I start today": the first thing on the
  // calendar, what is waiting to be priced, and prices already sent that the
  // homeowner has not answered yet. Each figure comes from rows this pro can
  // actually open, so the strip never promises something missing below.
  const nextUp = useMemo(() => {
    const mine = (leads.data ?? []).filter((l) => l.claimed_by === provider.data?.id);
    const scheduled = (appointments.data ?? [])
      .filter((a) => a.status === "scheduled")
      .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const today = scheduled.filter((a) => {
      const at = new Date(a.scheduled_for).getTime();
      return at >= startOfToday.getTime() && at <= endOfToday.getTime();
    });
    const next = scheduled.find((a) => new Date(a.scheduled_for).getTime() >= now.getTime()) ?? scheduled[0] ?? null;
    // A price is still open when the job has not started, was not lost and no
    // completed job has been reported against it yet.
    const openQuotes = mine.filter(
      (l) =>
        l.quote?.amount_cents != null &&
        l.status !== "completed" &&
        l.status !== "cancelled" &&
        l.status !== "lost",
    );
    const emergencies = (leads.data ?? []).filter((l) => !l.claimed_by && l.is_emergency);
    return { today, next, openQuotes, emergencies };
  }, [leads.data, appointments.data, provider.data]);

  if (status === "loading") {
    return <div className="p-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    return <ProSignIn />;
  }
  if (provider.isLoading) {
    return <div className="p-16 text-center text-sm text-muted-foreground">Loading your dashboard…</div>;
  }
  if (provider.error) {
    return (
      <div className="mx-auto max-w-[480px] rounded-xl border border-border bg-card p-8 text-center">
        <p className="mb-4 text-sm text-[#D93025]">{(provider.error as Error).message}</p>
        <button
          onClick={() => provider.refetch()}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!provider.data) {
    return (
      <div className="mx-auto max-w-[520px] rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="mb-2 font-display text-xl font-semibold">This login is not linked to a business</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          You are signed in as <strong className="text-foreground">{user.email}</strong>, but no FixIt
          business profile belongs to it. That is why no leads appear and a quote cannot be sent:
          quoting needs a business to send the price as.
        </p>
        <p className="mb-5 text-sm text-muted-foreground">
          Finish your business profile, or sign in with the account you joined as a professional with.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/pro/onboarding"
            className="flex h-12 items-center justify-center rounded-md bg-accent px-6 text-sm font-bold text-accent-foreground hover:bg-accent/90"
          >
            Create my business profile
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="h-11 rounded-md border border-border text-sm font-bold text-foreground/70 hover:border-primary hover:text-primary"
          >
            Sign in with another account
          </button>
        </div>
      </div>
    );
  }

  const pro = provider.data;
  const nav: Array<{ key: Section; icon: typeof LayoutDashboard; label: string; badge?: string }> = [
    { key: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { key: "leads", icon: Bell, label: "Leads", badge: String(stats.newLeads) },
    { key: "messages", icon: MessageSquare, label: "Messages" },
    { key: "jobs", icon: Briefcase, label: "Jobs & Appointments", badge: String(stats.upcoming) },
    { key: "availability", icon: CalendarClock, label: "Availability" },
    { key: "reviews", icon: Star, label: "Reviews" },
    { key: "commission", icon: Percent, label: "Commissions" },
    { key: "plan", icon: CreditCard, label: "Payments & Plan" },
    { key: "profile", icon: Settings, label: "Profile & Settings" },
    { key: "support", icon: LifeBuoy, label: "Support" },
  ];

  const SECTION_META: Record<Section, { title: string; description: string }> = {
    dashboard: {
      title: `Welcome back, ${pro.business_name}`,
      description: "Here is what is happening with your business on FixIt today.",
    },
    leads: { title: "Leads", description: "New requests near you, matched to your services and service areas." },
    messages: { title: "Messages", description: "Talk with homeowners you are working with." },
    jobs: { title: "Jobs & Appointments", description: "Your scheduled visits and job history." },
    availability: {
      title: "Availability",
      description: "The days and hours you work, and whether we send you emergency requests.",
    },
    reviews: { title: "Reviews", description: "What your customers say about your work." },
    commission: { title: "Commissions", description: "Report completed jobs and see what you owe." },
    plan: { title: "Payments & Plan", description: "Your subscription, invoices and plan options." },
    profile: { title: "Profile & Settings", description: "How your business appears to customers." },
    support: { title: "Support", description: "We are here to help." },
  };

  const searchTerm = query.trim().toLowerCase();
  const visibleLeads = (leads.data ?? [])
    .filter((l) => (tab === "new" ? !l.claimed_by : tab === "claimed" ? l.claimed_by === pro.id : true))
    .filter((l) => (filterTrade ? l.category_slug === filterTrade : true))
    .filter((l) => (filterArea ? l.city === filterArea : true))
    .filter((l) =>
      filterUrgency === "emergency"
        ? l.is_emergency
        : filterUrgency === "regular"
          ? !l.is_emergency
          : true,
    )
    .filter((l) =>
      budgetOverlaps(
        { minCents: l.budget_min_cents ?? null, maxCents: l.budget_max_cents ?? null },
        budgetPref,
      ),
    )
    .filter((l) =>
      !searchTerm ||
      [l.city, l.category_slug, l.customer_name, l.description]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm),
    );
  const filtersActive =
    Boolean(filterTrade) ||
    Boolean(filterArea) ||
    filterUrgency !== "any" ||
    filterBudget !== "any";

  const upcoming = (appointments.data ?? []).filter((a) => a.status === "scheduled");
  const past = (appointments.data ?? []).filter((a) => a.status !== "scheduled");

  const leadRow = (l: Lead, options: { showAccept?: boolean } = {}) => {
    const mine = l.claimed_by === pro.id;
    // One rule, stated once: the customer's contact details come back when they
    // accept this pro's price, or on the two cases already further along (a
    // booked visit, a guest request). Whether a detail actually came back wins,
    // so the screen never hides a contact the database allowed.
    const bookedVisit = (appointments.data ?? []).some(
      (a) => a.quote_request_id === l.id && a.status !== "cancelled",
    );
    const quote = l.quote ?? null;
    const quoteStatus = quoteState(quote);
    const contactUnlocked =
      mine &&
      contactDetailsReleased({
        status: quote?.status,
        hasAppointment: bookedVisit,
        guestRequest: l.customer_user_id === null,
        hasContactOnFile: Boolean(l.customer_phone || l.customer_email || l.customer_address),
      });
    return (
      <div key={l.id} className="flex flex-wrap items-center gap-3.5 border-b border-border py-3.5 last:border-0">
        <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[10px] bg-[#E9F1FB] text-xl">
          🔧
        </span>
        <div className="min-w-[180px] flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <strong className="text-[14.5px]">{CATEGORY_LABEL[l.category_slug] ?? l.category_slug}</strong>
            {l.is_emergency ? (
              <span className="rounded-full bg-[#FDECEA] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#C0392B]">
                Emergency
              </span>
            ) : null}
            {l.is_emergency && typeof l.miles === "number" ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-foreground/75">
                {l.miles.toFixed(1)} mi from your shop
              </span>
            ) : null}
          </span>
          <span className="block text-[12.5px] text-muted-foreground">{l.description}</span>
          {(() => {
            // The same estimate the customer saw, so both sides are looking at
            // one figure. It is a range for the category, not the pro's quote.
            const est = estimateJob({
              text: l.description,
              categorySlug: l.category_slug,
              urgency: l.is_emergency ? "emergency" : undefined,
            });
            if (!est) return null;
            return (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-semibold text-foreground/80">
                <span className="text-muted-foreground">Typical cost</span>
                <span className="tabular-nums">
                  {formatEstimateRange(est.lowCents, est.highCents)}
                </span>
                <span className="text-muted-foreground">· {est.basis}</span>
              </span>
            );
          })()}
          <span className="mt-1 flex flex-wrap gap-3.5 text-[11.5px] text-muted-foreground">
            <span>{l.customer_name}</span>
            <span className="flex items-center gap-1">
              <MapPinned className="h-3 w-3 text-accent" aria-hidden="true" /> {l.city}
            </span>
            {l.budget_min_cents != null || l.budget_max_cents != null ? (
              <span className="flex items-center gap-1 font-semibold text-foreground/80">
                <Receipt className="h-3 w-3 text-accent" aria-hidden="true" />
                Budget {formatBudgetRange({ minCents: l.budget_min_cents ?? null, maxCents: l.budget_max_cents ?? null })}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {new Date(l.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </span>
          {(l.media ?? []).length > 0 ? (
            // The customer's own photos, shown before the price is set. Opening
            // one opens the full image, because a thumbnail of a leak proves
            // very little.
            <span className="mt-2 flex flex-wrap items-center gap-2" data-testid="lead-media">
              {(l.media ?? []).map((item) =>
                item.url ? (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block h-16 w-16 flex-none overflow-hidden rounded-lg border border-border bg-muted"
                    title={item.file_name}
                  >
                    {item.kind === "photo" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt={item.file_name}
                        width={128}
                        height={128}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-foreground/60">
                        <Film className="h-4 w-4" aria-hidden="true" />
                        Video
                      </span>
                    )}
                  </a>
                ) : null,
              )}
            </span>
          ) : null}
          {mine ? (
            <span className="mt-2 flex flex-wrap items-center gap-2">
              {quoteStatus === "sent" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[11.5px] font-bold text-[#B26A00]">
                  Quote sent · {formatCents(quote!.amount_cents)} · waiting on the customer
                </span>
              ) : quoteStatus === "accepted" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-2.5 py-1 text-[11.5px] font-bold text-[#2E9E4F]">
                  Quote accepted · {formatCents(quote!.amount_cents)} · contact details below
                </span>
              ) : quoteStatus === "declined" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDECEA] px-2.5 py-1 text-[11.5px] font-bold text-[#D93025]">
                  Quote declined · {formatCents(quote!.amount_cents)} · send a new price
                </span>
              ) : contactUnlocked ? (
                // Already unlocked without a quote: a booked visit, or a guest
                // request that has no customer account to accept a price.
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-2.5 py-1 text-[11.5px] font-bold text-[#2E9E4F]">
                  Contact details shared
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-bold text-foreground/70">
                  No quote yet · send a price to unlock contact details
                </span>
              )}
              <button
                onClick={() => {
                  setQuoteFor(l);
                  setActionError(null);
                }}
                className="rounded-md border border-primary px-3 py-1.5 text-[12.5px] font-bold text-primary hover:bg-[#E9F1FB]"
              >
                {quote ? "Change quote" : "Send quote"}
              </button>
              {!l.disputed ? (
                <button
                  onClick={() => {
                    setDisputeFor(l);
                    setDisputeReason("fake");
                    setDisputeDetail("");
                    setActionError(null);
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-[12.5px] font-bold text-muted-foreground hover:border-[#D93025] hover:text-[#D93025]"
                >
                  Report this lead
                </button>
              ) : null}
            </span>
          ) : null}
          {contactUnlocked ? (
            <>
              {l.customer_address ? (
                <span className="mt-1.5 flex items-start gap-1 text-[12px] text-foreground/80">
                  <MapPinned className="mt-0.5 h-3 w-3 flex-none text-accent" aria-hidden="true" />
                  {l.customer_address}
                </span>
              ) : null}
              {l.customer_phone || l.customer_email ? (
                // The customer accepted this pro's price, which is the moment
                // the database releases the contact details; before that the
                // quote panel above stands in their place.
                <span className="mt-1.5 flex flex-wrap items-center gap-3.5 text-[12px]">
                  {l.customer_phone ? (
                    <a
                      href={`tel:${l.customer_phone}`}
                      className="flex items-center gap-1 font-bold text-primary hover:underline"
                    >
                      <Phone className="h-3 w-3" aria-hidden="true" /> {l.customer_phone}
                    </a>
                  ) : null}
                  {l.customer_email ? (
                    <a
                      href={`mailto:${l.customer_email}`}
                      className="flex items-center gap-1 font-bold text-primary hover:underline"
                    >
                      <Mail className="h-3 w-3" aria-hidden="true" /> {l.customer_email}
                    </a>
                  ) : null}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        {mine ? (
          <span className="flex flex-none flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#E6F4EA] px-3 py-1.5 text-xs font-bold text-[#2E9E4F]">
              Customer chose you ✓
            </span>
            <button
              onClick={() => {
                setScheduleFor(l);
                setScheduleAt("");
                setScheduleNotes("");
                setActionError(null);
              }}
              className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-bold text-white hover:bg-primary/90"
            >
              Schedule visit
            </button>
            <button
              onClick={() => {
                setThreadLead(l);
                setSection("messages");
              }}
              className="rounded-md border border-border px-3.5 py-2 text-[13px] font-bold text-foreground hover:border-primary hover:text-primary"
            >
              Message
            </button>
          </span>
        ) : l.status === "completed" ? (
          <span className="flex-none text-xs text-muted-foreground">Job closed</span>
        ) : (
          // Any matching professional may quote while the customer is still
          // choosing. Claiming the lead is no longer a button — the customer's
          // acceptance is what awards the job, so the way in is a price.
          <span className="flex flex-none flex-wrap items-center gap-2">
            {l.claimed_by && l.claimed_by !== pro.id ? (
              <span className="text-[11.5px] text-muted-foreground">Another pro is on it</span>
            ) : null}
            {quoteStatus === "sent" ? (
              // A price is already waiting on the customer. Saying so on the row
              // means a pro who has quoted does not have to remember which jobs
              // they have answered, and does not send the same price twice.
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[11.5px] font-bold text-[#B26A00]">
                Quote sent · {formatCents(quote!.amount_cents)} · waiting on the customer
              </span>
            ) : quoteStatus === "accepted" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-2.5 py-1 text-[11.5px] font-bold text-[#2E9E4F]">
                Quote accepted · {formatCents(quote!.amount_cents)}
              </span>
            ) : quoteStatus === "declined" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDECEA] px-2.5 py-1 text-[11.5px] font-bold text-[#D93025]">
                Quote declined · {formatCents(quote!.amount_cents)} · send a new price
              </span>
            ) : null}
            <button
              onClick={() => {
                setQuoteFor({ ...l, quote: l.quote ?? null });
                setActionError(null);
              }}
              className="rounded-md bg-[#2E9E4F] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#2E9E4F]/90"
            >
              {quote ? "Change quote" : "Send a quote"}
            </button>
            {!l.disputed ? (
              <button
                onClick={() => {
                  setDisputeFor(l);
                  setDisputeReason("fake");
                  setDisputeDetail("");
                  setActionError(null);
                }}
                className="rounded-md border border-border px-3 py-2 text-[12.5px] font-bold text-muted-foreground hover:border-[#D93025] hover:text-[#D93025]"
              >
                Report
              </button>
            ) : (
              <span className="text-[11.5px] font-bold text-[#B26A00]">Reported · in review</span>
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-[240px] flex-none flex-col bg-secondary lg:flex">
        <div className="border-b border-white/10 p-5 text-center">
          <span className="mx-auto mb-2.5 flex h-[84px] w-[84px] items-center justify-center overflow-hidden rounded-full bg-card font-display text-2xl font-bold text-primary ring-4 ring-white/10">
            {pro.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pro.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              pro.business_name.slice(0, 2).toUpperCase()
            )}
          </span>
          <strong className="block font-display text-[15px] text-white">{pro.business_name}</strong>
          <span
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              pro.status === "approved" ? "bg-[#1E3A2E] text-[#5FD38A]" : "bg-[#3A3220] text-[#F5C26B]"
            }`}
          >
            {pro.status === "approved" ? "✓ Verified" : "⏳ Under review"}
          </span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map(({ key, icon: Icon, label, badge }) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              aria-current={section === key ? "page" : undefined}
              className={`flex w-full items-center gap-3 rounded-[10px] px-4 py-3 text-left text-sm font-semibold ${
                section === key ? "bg-primary text-white" : "text-[#B9C8DC] hover:bg-white/5"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {badge && badge !== "0" && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E4574C] px-1.5 text-[11px] font-bold text-white">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="m-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[#F59A3D]">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" /> Current plan
          </span>
          <strong className="mt-1.5 block font-display text-[15px] text-white">
            {PLAN_LABELS[pro.plan] ?? pro.plan}
          </strong>
          <span className="mt-1 block text-[11.5px] text-[#B9C8DC]">
            {stats.leadsRemaining} of {stats.included} included leads left
          </span>
          <button
            onClick={() => setSection("plan")}
            className="mt-3 h-9 w-full rounded-lg bg-primary text-xs font-bold text-white hover:bg-primary/90"
          >
            Manage &amp; upgrade
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-5 border-b border-border bg-card px-7 py-3.5">
          <Link href="/" className="font-display text-xl font-bold text-secondary">
            Fix<span className="text-accent">It</span>
          </Link>
          <div className="relative hidden max-w-[520px] flex-1 sm:block">
            <Search className="absolute left-3.5 top-3.5 h-[18px] w-[18px] text-muted-foreground" aria-hidden="true" />
            <input
              aria-label="Search your leads"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && query.trim()) {
                  setTab("all");
                  setSection("leads");
                }
              }}
              placeholder="Search leads by city or job…"
              className="h-11 w-full rounded-md border border-border bg-background pl-10 pr-3.5 text-[13.5px] outline-none ring-ring focus:ring-2"
            />
          </div>
          {(() => {
            // The switch in the header, next to the leads it governs. Its state
            // is read from the same rule the customers see, so a pro can never
            // believe they are listed when a homeowner would see them as away.
            const facts = {
              acceptingWork: myAvailability.data?.acceptingWork ?? true,
              acceptsEmergency: myAvailability.data?.acceptsEmergency ?? false,
              windows: myAvailability.data?.windows ?? [],
            };
            const state = availabilityState(facts, new Date());
            const accepting = myAvailability.data?.acceptingWork ?? true;
            const busy = toggleWork.isPending;
            return (
              <span className="ml-auto hidden items-center gap-2 md:flex">
                <span
                  className={
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold " +
                    (state === "available"
                      ? "bg-[#E6F4EA] text-[#2E9E4F]"
                      : state === "open-later"
                        ? "bg-[#FFF4E5] text-[#B26A00]"
                        : "bg-muted text-muted-foreground")
                  }
                  title="How customers see you right now"
                >
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (state === "available" ? "bg-[#2E9E4F]" : "bg-current opacity-60")
                    }
                    aria-hidden="true"
                  />
                  {availabilityLabel(facts, new Date())}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={accepting}
                  aria-label={accepting ? "Stop sending me new leads" : "Start sending me new leads"}
                  disabled={busy}
                  onClick={() => toggleWork.mutate(!accepting)}
                  className={
                    "rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors disabled:opacity-60 " +
                    (accepting
                      ? "border-border bg-card text-foreground/70 hover:border-destructive hover:text-destructive"
                      : "border-transparent bg-[#2E9E4F] text-white hover:bg-[#2E9E4F]/90")
                  }
                >
                  {busy ? "Saving…" : accepting ? "Pause new leads" : "Go available"}
                </button>
              </span>
            );
          })()}
          <span className="hidden items-center gap-1.5 text-[13.5px] font-bold text-foreground/70 md:flex">
            <MapPinned className="h-4 w-4 text-accent" aria-hidden="true" />
            {areas.data?.[0] ?? "Akron, OH"}
          </span>
          <button
            type="button"
            aria-label={`Notifications (${stats.newLeads} new)`}
            onClick={() => setSection("leads")}
            className="relative ml-auto hidden h-10 w-10 items-center justify-center rounded-full border border-border text-foreground/70 hover:border-primary hover:text-primary sm:flex md:ml-0"
          >
            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            {stats.newLeads > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E4574C] px-1 text-[11px] font-bold text-white">
                {stats.newLeads}
              </span>
            )}
          </button>
          <span className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-white">
              {pro.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pro.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                pro.business_name.slice(0, 2).toUpperCase()
              )}
            </span>
            <span className="hidden sm:block">
              <strong className="block text-[13.5px]">{pro.business_name}</strong>
              <span className="block text-[11.5px] text-muted-foreground">{user.email}</span>
            </span>
            <button
              onClick={() => signOut()}
              className="ml-2 text-xs font-bold text-muted-foreground hover:text-destructive"
            >
              Log out
            </button>
          </span>
        </div>

        <div className="p-7">
          {search.get("upgraded") && (
            <p className="mb-5 rounded-md bg-[#E6F4EA] px-4 py-3 text-sm font-semibold text-[#2E9E4F]">
              Thanks! Your payment was received and your plan will update after checkout completes.
            </p>
          )}
          {actionError && (
            <p role="alert" className="mb-5 rounded-md bg-[#FDECEA] px-4 py-3 text-sm text-[#D93025]">
              {actionError}
            </p>
          )}

          {workMessage && (
            // A failed switch is worth saying out loud: a pro who believes they
            // are paused, but is not, keeps getting leads they did not want.
            <p role="alert" className="mb-5 rounded-md bg-[#FDECEA] px-4 py-3 text-sm text-[#D93025]">
              {workMessage}
            </p>
          )}

          {(() => {
            // A free period inside its last two weeks is the one notice a pro
            // must not miss, because nothing is charged for them automatically.
            const planChoice = planByKey(pro.plan === "founding" ? "professional" : pro.plan);
            const reminder = trialReminder(
              {
                businessName: pro.business_name,
                endsAt: pro.trial_ends_at,
                plan: pro.plan === "founding" ? "professional" : pro.plan,
                pricePerMonth: planChoice && planChoice.price > 0 ? planChoice.price : 199,
              },
              new Date(),
            );
            if (!reminder) return null;
            return (
              <div role="status" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[#F0DCB6] bg-[#FFF7EC] px-4 py-3 text-[13.5px] leading-relaxed text-[#7A4A00]">
                <Crown className="h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="min-w-[220px] flex-1">{reminder}</p>
                <button
                  onClick={() => setSection("plan")}
                  className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-primary-foreground hover:bg-primary/90"
                >
                  Review my plan
                </button>
              </div>
            );
          })()}

          {/* Mobile section picker: the sidebar is desktop-only. */}
          <div className="mb-5 flex flex-wrap gap-2 lg:hidden">
            {nav.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold ${
                  section === key ? "bg-primary text-white" : "border border-border text-foreground/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <SectionHeading title={SECTION_META[section].title} description={SECTION_META[section].description} />

          {section === "dashboard" && (
            <>
              {/* Start here: what needs this pro next, before any totals. */}
              <div className="mb-6 rounded-2xl border border-border bg-muted/30 p-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="font-display text-[15px] font-bold">Next up</h2>
                  <span className="text-[12px] text-muted-foreground">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <NextUpItem
                    icon={CalendarClock}
                    tone="violet"
                    value={String(nextUp.today.length)}
                    label={nextUp.today.length === 1 ? "visit today" : "visits today"}
                    detail={
                      nextUp.next
                        ? `Next: ${formatWhen(nextUp.next.scheduled_for)} · ${nextUp.next.customer_name}`
                        : "Nothing booked yet — new leads are below"
                    }
                    action="Schedule"
                    onClick={() => setSection("jobs")}
                  />
                  <NextUpItem
                    icon={Bell}
                    tone="blue"
                    value={String(stats.newLeads)}
                    label={stats.newLeads === 1 ? "new lead" : "new leads"}
                    detail={
                      nextUp.emergencies.length > 0
                        ? `${nextUp.emergencies.length} emergency ${nextUp.emergencies.length === 1 ? "request" : "requests"} waiting`
                        : stats.newLeads > 0
                          ? "Matching your services and area"
                          : "All caught up right now"
                    }
                    action="Quote"
                    onClick={() => {
                      setTab("new");
                      setSection("leads");
                    }}
                  />
                  <NextUpItem
                    icon={Receipt}
                    tone="amber"
                    value={String(nextUp.openQuotes.length)}
                    label={nextUp.openQuotes.length === 1 ? "quote sent" : "quotes sent"}
                    detail={
                      nextUp.openQuotes.length > 0
                        ? "Waiting on the homeowner to choose"
                        : "No prices waiting on an answer"
                    }
                    action="View"
                    onClick={() => setSection("jobs")}
                  />
                </div>
              </div>

              <div className="mb-6 flex flex-wrap gap-4">
                <StatCard
                  icon={Bell}
                  tone="blue"
                  value={String(stats.newLeads)}
                  label="New leads"
                  sub={stats.newLeads > 0 ? "Waiting for you" : "All caught up"}
                  onClick={() => setSection("leads")}
                />
                <StatCard
                  icon={Briefcase}
                  tone="violet"
                  value={String(stats.upcoming)}
                  label="Upcoming visits"
                  sub={`${stats.booked} job${stats.booked === 1 ? "" : "s"} accepted`}
                  onClick={() => setSection("jobs")}
                />
                <StatCard
                  icon={Percent}
                  tone="green"
                  value={String(stats.leadsRemaining)}
                  label="Included leads left"
                  sub={`${stats.leadsUsed} used of ${stats.included} this month`}
                  onClick={() => setSection("commission")}
                />
                <StatCard
                  icon={Star}
                  tone="amber"
                  value={stats.rating.toFixed(1)}
                  label="Average rating"
                  sub={`${stats.reviewCount} review${stats.reviewCount === 1 ? "" : "s"}`}
                  onClick={() => setSection("reviews")}
                />
              </div>

              <div className="mb-6 flex flex-wrap gap-4">
                <div className="flex min-w-[280px] flex-1 items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-[#0D2C54] to-[#123A6B] p-5 text-white shadow-sm">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/10">
                    <Percent className="h-5 w-5 text-[#F59A3D]" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold uppercase tracking-wide text-[#B9C8DC]">
                      Pending commissions
                    </span>
                    <strong className="block font-display text-[24px] font-bold tabular-nums">
                      {formatCents(stats.pendingCents)}
                    </strong>
                    <span className="block text-[11.5px] text-[#B9C8DC]">
                      {stats.rateBps != null ? `${(stats.rateBps / 100).toFixed(0)}% of completed job subtotals` : "No rate set"}
                    </span>
                  </span>
                  <button
                    onClick={() => setSection("commission")}
                    className="ml-auto flex-none rounded-lg bg-white/10 px-3.5 py-2 text-[12.5px] font-bold hover:bg-white/20"
                  >
                    View
                  </button>
                </div>
                <div className="flex min-w-[280px] flex-1 items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-[#E9F1FB] text-[#1565C0]">
                    <MessagesSquare className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Conversations
                    </span>
                    <strong className="block font-display text-[24px] font-bold tabular-nums">{stats.booked}</strong>
                    <span className="block text-[11.5px] text-muted-foreground">
                      Homeowners you can message right now
                    </span>
                  </span>
                  <button
                    onClick={() => setSection("messages")}
                    className="ml-auto flex-none rounded-lg border border-border px-3.5 py-2 text-[12.5px] font-bold text-foreground/70 hover:border-primary hover:text-primary"
                  >
                    Open
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-5">
                <div className="min-w-0 flex-[2] basis-[640px]">
                  <Panel
                    title="Your availability"
                    action={
                      <button
                        onClick={() => setSection("availability")}
                        className="text-[13px] font-bold text-primary hover:underline"
                      >
                        Edit hours &rarr;
                      </button>
                    }
                  >
                    <AvailabilityCalendar compact />
                  </Panel>
                  <div className="h-5" />
                  <Panel
                    title="New Leads"
                    action={
                      <button
                        onClick={() => setSection("leads")}
                        className="text-[13px] font-bold text-primary hover:underline"
                      >
                        View All Leads →
                      </button>
                    }
                  >
                    {(leads.data ?? []).filter((l) => !l.claimed_by).length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No new leads right now. Requests matching your services and area appear here automatically.
                      </p>
                    ) : (
                      (leads.data ?? []).filter((l) => !l.claimed_by).slice(0, 4).map((l) => leadRow(l, { showAccept: true }))
                    )}
                  </Panel>

                  <div className="mt-5">
                    <Panel
                      title="Your lead record"
                      action={
                        <span className="text-[11.5px] text-muted-foreground">
                          Counted from your own leads
                        </span>
                      }
                    >
                      <p className="mb-4 text-[13px] text-muted-foreground">{formatFunnel(funnel)}</p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {(
                          [
                            ["Reached you", funnel.matched],
                            ["You priced", funnel.quoted],
                            ["Chose you", funnel.won],
                            ["Completed", funnel.completed],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="rounded-lg border border-border bg-muted/30 p-3.5">
                            <span className="block font-display text-[26px] font-bold leading-none tabular-nums text-foreground">
                              {value}
                            </span>
                            <span className="mt-1 block text-[11.5px] font-semibold text-muted-foreground">
                              {label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-5 text-[12px] text-muted-foreground">
                        <span>
                          Quote rate:{" "}
                          <strong className="text-foreground">
                            {funnel.quoteRatePct == null ? "—" : funnel.quoteRatePct + "%"}
                          </strong>
                        </span>
                        <span>
                          Win rate:{" "}
                          <strong className="text-foreground">
                            {funnel.winRatePct == null ? "—" : funnel.winRatePct + "%"}
                          </strong>
                        </span>
                      </div>
                    </Panel>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-5">
                    <div className="min-w-[300px] flex-1">
                      <Panel title="Upcoming Appointments">
                        {upcoming.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Accept a lead and schedule the visit; it will show up here.
                          </p>
                        ) : (
                          <ul className="space-y-3">
                            {upcoming.slice(0, 4).map((a) => (
                              <li key={a.id}>
                                <strong className="block text-[13.5px]">{a.title}</strong>
                                <span className="text-[12.5px] text-muted-foreground">
                                  {formatWhen(a.scheduled_for)} · {a.customer_name} · {a.city}
                                </span>
                                <ContactDetails
                                  label="Customer contact"
                                  phone={a.customer_phone}
                                  email={a.customer_email}
                                  address={a.customer_address}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </Panel>
                    </div>
                    <div className="min-w-[300px] flex-1">
                      <Panel title="Recent Reviews">
                        {(reviews.data ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No reviews yet. Reviews from customers you serve will appear here.
                          </p>
                        ) : (
                          (reviews.data ?? []).slice(0, 3).map((r) => (
                            <div key={r.id} className="mb-4 last:mb-0">
                              <strong className="text-[13.5px]">{r.author_name}</strong>{" "}
                              <span className="text-xs tracking-wider text-[#F5A623]">{"★".repeat(r.rating)}</span>
                              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{r.comment}</p>
                            </div>
                          ))
                        )}
                      </Panel>
                    </div>
                  </div>
                </div>

                <div className="flex min-w-[320px] flex-1 flex-col gap-5">
                  <Panel title="Active Service Areas">
                    <div className="flex flex-wrap gap-1.5">
                      {(areas.data ?? []).map((c) => (
                        <span key={c} className="rounded-full bg-[#E9F1FB] px-3 py-1.5 text-[11.5px] font-bold text-primary">
                          {c}
                        </span>
                      ))}
                      {(areas.data ?? []).length === 0 && (
                        <span className="text-sm text-muted-foreground">No service areas set yet.</span>
                      )}
                    </div>
                  </Panel>

                  <Panel title="Subscribed Services">
                    <div className="flex flex-wrap gap-1.5">
                      {(services.data ?? []).map((slug) => (
                        <span key={slug} className="rounded-full bg-muted px-3 py-1.5 text-[11.5px] font-bold text-foreground/70">
                          {CATEGORY_LABEL[slug] ?? slug}
                        </span>
                      ))}
                      {(services.data ?? []).length === 0 && (
                        <span className="text-sm text-muted-foreground">No services selected yet.</span>
                      )}
                    </div>
                  </Panel>

                  <Panel title="Quick Actions">
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        onClick={() => router.push("/pro/onboarding")}
                        className="flex h-[46px] items-center justify-center gap-2 rounded-lg bg-primary text-[13px] font-bold text-white"
                      >
                        ⚙ Update Profile
                      </button>
                      <button
                        onClick={() => setSection("plan")}
                        className="flex h-[46px] items-center justify-center gap-2 rounded-lg bg-[#2E9E4F] text-[13px] font-bold text-white"
                      >
                        ▦ Upgrade Plan
                      </button>
                    </div>
                  </Panel>
                </div>
              </div>
            </>
          )}

          {section === "leads" && (
            <Panel
              title={searchTerm ? `Results for “${query.trim()}”` : "Matching requests"}
              action={
                <div className="flex gap-5">
                  {(
                    [
                      ["new", "New"],
                      ["claimed", "Accepted"],
                      ["all", "All"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`text-[13.5px] font-bold ${
                        tab === key ? "border-b-[3px] border-primary text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-border pb-4">
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className={
                    "inline-flex h-[36px] items-center gap-1.5 rounded-md border px-3 text-[12.5px] font-bold " +
                    (filtersActive
                      ? "border-primary bg-[#E9F1FB] text-primary"
                      : "border-border bg-card text-foreground/80 hover:bg-muted")
                  }
                >
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  Filters
                  {filtersActive ? " · on" : ""}
                </button>
                {filtersActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTrade("");
                      setFilterArea("");
                      setFilterUrgency("any");
                      setFilterBudget("any");
                    }}
                    className="text-[12.5px] font-bold text-muted-foreground hover:text-primary"
                  >
                    Clear
                  </button>
                ) : null}
                <span className="ml-auto text-[11.5px] text-muted-foreground">
                  Leads you would never take are the ones worth filtering out. Nothing here changes
                  what the customer sees.
                </span>
              </div>
              {/* Jobs are matched on the trades picked at sign-up, so a roofer is
                  never shown plumbing. Saying it here means nobody has to wonder
                  why a repair type is missing. */}
              <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[#C6DBF4] bg-[#E9F1FB] px-3.5 py-2.5 text-[12.5px] text-secondary">
                <strong className="font-semibold">You only get jobs in your trades:</strong>
                <span>
                  {(services.data ?? []).length > 0
                    ? (services.data ?? []).map((slug) => slug.replace(/-/g, " ").replace(/^./, (c: string) => c.toUpperCase())).join(", ")
                    : "none chosen yet — add your trades in Profile & Settings"}
                  .
                </span>
                <Link href="/pro/onboarding" className="font-semibold text-primary hover:underline">
                  Change trades
                </Link>
              </p>
              {showFilters ? (
                <div className="mb-4 grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] font-bold text-foreground/70">Trade</span>
                    <select
                      value={filterTrade}
                      onChange={(event) => setFilterTrade(event.target.value)}
                      className="h-[38px] w-full rounded-md border border-input bg-input px-2.5 text-[13px] outline-none ring-ring focus:ring-2"
                    >
                      <option value="">All trades you serve</option>
                      {(services.data ?? []).map((slug) => (
                        <option key={slug} value={slug}>
                          {CATEGORY_LABEL[slug] ?? slug}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] font-bold text-foreground/70">Area</span>
                    <select
                      value={filterArea}
                      onChange={(event) => setFilterArea(event.target.value)}
                      className="h-[38px] w-full rounded-md border border-input bg-input px-2.5 text-[13px] outline-none ring-ring focus:ring-2"
                    >
                      <option value="">All my service areas</option>
                      {(areas.data ?? []).map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] font-bold text-foreground/70">Urgency</span>
                    <select
                      value={filterUrgency}
                      onChange={(event) =>
                        setFilterUrgency(event.target.value as "any" | "emergency" | "regular")
                      }
                      className="h-[38px] w-full rounded-md border border-input bg-input px-2.5 text-[13px] outline-none ring-ring focus:ring-2"
                    >
                      <option value="any">Any urgency</option>
                      <option value="regular">Regular jobs</option>
                      <option value="emergency">Emergency only</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] font-bold text-foreground/70">
                      Customer budget
                    </span>
                    <select
                      value={filterBudget}
                      onChange={(event) => setFilterBudget(event.target.value)}
                      className="h-[38px] w-full rounded-md border border-input bg-input px-2.5 text-[13px] outline-none ring-ring focus:ring-2"
                    >
                      <option value="any">Any budget</option>
                      <option value="under-500">Under $500</option>
                      <option value="500-1500">$500 – $1,500</option>
                      <option value="1500-plus">$1,500 or more</option>
                    </select>
                  </label>
                </div>
              ) : null}
              {leads.isLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading leads…</p>
              ) : leads.error ? (
                <p className="py-6 text-center text-sm text-[#D93025]">{(leads.error as Error).message}</p>
              ) : visibleLeads.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {searchTerm
                    ? `No leads match “${query.trim()}”.`
                    : tab === "new"
                      ? "No new leads right now. New requests matching your services and area will appear here automatically."
                      : "Nothing here yet."}
                </p>
              ) : (
                visibleLeads.map((l) => leadRow(l, { showAccept: true }))
              )}
            </Panel>
          )}

          {section === "messages" && (
            <>
              {threadLead ? (
                <div className="mb-5">
                  <button
                    onClick={() => setThreadLead(null)}
                    className="mb-3 text-[13px] font-bold text-primary hover:underline"
                  >
                    ← All conversations
                  </button>
                  <MessageThread
                    requestId={threadLead.id}
                    role="provider"
                    counterpart={threadLead.customer_name}
                  />
                </div>
              ) : (
                <Panel title="Conversations">
                  {myLeads.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Accept a lead to start messaging the customer.
                    </p>
                  ) : (
                    myLeads.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setThreadLead(l)}
                        className="flex w-full flex-wrap items-center gap-3 border-b border-border py-3.5 text-left last:border-0 hover:bg-muted/50"
                      >
                        <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[10px] bg-[#E9F1FB] text-xl">
                          💬
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block text-[14.5px]">{l.customer_name}</strong>
                          <span className="block text-[12.5px] text-muted-foreground">
                            {CATEGORY_LABEL[l.category_slug] ?? l.category_slug} · {l.city}
                          </span>
                        </span>
                        <span className="text-[13px] font-bold text-primary">Open</span>
                      </button>
                    ))
                  )}
                </Panel>
              )}
            </>
          )}

          {section === "jobs" && (
            <div className="space-y-5">
              <Panel title="Upcoming Appointments">
                {appointments.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading appointments…</p>
                ) : upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No visits scheduled. Accept a lead and use “Schedule visit”.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {upcoming.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center gap-3.5 border-b border-border pb-4 last:border-0 last:pb-0"
                      >
                        <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[10px] bg-[#E9F1FB] text-xl">
                          📅
                        </span>
                        <span className="min-w-[180px] flex-1">
                          <strong className="block text-[14.5px]">{a.title}</strong>
                          <span className="block text-[12.5px] text-muted-foreground">
                            {formatWhen(a.scheduled_for)} · {a.customer_name} · {a.city}
                          </span>
                          {a.notes && <span className="block text-[12.5px] text-muted-foreground">{a.notes}</span>}
                          <ContactDetails
                            label="Customer contact"
                            phone={a.customer_phone}
                            email={a.customer_email}
                            address={a.customer_address}
                          />
                        </span>
                        <span className="flex flex-none items-center gap-2">
                          <button
                            onClick={() => setAppointmentStatus.mutate({ id: a.id, status: "completed", requestId: a.quote_request_id })}
                            className="flex items-center gap-1.5 rounded-md bg-[#2E9E4F] px-3.5 py-2 text-[13px] font-bold text-white hover:bg-[#2E9E4F]/90"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Mark done
                          </button>
                          <button
                            onClick={() => setAppointmentStatus.mutate({ id: a.id, status: "cancelled", requestId: null })}
                            className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-[13px] font-bold text-foreground hover:border-destructive hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
                          </button>
                          {a.quote_request_id && (
                            <button
                              onClick={() => {
                                const lead = (leads.data ?? []).find((l) => l.id === a.quote_request_id);
                                if (lead) {
                                  setThreadLead(lead);
                                  setSection("messages");
                                }
                              }}
                              className="rounded-md border border-border px-3.5 py-2 text-[13px] font-bold text-foreground hover:border-primary hover:text-primary"
                            >
                              Message
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Past Visits">
                {past.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Completed and cancelled visits will be listed here.</p>
                ) : (
                  <ul className="space-y-3">
                    {past.map((a: Appointment) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                        <span className="min-w-[180px] flex-1">
                          <strong className="block text-[14px]">{a.title}</strong>
                          <span className="text-[12.5px] text-muted-foreground">
                            {formatWhen(a.scheduled_for)} · {a.customer_name}
                          </span>
                          <ContactDetails
                            label="Customer contact"
                            phone={a.customer_phone}
                            email={a.customer_email}
                            address={a.customer_address}
                          />
                        </span>
                        <span
                          className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold ${
                            a.status === "completed"
                              ? "bg-[#E6F4EA] text-[#2E9E4F]"
                              : "bg-[#FDECEA] text-[#D93025]"
                          }`}
                        >
                          {a.status === "completed" ? "Completed" : "Cancelled"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}

          {section === "reviews" && (
            <Panel title="All reviews">
              {reviews.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading reviews…</p>
              ) : (reviews.data ?? []).length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  No reviews yet. Reviews customers leave on your profile appear here.
                </p>
              ) : (
                <div className="mb-5 flex flex-wrap gap-5">
                  <div className="min-w-[200px] flex-1 rounded-xl border border-border bg-background p-5">
                    <strong className="block font-display text-[32px] leading-tight">
                      {(stats.rating || 0).toFixed(1)}
                    </strong>
                    <span className="text-[13px] font-semibold text-foreground/70">
                      Average from {stats.reviewCount} reviews
                    </span>
                  </div>
                  <div className="min-w-[240px] flex-[2] space-y-3">
                    {(reviews.data ?? []).map((r) => (
                      <div key={r.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <strong className="text-[13.5px]">{r.author_name}</strong>{" "}
                        <span className="text-xs tracking-wider text-[#F5A623]">{"★".repeat(r.rating)}</span>
                        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          )}

          {section === "availability" && (
            <div className="flex flex-wrap gap-5">
              <div className="min-w-[320px] flex-[2] basis-[560px]">
                <Panel title="Your working hours">
                  <p className="mb-4 text-[13px] text-muted-foreground">
                    Set the days you work and the hours you are on the clock. Customers see these
                    hours on your profile, and emergency requests are sent only to professionals
                    who have turned on emergency work below.
                  </p>
                  <AvailabilityCalendar />
                </Panel>
              </div>
              <div className="flex min-w-[300px] flex-1 flex-col gap-5">
                <Panel title="How your hours are used">
                  <ul className="space-y-3 text-[13px] leading-relaxed text-muted-foreground">
                    <li>
                      <strong className="text-foreground">Matching leads.</strong> Requests in your
                      services and service areas reach you at any hour; your hours tell customers
                      when you will reply.
                    </li>
                    <li>
                      <strong className="text-foreground">Emergency work.</strong> Emergency
                      requests are offered only to professionals who opt in, so a 2am burst pipe
                      reaches someone who answers at 2am.
                    </li>
                    <li>
                      <strong className="text-foreground">Scheduling visits.</strong> When you book
                      a visit, the time you pick is checked against these hours.
                    </li>
                  </ul>
                </Panel>
              </div>
            </div>
          )}

          {section === "profile" && (
            <div className="flex flex-wrap gap-5">
              <div className="min-w-[320px] flex-[2] basis-[560px]">
                <Panel
                  title="Business Profile"
                  action={
                    <button
                      onClick={() => router.push("/pro/onboarding")}
                      className="rounded-md bg-primary px-4 py-2 text-[13px] font-bold text-white"
                    >
                      Edit profile
                    </button>
                  }
                >
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {[
                      { icon: FileText, label: "Business name", value: pro.business_name },
                      // The number a customer quotes on the phone. Labelled as
                      // FixIt's own so it is never mistaken for a state licence.
                      {
                        icon: Hash,
                        label: "FixIt pro number",
                        value: pro.pro_number ? groupNumber(String(pro.pro_number)) : "Being assigned",
                      },
                      { icon: Mail, label: "Email", value: pro.email ?? "—" },
                      { icon: Phone, label: "Phone", value: pro.phone ?? "—" },
                      { icon: Globe, label: "Website", value: pro.website ?? "—" },
                      { icon: MapPin, label: "Address", value: pro.address ?? "—" },
                      { icon: Clock, label: "Years in business", value: pro.years_in_business ?? "—" },
                      {
                        icon: FileText,
                        label: "Ohio business reg.",
                        value: pro.business_registration_number
                          ? pro.business_registration_number +
                            (pro.business_registration_status === "confirmed"
                              ? " · confirmed"
                              : pro.business_registration_status === "not_found"
                                ? " · not found on the register"
                                : " · awaiting check")
                          : "—",
                      },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label}>
                        <dt className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
                        </dt>
                        <dd className="mt-1 text-[13.5px]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {pro.description && (
                    <p className="mt-4 border-t border-border pt-4 text-[13px] leading-relaxed text-muted-foreground">
                      {pro.description}
                    </p>
                  )}
                </Panel>
              </div>
              <div className="flex min-w-[300px] flex-1 flex-col gap-5">
                <Panel title="Business logo">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                      {pro.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pro.logo_url} alt={`${pro.business_name} logo`} className="h-full w-full object-cover" />
                      ) : (
                        <span className="font-display text-xl font-bold text-primary/40">
                          {pro.business_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-[140px] flex-1 text-[12.5px] text-muted-foreground">
                      Shown on your listing and public profile. Square images look best.
                    </span>
                    <label
                      htmlFor="dashboard-logo"
                      className={`cursor-pointer rounded-md border-[1.5px] border-primary px-3.5 py-2 text-[13px] font-bold text-primary ${
                        saveLogo.isPending ? "opacity-60" : ""
                      }`}
                    >
                      {saveLogo.isPending ? "Uploading…" : pro.logo_url ? "Replace" : "Upload"}
                    </label>
                    <input
                      id="dashboard-logo"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setLogoMessage(null);
                          saveLogo.mutate(file);
                        }
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {logoMessage ? (
                    <p
                      className={`mt-3 text-[12.5px] ${
                        logoMessage.kind === "ok" ? "text-[#2E9E4F]" : "text-[#D93025]"
                      }`}
                    >
                      {logoMessage.text}
                    </p>
                  ) : null}
                </Panel>
                <Panel title="Status">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold ${
                      pro.status === "approved"
                        ? "bg-[#E6F4EA] text-[#2E9E4F]"
                        : "bg-[#FDF3D7] text-[#B8860B]"
                    }`}
                  >
                    {pro.status === "approved" ? "✓ Verified and listed" : "⏳ Under review"}
                  </span>
                  <p className="mt-3 text-[12.5px] text-muted-foreground">
                    {pro.status === "approved"
                      ? "Your profile is public and you receive matching leads."
                      : "An administrator reviews your profile before it appears in search."}
                  </p>
                </Panel>
                <Panel
                  title="Services & Areas"
                  action={
                    <button
                      onClick={() => router.push("/pro/onboarding")}
                      className="text-[13px] font-bold text-primary hover:underline"
                    >
                      Manage →
                    </button>
                  }
                >
                  <div className="flex flex-wrap gap-1.5">
                    {(services.data ?? []).map((slug) => (
                      <span key={slug} className="rounded-full bg-[#E9F1FB] px-3 py-1.5 text-[11.5px] font-bold text-primary">
                        {CATEGORY_LABEL[slug] ?? slug}
                      </span>
                    ))}
                    {(areas.data ?? []).map((city) => (
                      <span key={city} className="rounded-full bg-muted px-3 py-1.5 text-[11.5px] font-bold text-foreground/70">
                        {city}
                      </span>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {section === "commission" && (
            <div className="space-y-5">
              <CommissionSection plan={pro.plan} providerId={pro.id} />
            </div>
          )}
          {section === "plan" && (
            <div className="space-y-5">
              {(() => {
                // The free period, stated plainly: how long is left and what it
                // costs after. A pro should never learn the price from a charge.
                const state = trialState(pro.trial_ends_at ?? null, new Date());
                if (state.kind === "none") return null;
                const info = planByKey(pro.plan === "founding" ? "starter" : pro.plan);
                const tone =
                  state.kind === "over"
                    ? "border-[#E8A0A0] bg-[#FDECEA] text-[#B3261E]"
                    : state.kind === "ending-soon"
                      ? "border-[#F0DCB6] bg-[#FFF7EC] text-[#B26A00]"
                      : "border-[#C3D9F0] bg-[#E9F1FB] text-[#0D47A1]";
                return (
                  <div className={"rounded-xl border p-4 " + tone}>
                    <span className="flex items-center gap-2 font-display text-[15px] font-semibold">
                      <Crown className="h-4 w-4" aria-hidden="true" />
                      {state.kind === "over" ? "Your free period has ended" : "Founding Pro — free period"}
                    </span>
                    <p className="mt-1 text-[13px] leading-relaxed">
                      {trialMessage(state, info && info.price > 0 ? info.price : null)}
                    </p>
                  </div>
                );
              })()}
              <Panel title="Subscription Plan">
                {paymentState.isLoading ? (
                  <p className="text-sm text-muted-foreground">Checking billing…</p>
                ) : (paymentState.data as MyPaymentState | undefined)?.subscriptions?.length ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      You have an active billing relationship. Change or cancel it in the customer portal.
                    </p>
                    <BillingPortalButton
                      returnPath="/pro/dashboard"
                      className="h-[46px] w-full max-w-[320px] rounded-lg bg-primary text-sm font-bold text-white"
                    >
                      Manage Plan
                    </BillingPortalButton>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You are currently on the{" "}
                    <strong className="text-foreground">{PLAN_LABELS[pro.plan] ?? pro.plan}</strong> plan. Choose a
                    plan below for more cities, higher placement and faster lead alerts.
                  </p>
                )}
              </Panel>

              <CommissionTerms planKey={pro.plan} className="rounded-lg bg-[#F7F9FC] p-4" />
              <div className="grid gap-5 sm:grid-cols-3">
                {PLAN_ORDER.map((plan) => {
                  const on = pro.plan === plan;
                  const info = planByKey(plan);
                  // The free founding tier has no price to check out with.
                  const priceId = info && info.price > 0 ? priceByPlan[plan] : undefined;
                  return (
                    <div
                      key={plan}
                      className={`relative rounded-xl border bg-card p-5 ${
                        on ? "border-2 border-accent" : "border-border"
                      }`}
                    >
                      {on && (
                        <span className="absolute right-4 top-4 rounded-full bg-[#E9F1FB] px-2.5 py-1 text-[11px] font-bold text-primary">
                          Current
                        </span>
                      )}
                      <strong className="mb-1.5 block font-display text-base font-semibold">
                        {PLAN_LABELS[plan] ?? plan}
                      </strong>
                      <span className="mb-1 block">
                        <span className="font-display text-3xl font-bold">
                          {info ? (info.price === 0 ? "Free" : `$${info.price}`) : "—"}
                        </span>
                        {info && info.price > 0 ? (
                          <span className="text-xs text-muted-foreground"> /month</span>
                        ) : null}
                      </span>
                      {info?.tagline ? (
                        <span className="mb-3 block text-[12px] text-muted-foreground">{info.tagline}</span>
                      ) : null}
                      <ul className="mb-4 space-y-1.5">
                        {(info?.features ?? []).map((feature) => (
                          <li key={feature} className="flex gap-2 text-[12.5px] text-foreground/70">
                            <span className="text-[#2E9E4F]" aria-hidden="true">
                              ✓
                            </span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                      {on ? (
                        <span className="block rounded-md bg-muted px-3 py-2.5 text-center text-[12px] font-bold text-muted-foreground">
                          Your current plan
                        </span>
                      ) : info && info.price === 0 ? (
                        <span className="block rounded-md bg-[#FFF7EC] px-3 py-2.5 text-center text-[12px] font-bold text-[#B35C00]">
                          Free — no billing
                        </span>
                      ) : priceId ? (
                        <CheckoutButton
                          priceId={priceId}
                          successPath="/pro/dashboard?upgraded=1"
                          cancelPath="/pro/dashboard"
                          className="h-[42px] w-full rounded-md bg-accent text-sm font-bold text-accent-foreground hover:bg-accent/90"
                        >
                          Switch to {PLAN_LABELS[plan]}
                        </CheckoutButton>
                      ) : (
                        <span className="block rounded-md bg-muted px-3 py-2 text-center text-[11px] text-muted-foreground">
                          Billing activates once payments are connected
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {(paymentState.data as MyPaymentState | undefined)?.entitlements?.length ? (
                <Panel title="Active Entitlements">
                  <ul className="space-y-2">
                    {((paymentState.data as MyPaymentState).entitlements ?? []).map((item) => (
                      <li key={item.entitlementKey} className="flex items-center gap-2 text-[13px]">
                        <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
                        <strong>{PLAN_LABELS[item.entitlementKey] ?? item.entitlementKey}</strong>
                        <span className="text-muted-foreground">{item.active ? "active" : "inactive"}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          )}

          {section === "support" && (
            <div className="flex flex-wrap gap-5">
              <div className="min-w-[300px] flex-[2] basis-[520px]">
                <Panel title="Contact us">
                  <p className="mb-4 text-sm text-muted-foreground">
                    Questions about leads, billing, or your listing? Send us a note and we will get back to you.
                  </p>
                  <ul className="space-y-3 text-[13.5px]">
                    <li className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                      <a className="text-primary hover:underline" href={`mailto:${SITE_EMAIL}`}>
                        {SITE_EMAIL}
                      </a>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span>Mon–Fri, 8am–6pm ET</span>
                    </li>
                  </ul>
                </Panel>
              </div>
              <div className="min-w-[300px] flex-1">
                <Panel title="Common Questions">
                  <ul className="space-y-3 text-[13px] text-muted-foreground">
                    <li>
                      <strong className="block text-foreground">How do I get more leads?</strong>
                      Add every service you offer and every city you serve from your profile.
                    </li>
                    <li>
                      <strong className="block text-foreground">Why is my profile under review?</strong>
                      An administrator verifies new businesses before they appear publicly.
                    </li>
                    <li>
                      <strong className="block text-foreground">How do I change my plan?</strong>
                      Open Payments &amp; Plan from the sidebar.
                    </li>
                  </ul>
                </Panel>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule-visit dialog */}
      {quoteFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send a quote"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-[640px] rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-1 font-display text-xl font-semibold">
              {quoteFor.quote ? "Change your quote" : "Send a quote"}
            </h2>
            <p className="mb-5 text-[13px] text-muted-foreground">
              {CATEGORY_LABEL[quoteFor.category_slug] ?? quoteFor.category_slug} · {quoteFor.customer_name} ·{" "}
              {quoteFor.city}
            </p>
            <div className="max-h-[70vh] overflow-y-auto pr-1">
              <QuoteComposer
                requestId={quoteFor.id}
                existing={quoteFor.quote ?? null}
                onDone={() => {
                  setQuoteFor(null);
                  setActionError(null);
                }}
                onError={(message) => setActionError(message)}
              />
            </div>
            {actionError && (
              <p role="alert" className="mt-3 rounded-md bg-[#FDECEA] px-3.5 py-2.5 text-[13px] text-[#D93025]">
                {actionError}
              </p>
            )}
            <p className="mt-4 rounded-md bg-muted px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
              When the customer accepts your price, their phone, email and service address are
              released to you here. If they accept someone else&apos;s, this quote is closed.
            </p>
          </div>
        </div>
      )}

      {scheduleFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Schedule a visit"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-[460px] rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-1 font-display text-xl font-semibold">Schedule a visit</h2>
            <p className="mb-5 text-[13px] text-muted-foreground">
              {CATEGORY_LABEL[scheduleFor.category_slug] ?? scheduleFor.category_slug} · {scheduleFor.customer_name} ·{" "}
              {scheduleFor.city}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!scheduleAt) return;
                bookVisit.mutate({ lead: scheduleFor, scheduledFor: scheduleAt, notes: scheduleNotes });
              }}
            >
              <label className="mb-1.5 block text-[13px] font-bold" htmlFor="visit-when">
                Date and time
              </label>
              <input
                id="visit-when"
                type="datetime-local"
                required
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="mb-2 h-11 w-full rounded-md border border-input bg-input px-3.5 text-sm outline-none ring-ring focus:ring-2"
              />
              {(() => {
                // A visit outside the pro's own hours is allowed, but they
                // should not be surprised by it later.
                const windows = myAvailability.data?.windows ?? [];
                if (!scheduleAt || windows.length === 0) return null;
                const at = new Date(scheduleAt);
                if (Number.isNaN(at.getTime()) || isOpenAt(windows, at)) return null;
                const next = nextOpening(windows, at);
                const nextText = next
                  ? ", your next opening is " +
                    next.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) +
                    " (" + formatMinute(next.getHours() * 60 + next.getMinutes()) + ")"
                  : "";
                return (
                  <p className="mb-4 rounded-md bg-[#FFF4E5] px-3 py-2 text-[12.5px] text-[#B26A00]">
                    This time is outside your working hours{nextText}.
                  </p>
                );
              })()}
              <label className="mb-1.5 block text-[13px] font-bold" htmlFor="visit-notes">
                Notes for the customer <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="visit-notes"
                rows={3}
                value={scheduleNotes}
                onChange={(event) => setScheduleNotes(event.target.value)}
                placeholder="Arrival window, what to prepare…"
                className="mb-5 w-full rounded-md border border-input bg-input p-3.5 text-sm outline-none ring-ring focus:ring-2"
              />
              {actionError && (
                <p role="alert" className="mb-3 rounded-md bg-[#FDECEA] px-3.5 py-2.5 text-[13px] text-[#D93025]">
                  {actionError}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleFor(null)}
                  className="h-[46px] flex-1 rounded-lg border border-border text-sm font-bold text-foreground/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookVisit.isPending || !scheduleAt}
                  className="h-[46px] flex-1 rounded-lg bg-primary text-sm font-bold text-white disabled:opacity-60"
                >
                  {bookVisit.isPending ? "Saving…" : "Schedule visit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {disputeFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Report an invalid lead"
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
        >
          <div className="w-full max-w-[480px] rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="mb-1 font-display text-xl font-semibold">Report this lead</h2>
            <p className="mb-4 text-[13px] text-muted-foreground">
              {CATEGORY_LABEL[disputeFor.category_slug] ?? disputeFor.category_slug} ·{" "}
              {disputeFor.customer_name} · {disputeFor.city}
            </p>
            <p className="mb-4 rounded-md bg-muted px-3.5 py-3 text-[12.5px] leading-relaxed text-foreground/80">
              Tell us what is wrong and a person will look at it. FixIt does not charge you for
              leads, so this is not a refund — it is how a fake, duplicate or out-of-area request is
              taken off the board and kept off.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                disputeLead.mutate({ lead: disputeFor, reason: disputeReason, detail: disputeDetail });
              }}
            >
              <label className="mb-1.5 block text-[13px] font-bold" htmlFor="dispute-reason">
                What is wrong?
              </label>
              <select
                id="dispute-reason"
                value={disputeReason}
                onChange={(event) => setDisputeReason(event.target.value)}
                className="mb-4 h-11 w-full rounded-md border border-input bg-input px-3.5 text-sm outline-none ring-ring focus:ring-2"
              >
                <option value="fake">It looks fake or was a test</option>
                <option value="duplicate">I have seen this same job before</option>
                <option value="out_of_area">It is outside my service area</option>
                <option value="wrong_trade">It is not the trade it says</option>
                <option value="already_done">The job is already done</option>
                <option value="unreachable">The customer cannot be reached</option>
                <option value="other">Something else</option>
              </select>
              <label className="mb-1.5 block text-[13px] font-bold" htmlFor="dispute-detail">
                Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="dispute-detail"
                rows={3}
                value={disputeDetail}
                onChange={(event) => setDisputeDetail(event.target.value)}
                placeholder="What made you think so?"
                className="mb-5 w-full rounded-md border border-input bg-input p-3.5 text-sm outline-none ring-ring focus:ring-2"
              />
              {actionError && (
                <p role="alert" className="mb-3 rounded-md bg-[#FDECEA] px-3.5 py-2.5 text-[13px] text-[#D93025]">
                  {actionError}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDisputeFor(null)}
                  className="h-[46px] flex-1 rounded-lg border border-border text-sm font-bold text-foreground/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disputeLead.isPending}
                  className="h-[46px] flex-1 rounded-lg bg-[#D93025] text-sm font-bold text-white disabled:opacity-60"
                >
                  {disputeLead.isPending ? "Sending…" : "Report lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
