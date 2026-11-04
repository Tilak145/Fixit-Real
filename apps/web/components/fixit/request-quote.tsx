"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/fixit/site-chrome";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { getMyProfile } from "@/lib/fixit";
import { estimateJob, formatEstimateRange, type CostEstimate } from "@/lib/fixit-estimate";
import { AddressInput } from "@/components/fixit/address-input";
import { CitySelect } from "@/components/fixit/city-select";
import { MediaPicker, type PendingMedia } from "@/components/fixit/media-picker";
import { uploadRequestMedia } from "@/lib/fixit";
import { JOB_DRAFT_KEY, readJobDraft } from "@/lib/job-draft";
import {
  BUDGET_PRESETS,
  parseDollarsToCents,
  validateBudgetRange,
  type BudgetRange,
} from "@/lib/fixit-budget";

const inputClass =
  "h-[44px] w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2";

// The service a customer picked stays picked: it is remembered on this device
// and refilled on the next request, until they choose a different one.
const SERVICE_KEY = "fixit.request.service";
const SERVICE_SLUGS = [
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
];

function readSavedService(): string | null {
  try {
    const saved = window.localStorage.getItem(SERVICE_KEY);
    return saved && SERVICE_SLUGS.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function RequestQuoteForm() {
  const search = useSearchParams();
  const fromLink = useCallback((key: string) => search.get(key), [search]);
  return <QuoteRequestForm initial={{ fromLink }} />;
}

/**
 * The request form itself. `initial` says where its starting values come from:
 * the link on the request page, or what the visitor typed on the home page
 * before it opened in place. Either way nothing here reads the address bar, so
 * the same form can open without the page changing.
 */
export function QuoteRequestForm({
  initial,
}: {
  initial: {
    fromLink: (key: string) => string | null;
    onDone?: () => void;
    /** "window" drops the page-sized frame, for opening over the home page. */
    surface?: "page" | "window";
  };
}) {
  const fromLink = initial.fromLink;
  // A city named in the link (?city=Kent, OH) is read once and held as a plain
  // string, so it can be a stable dependency below without re-running effects.
  const cityFromLink = fromLink("city") ?? "";
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Set when a signed-out visitor tries to send: the form points at the
  // account step instead of failing quietly.
  const [needsAccount, setNeedsAccount] = useState(false);
  const accountPromptRef = useRef<HTMLDivElement>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  // The live cost estimate: recomputed as the customer describes the job or
  // changes the service, so the figure always matches what they have entered.
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [categorySlug, setCategorySlug] = useState(fromLink("service") ?? "plumbing");
  const [description, setDescription] = useState(() => fromLink("job") ?? "");
  // A customer can say the job cannot wait. The flag is always the customer's.
  const [emergency, setEmergency] = useState(false);
  // The details a signed-in customer already gave us, used to fill the form.
  // The city a link arrived with (?city=Kent, OH) is a real choice, not a
  // default, so it seeds the form and is not overwritten by a saved profile.
  const [prefill, setPrefill] = useState({
    name: "",
    email: "",
    phone: "",
    city: cityFromLink,
    address: "",
  });
  // The photos chosen so far, held locally until the request is sent: the job
  // does not exist yet, and a file has to belong to a job.
  const [media, setMedia] = useState<PendingMedia[]>([]);
  // Where the customer's chosen address is, kept only so an emergency can be
  // routed by distance. Not shown anywhere.
  const [jobPoint, setJobPoint] = useState<{ lat: number; lng: number } | null>(null);
  // What the customer is willing to spend. This is what lets a professional
  // judge a job before spending an afternoon on it, and it is entirely
  // optional: "not sure" is a real answer and leaves the range empty.
  const [budgetId, setBudgetId] = useState<string>("");
  const [customMin, setCustomMin] = useState("");
  const [customMax, setCustomMax] = useState("");
  // A job started here is kept on the device until it is sent, so signing up
  // halfway through does not lose what was typed. Read once on the client only:
  // during server rendering there is no storage, and reading it there would
  // make the first paint disagree with the browser.
  const draftLoaded = useRef(false);
  const [hadDraft, setHadDraft] = useState(false);

  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(JOB_DRAFT_KEY);
    } catch {
      raw = null;
    }
    const draft = readJobDraft(raw);
    if (!draft) return;
    // The link a visitor arrived with is newer than anything saved earlier, so
    // it wins where it says something.
    if (!fromLink("service") && draft.categorySlug && SERVICE_SLUGS.includes(draft.categorySlug)) {
      setCategorySlug(draft.categorySlug);
    }
    if (draft.description) setDescription(draft.description);
    setPrefill((p) => ({
      ...p,
      city: p.city || draft.city,
      address: p.address || draft.address,
    }));
    if (draft.lat != null && draft.lng != null) setJobPoint({ lat: draft.lat, lng: draft.lng });
    if (draft.emergency) setEmergency(true);
    if (draft.budgetId) setBudgetId(draft.budgetId);
    if (draft.customMin) setCustomMin(draft.customMin);
    if (draft.customMax) setCustomMax(draft.customMax);
    setHadDraft(true);
    // Runs once: the form is the thing being restored, not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the draft current while it is being filled in. Once the customer is
  // signed in their account holds the details, so the copy is only a fallback
  // and is cleared as soon as the request is sent.
  useEffect(() => {
    if (!draftLoaded.current) return;
    try {
      window.localStorage.setItem(
        JOB_DRAFT_KEY,
        JSON.stringify({
          categorySlug,
          description,
          city: prefill.city,
          address: prefill.address,
          emergency,
          budgetId,
          customMin,
          customMax,
          lat: jobPoint?.lat ?? null,
          lng: jobPoint?.lng ?? null,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Private browsing refuses storage; the form simply is not remembered.
    }
  }, [categorySlug, description, prefill.city, prefill.address, emergency, budgetId, customMin, customMax, jobPoint]);

  function resolveBudget(): BudgetRange {
    if (budgetId === "custom") {
      return {
        minCents: parseDollarsToCents(customMin),
        maxCents: parseDollarsToCents(customMax),
      };
    }
    const preset = BUDGET_PRESETS.find((p) => p.id === budgetId);
    if (!preset) return { minCents: null, maxCents: null };
    return {
      minCents: preset.minDollars * 100,
      maxCents: preset.maxDollars == null ? null : preset.maxDollars * 100,
    };
  }

  const profile = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: getMyProfile,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;
    const saved = profile.data;
    setPrefill({
      name: saved?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "",
      email: user.email ?? "",
      phone: saved?.phone ?? "",
      city: cityFromLink || saved?.city || "",
      address: saved?.address ?? "",
    });
  }, [user, profile.data, cityFromLink]);

  // Reuse the service chosen last time, unless this visit names one in the
  // link (?service=roofing) or the customer changes it here.
  useEffect(() => {
    const linkedService = fromLink("service");
    if (linkedService && SERVICE_SLUGS.includes(linkedService)) return;
    const saved = readSavedService();
    if (saved) setCategorySlug(saved);
  }, [fromLink]);

  function chooseService(slug: string) {
    setCategorySlug(slug);
    try {
      window.localStorage.setItem(SERVICE_KEY, slug);
    } catch {
      // A browser that blocks storage still works; the pick just is not kept.
    }
  }

  // Recompute the estimate whenever the description, service or urgency changes.
  useEffect(() => {
    const urgency = emergency ? "emergency" : undefined;
    setEstimate(estimateJob({ text: description, categorySlug, urgency }));
  }, [description, categorySlug, emergency]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // A request has to belong to someone: that is how the customer accepts a
    // price, sees who they chose, and keeps contact details private until then.
    // So a signed-out visitor is asked for an account instead of sending as a
    // guest nobody can follow up with.
    if (!user) {
      setStatus("error");
      setError(null);
      setNeedsAccount(true);
      window.requestAnimationFrame(() => accountPromptRef.current?.scrollIntoView({ block: "center" }));
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setStatus("error");
      setError("Data services are not connected yet, so your request cannot be saved. Please try again later.");
      return;
    }
    const form = new FormData(e.currentTarget);
    setStatus("submitting");
    setError(null);
    const budget = resolveBudget();
    const budgetProblem = validateBudgetRange(budget.minCents, budget.maxCents);
    if (budgetProblem) {
      setStatus("error");
      setError(budgetProblem);
      return;
    }
    const { data: created, error: insertError } = await supabase
      .from("quote_requests")
      .insert({
        category_slug: String(form.get("category_slug") ?? "plumbing"),
        description: String(form.get("description") ?? ""),
        customer_name: String(form.get("customer_name") ?? ""),
        customer_email: String(form.get("customer_email") ?? ""),
        customer_phone: String(form.get("customer_phone") ?? "") || null,
        city: String(form.get("city") ?? ""),
        customer_address: String(form.get("customer_address") ?? "") || null,
        customer_user_id: user.id,
        is_emergency: emergency,
        // The picked address's point, so an emergency goes to the nearest crew.
        lat: jobPoint?.lat ?? null,
        lng: jobPoint?.lng ?? null,
        budget_min_cents: budget.minCents,
        budget_max_cents: budget.maxCents,
        budget_set_at:
          budget.minCents == null && budget.maxCents == null ? null : new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertError || !created) {
      setStatus("error");
      setError(insertError ? insertError.message : "Your request could not be saved. Please try again.");
      return;
    }
    // The job now exists, so its photos can be attached to it. A file that
    // fails here does not lose the request: the request is already saved, and
    // the customer is told which part did not go through.
    const failed: string[] = [];
    for (const item of media) {
      try {
        await uploadRequestMedia({ requestId: created.id as string, file: item.file });
      } catch {
        failed.push(item.file.name);
      }
    }
    if (failed.length > 0) {
      setUploadWarning(
        "Your request was sent, but these files did not upload: " +
          failed.join(", ") +
          ". You can add them from your account.",
      );
    }
    setStatus("done");
    try {
      window.localStorage.removeItem(JOB_DRAFT_KEY);
    } catch {
      // Nothing to clear if storage is unavailable.
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E6F4EA]">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2E9E4F" strokeWidth="3" aria-hidden="true">
            <path d="m5 13 4 4 10-10" />
          </svg>
        </div>
        <h2 className="mb-2 font-display text-2xl font-semibold">Your request is in!</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {media.length > 0
            ? "Matching professionals in your area will look at your " +
              (media.length === 1 ? "photo" : "photos and video") +
              " and respond with free quotes — usually within a few hours."
            : "Matching professionals in your area will respond with free quotes — usually within a few hours."}
        </p>
        {uploadWarning ? (
          <p role="alert" className="mb-5 rounded-md bg-[#FFF4E5] px-4 py-3 text-left text-[13px] text-[#B26A00]">
            {uploadWarning}
          </p>
        ) : null}
        <Link
          href="/"
          onClick={() => initial.onDone?.()}
          className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <form
      id="quote-form"
      onSubmit={onSubmit}
      className={
        initial.surface === "window"
          ? "bg-card"
          : "rounded-xl border border-border bg-card p-8 shadow-sm"
      }
    >
      <h1 className="mb-1 font-display text-2xl font-semibold">Request a Free Quote</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Tell us what you need and we&apos;ll route your request to trusted pros in {""}
        your area.
      </p>
      {hadDraft ? (
        <p
          role="status"
          className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-md bg-[#E9F1FB] px-3.5 py-2.5 text-[12.5px] text-foreground/80"
        >
          <span>We kept the job you started, so you can carry on where you left off.</span>
          <button
            type="button"
            onClick={() => {
              setHadDraft(false);
              try {
                window.localStorage.removeItem(JOB_DRAFT_KEY);
              } catch {
                // Nothing to clear if storage is unavailable.
              }
            }}
            className="font-bold text-primary hover:underline"
          >
            Start a new job
          </button>
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-foreground/70">Service needed</span>
          <select
            name="category_slug"
            value={categorySlug}
            onChange={(event) => chooseService(event.target.value)}
            className={inputClass}
          >
            <option value="plumbing">Plumbing</option>
            <option value="electrical">Electrical</option>
            <option value="hvac">HVAC</option>
            <option value="garage-doors">Garage Doors</option>
            <option value="roofing">Roofing</option>
            <option value="appliance-repair">Appliance Repair</option>
            <option value="handyman">Handyman</option>
            <option value="cleaning">Cleaning</option>
            <option value="pest-control">Pest Control</option>
            <option value="landscaping">Landscaping</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-foreground/70">City</span>
          <CitySelect
            name="city"
            required
            value={prefill.city || ""}
            onChange={(city) => setPrefill((p) => ({ ...p, city }))}
            className={inputClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-bold text-foreground/70">Service address</span>
          <AddressInput
            name="customer_address"
            value={prefill.address}
            onChange={(value) => setPrefill((p) => ({ ...p, address: value }))}
            onPick={(suggestion) => {
              // The job's point is what sends an emergency to the nearest crew.
              // It is saved with the request and never shown to a professional.
              setJobPoint(
                typeof suggestion.lat === "number" && typeof suggestion.lng === "number"
                  ? { lat: suggestion.lat, lng: suggestion.lng }
                  : null,
              );
              setPrefill((p) => ({
                ...p,
                address: suggestion.label,
                // The picked address already knows its city, in the form the
                // app matches on ("Akron, OH"), so filling it in is what lets
                // the request reach pros serving that city. It only fills the
                // city when the customer has not already chosen one.
                city: p.city ? p.city : suggestion.cityLabel,
              }));
            }}
            placeholder="Start typing your address, e.g. 123 Main St"
            className={inputClass}
          />
          <span className="mt-1 block text-[11.5px] text-muted-foreground">
            Pick your address from the list so we route it to the right pros. Your exact address is
            shared with the professional you choose, not with everyone who quotes.
          </span>
        </label>
        <div className="sm:col-span-2">
          <MediaPicker
            media={media}
            onChange={setMedia}
            disabled={!user}
            disabledNote={
              "Sign in to add photos — they are kept with your request and shown only to the pros who can see the job."
            }
          />
        </div>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-bold text-foreground/70">Describe the job</span>
          <textarea
            name="description"
            required
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="For example: kitchen faucet leaking, need repair or replacement"
            className="w-full rounded-md border border-input bg-input px-3 py-2.5 text-sm outline-none ring-ring focus:ring-2"
          />
        </label>
        <div className="sm:col-span-2">
          <label
            className={`mt-3 flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
              emergency ? "border-[#E8A0A0] bg-[#FDECEA]" : "border-border bg-muted/40"
            }`}
          >
            <input
              type="checkbox"
              name="is_emergency"
              checked={emergency}
              onChange={(event) => setEmergency(event.target.checked)}
              className="mt-0.5 h-4 w-4 flex-none"
              data-testid="emergency-toggle"
            />
            <span>
              <span className="block text-[13.5px] font-bold text-foreground">
                This is an emergency — I need help today
              </span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                For things like a burst pipe, a water leak or no heat. Your request is flagged so
                available pros see it first, and emergency work is priced higher.
              </span>
            </span>
          </label>
          {estimate && (
            <div
              className="mt-3 rounded-lg border border-border bg-muted/40 p-4"
              data-testid="estimate-panel"
            >
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Typical cost for this job
              </p>
              <p className="font-display text-[24px] font-bold tabular-nums text-foreground">
                {formatEstimateRange(estimate.lowCents, estimate.highCents)}
              </p>
              <p className="mt-0.5 text-[13px] text-foreground/80">{estimate.summary}</p>
              {estimate.emergency ? (
                <p className="mt-1 text-[12px] font-bold text-[#B35C00]">
                  Emergency / same-day work is usually priced higher than this range.
                </p>
              ) : null}
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">{estimate.note}</p>
            </div>
          )}
        </div>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-bold text-foreground/70">
            Roughly what do you expect this to cost?
          </span>
          <div className="flex flex-wrap gap-2">
            {BUDGET_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setBudgetId(budgetId === preset.id ? "" : preset.id)}
                className={
                  "h-[38px] rounded-full border px-4 text-[13px] font-bold " +
                  (budgetId === preset.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground/80 hover:bg-muted")
                }
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setBudgetId(budgetId === "custom" ? "" : "custom")}
              className={
                "h-[38px] rounded-full border px-4 text-[13px] font-bold " +
                (budgetId === "custom"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground/80 hover:bg-muted")
              }
            >
              Enter an amount
            </button>
            <button
              type="button"
              onClick={() => setBudgetId("")}
              className={
                "h-[38px] rounded-full border px-4 text-[13px] font-bold " +
                (budgetId === ""
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground/80 hover:bg-muted")
              }
            >
              Not sure
            </button>
          </div>
          {budgetId === "custom" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                inputMode="numeric"
                value={customMin}
                onChange={(event) => setCustomMin(event.target.value)}
                placeholder="At least"
                aria-label="Lowest amount"
                className={inputClass + " max-w-[160px]"}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                inputMode="numeric"
                value={customMax}
                onChange={(event) => setCustomMax(event.target.value)}
                placeholder="At most"
                aria-label="Highest amount"
                className={inputClass + " max-w-[160px]"}
              />
            </div>
          )}
          <span className="mt-2 block text-[11.5px] text-muted-foreground">
            This is a guide for professionals, not a commitment. Pros pay nothing per lead, so a
            budget just helps them quote the right job.
          </span>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-foreground/70">Your name</span>
          <input
            name="customer_name"
            required
            value={prefill.name}
            onChange={(event) => setPrefill((p) => ({ ...p, name: event.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-foreground/70">Email</span>
          <input
            name="customer_email"
            type="email"
            required
            value={prefill.email}
            onChange={(event) => setPrefill((p) => ({ ...p, email: event.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-bold text-foreground/70">Phone</span>
          <input
            name="customer_phone"
            type="tel"
            value={prefill.phone}
            onChange={(event) => setPrefill((p) => ({ ...p, phone: event.target.value }))}
            className={inputClass}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-[#FDECEA] px-4 py-3 text-sm text-[#D93025]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 h-[50px] w-full rounded-md bg-accent font-display text-base font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
      >
        {status === "submitting"
          ? "Sending…"
          : user
            ? "Send Request"
            : "Sign up to send your request"}
      </button>
      {!user ? (
        <div
          ref={accountPromptRef}
          className={`mt-3 rounded-lg border px-4 py-3 text-center text-[13px] leading-relaxed ${
            needsAccount ? "border-accent bg-accent/10 text-foreground" : "border-border bg-muted/40 text-muted-foreground"
          }`}
        >
          <p className="font-semibold text-foreground">
            An account keeps your request, photos and quotes in one place.
          </p>
          <p className="mt-0.5">It also keeps your phone and address private until you accept a price.</p>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link href="/register" className="font-bold text-primary hover:underline">
              Create a free account
            </Link>
            <Link href="/login" className="font-bold text-primary hover:underline">
              Already have one? Log in
            </Link>
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        No obligation. Pros pay a flat monthly subscription, never per lead — quoting is always free
        for you.
      </p>
    </form>
  );
}

export function RequestQuotePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-12">
        <RequestQuoteForm />
      </main>
      <SiteFooter />
    </div>
  );
}
