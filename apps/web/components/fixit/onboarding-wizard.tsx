"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { currentPrice } from "@/lib/payments-price";
import { listPaymentProducts, type PaymentProduct } from "@/lib/payments";
import { CheckoutButton } from "@/components/payments";
import { useAuth } from "@/lib/auth-context";
import { requireSupabase, getSupabase } from "@/lib/supabase";
import {
  documentSignedUrl,
  listMyDocuments,
  uploadProviderDocument,
  uploadProviderLogo,
  type ProviderDocument,
  type ProviderDocumentKind,
} from "@/lib/fixit";
import { FixItLogo } from "@/components/fixit/logo";
import { useCities } from "@/components/fixit/city-select";
import { AddressInput } from "@/components/fixit/address-input";
import { PAID_PLANS } from "@/features/plans";
import { CommissionTerms } from "@/components/fixit/commission-section";

const CATEGORIES = [
  { slug: "plumbing", name: "Plumbing", emoji: "🔧" },
  { slug: "electrical", name: "Electrical", emoji: "⚡" },
  { slug: "hvac", name: "HVAC", emoji: "🌀" },
  { slug: "garage-doors", name: "Garage Doors", emoji: "🏠" },
  { slug: "roofing", name: "Roofing", emoji: "🏘️" },
  { slug: "appliance-repair", name: "Appliance Repair", emoji: "🧺" },
  { slug: "handyman", name: "Handyman", emoji: "🔨" },
  { slug: "cleaning", name: "Cleaning", emoji: "🧴" },
  { slug: "pest-control", name: "Pest Control", emoji: "🐛" },
  { slug: "landscaping", name: "Landscaping", emoji: "🌿" },
  { slug: "painting", name: "Painting", emoji: "🎨" },
  { slug: "other", name: "Other", emoji: "•••" },
];

const STEP_LABELS = ["Your business", "Services & area", "Verify & plan"];
const STEPS = 3;
const inputClass =
  "h-[42px] w-full rounded-md border border-input bg-input px-3 text-sm outline-none ring-ring focus:ring-2";

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-start px-6">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const on = n <= step;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : on ? "bg-primary" : "bg-border"}`} />
              <span
                className={`flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-sm font-bold ${
                  on ? "bg-primary text-primary-foreground" : "border-2 border-border bg-card text-muted-foreground"
                }`}
              >
                {n}
              </span>
              <div
                className={`h-0.5 flex-1 ${i === STEPS - 1 ? "opacity-0" : n < step ? "bg-primary" : "bg-border"}`}
              />
            </div>
            <span className={`mt-1.5 text-[11px] font-bold ${on ? "text-primary" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface WizardData {
  accountType: "provider" | "homeowner";
  businessName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  services: string[];
  cities: string[];
  description: string;
  years: string;
  employees: string;
  plan: string;
  licenseNumber: string;
  licenseState: string;
  /** The Ohio business registration number, checked against the SoS register. */
  businessRegistration: string;
  logoUrl: string;
  /** The picked shop address's point, for emergency dispatch. Not editable. */
  shopPoint?: { lat: number | null; lng: number | null };
}

export function OnboardingWizard() {
  const { user, status } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [data, setData] = useState<WizardData>({
    accountType: "provider",
    businessName: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    services: ["plumbing"],
    cities: ["Akron, OH"],
    description: "",
    years: "5+ years",
    employees: "2-5",
    plan: "professional",
    licenseNumber: "",
    licenseState: "OH",
    businessRegistration: "",
    logoUrl: "",
  });

  const [cityInput, setCityInput] = useState("");
  const set = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));
  // The cities the owner has added, offered in place of free-text entry.
  const { cities } = useCities();

  // The two documents the wizard has always shown a button for. Held here so
  // the slot shows the file name and a link once it is stored.
  const [documents, setDocuments] = useState<Record<ProviderDocumentKind, ProviderDocument | null>>({
    photo_id: null,
    insurance: null,
  });
  const [uploading, setUploading] = useState<ProviderDocumentKind | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const payments = useQuery({
    queryKey: ["payment-products"],
    queryFn: listPaymentProducts,
    retry: false,
    staleTime: 60_000,
  });

  // How many free Founding Pro places are left. Read straight from the
  // database, which also enforces the cap, so the number shown cannot be
  // talked into a place that no longer exists.
  const founding = useQuery({
    queryKey: ["founding-slots"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc("founding_slots_left");
      if (error) throw new Error(error.message);
      return typeof data === "number" ? data : null;
    },
  });

  const planPrices: Record<string, string | undefined> = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const p of payments.data ?? []) {
      const price = currentPrice(p.prices);
      const key = price?.entitlementKey ?? "";
      const plan = key.replace(/_.*/, "");
      if (price) map[plan] = price.id;
    }
    return map;
  }, [payments.data]);

  useEffect(() => {
    if (!user) return;
    // What the sign-up form already asked for is filled in here, so nobody
    // types their business name and phone a second time.
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const phone = typeof meta.phone === "string" ? meta.phone : "";
    let business = "";
    try {
      business = window.sessionStorage.getItem("fixit.pro.businessName") ?? "";
    } catch {
      business = "";
    }
    setData((d) => ({
      ...d,
      email: d.email || user.email || "",
      phone: d.phone || phone,
      businessName: d.businessName || business,
    }));
  }, [user, set]);

  // Show any document already on file, so returning to onboarding does not ask
  // for it twice.
  useEffect(() => {
    if (!user) return;
    let active = true;
    listMyDocuments()
      .then((saved) => {
        if (active) setDocuments(saved);
      })
      .catch(() => {
        /* A missing document is the normal first-time state. */
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function handleDocument(kind: ProviderDocumentKind, file: File) {
    setDocError(null);
    setUploading(kind);
    try {
      const saved = await uploadProviderDocument(kind, file);
      setDocuments((d) => ({ ...d, [kind]: saved }));
      setError(null);
    } catch (e) {
      setDocError(e instanceof Error ? e.message : "The upload failed. Please try again.");
    } finally {
      setUploading(null);
    }
  }

  async function handleLogo(file: File) {
    setLogoError(null);
    setLogoUploading(true);
    try {
      const url = await uploadProviderLogo(file);
      set({ logoUrl: url });
    } catch (e) {
      setLogoError(e instanceof Error ? e.message : "The logo upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveProvider(chosenPlan: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Data services are not connected yet, so your profile cannot be saved.");
      return false;
    }
    if (!user) {
      setError("Please create your provider account first.");
      return false;
    }
    setSaving(true);
    setError(null);
    const { data: existing } = await supabase
      .from("providers")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    const values = {
      auth_user_id: user.id,
      business_name: data.businessName,
      email: data.email || user.email,
      phone: data.phone,
      website: data.website || null,
      address: data.address,
      description: data.description,
      years_in_business: data.years,
      employees: data.employees,
      status: "pending" as const,
      plan: chosenPlan,
      license_number: data.licenseNumber.trim() || null,
      business_registration_number: data.businessRegistration.trim() || null,
      logo_url: data.logoUrl || null,
      // Where the shop is, from the address the pro picked. A saved address is
      // re-geocoded only when the pro picks a new one.
      ...(data.shopPoint && data.shopPoint.lat !== null && data.shopPoint.lng !== null
        ? { lat: data.shopPoint.lat, lng: data.shopPoint.lng, located_at: new Date().toISOString() }
        : {}),
    };
    let providerId = existing?.id;
    if (providerId) {
      const { error: upErr } = await supabase.from("providers").update(values).eq("id", providerId);
      if (upErr) {
        setError(upErr.message);
        setSaving(false);
        return false;
      }
    } else {
      const { data: inserted, error: inErr } = await supabase
        .from("providers")
        .insert(values)
        .select("id")
        .single();
      if (inErr || !inserted) {
        setError(inErr?.message ?? "Could not create your provider profile.");
        setSaving(false);
        return false;
      }
      providerId = inserted.id;
    }
    await supabase.from("provider_services").delete().eq("provider_id", providerId);
    if (data.services.length > 0) {
      await supabase
        .from("provider_services")
        .insert(data.services.map((s) => ({ provider_id: providerId, category_slug: s })));
    }
    await supabase.from("provider_service_areas").delete().eq("provider_id", providerId);
    if (data.cities.length > 0) {
      await supabase
        .from("provider_service_areas")
        .insert(data.cities.map((c) => ({ provider_id: providerId, city: c })));
    }
    setSaving(false);
    return true;
  }

  const foundingSlots = founding.data ?? null;

  function next() {
    setError(null);
    setStep((s) => Math.min(STEPS, s + 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }

  if (status === "loading") {
    return <div className="p-16 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-[480px] rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="mb-2 font-display text-xl font-semibold">Create your provider account first</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          The onboarding wizard saves your business profile, so you need a FixIt provider account.
        </p>
        <Link
          href="/for-businesses"
          className="rounded-md bg-accent px-6 py-3 text-sm font-bold text-accent-foreground hover:bg-accent/90"
        >
          Sign Up as a Provider
        </Link>
      </div>
    );
  }
  if (done) {
    return (
      <div className="mx-auto max-w-[640px] text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#2E9E4F]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" aria-hidden="true">
            <path d="m5 13 4 4 10-10" />
          </svg>
        </div>
        <h2 className="mb-2 font-display text-2xl font-semibold">Your Provider Account is Ready!</h2>
        <p className="mx-auto mb-6 max-w-[460px] text-sm leading-relaxed text-muted-foreground">
          Your business profile has been submitted and is now under review. You&apos;ll be notified once it&apos;s
          approved (usually within 24 hours).
        </p>
        <div className="mb-6 rounded-xl bg-[#E9F1FB] p-6 text-left">
          <strong className="mb-3 block font-display text-[15px]">What Happens Next?</strong>
          {[
            "We review your documents",
            "Your profile gets verified",
            "You can start receiving customer leads",
            "Manage your leads from your dashboard",
          ].map((t, i) => (
            <div key={t} className="mb-2.5 flex items-center gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="text-[13.5px]">{t}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => router.push("/pro/dashboard")}
          className="h-[50px] w-full rounded-md bg-primary font-display text-[15px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Go to Provider Dashboard →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[660px] rounded-2xl border border-border bg-card py-6 shadow-sm">
      <div className="flex items-center justify-between px-6">
        <FixItLogo />
        <Link href="/login" className="text-[13px] font-bold text-foreground/70">
          Log In
        </Link>
      </div>
      <div className="mt-4">
        <Stepper step={step} />
      </div>

      <div className="px-10">
        {step === 1 && (
          <>
            <h2 className="text-center font-display text-[22px] font-semibold">Your business</h2>
            <p className="mb-4 text-center text-[13px] text-muted-foreground">
              We started with what you entered. Add your address and logo so customers recognise you.
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              {[
                { value: "provider" as const, emoji: "🏪", label: "I run a business", hint: "Get customer leads" },
                { value: "homeowner" as const, emoji: "🏡", label: "I am a homeowner", hint: "Hire someone" },
              ].map((option) => {
                const on = data.accountType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set({ accountType: option.value })}
                    aria-pressed={on}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left ${
                      on ? "border-2 border-primary bg-[#E9F1FB]" : "border-border bg-card"
                    }`}
                  >
                    <span className="text-xl" aria-hidden="true">{option.emoji}</span>
                    <span>
                      <strong className="block text-[13.5px] text-secondary">{option.label}</strong>
                      <span className="block text-[12px] text-muted-foreground">{option.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <span className="sr-only">Business information</span>
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-[10px] border border-border p-3.5">
              <span className="flex h-[68px] w-[68px] flex-none items-center justify-center overflow-hidden rounded-[10px] border border-border bg-muted">
                {data.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.logoUrl} alt="Your business logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-lg font-bold text-primary/40">
                    {(data.businessName.slice(0, 2) || "LO").toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-[160px] flex-1">
                <strong className="block text-[13px] font-bold">Business logo</strong>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                  {logoUploading
                    ? "Uploading…"
                    : data.logoUrl
                      ? "Shown on your listing and profile."
                      : "Add a square image, PNG or JPG, up to 4 MB."}
                </span>
                {logoError ? <span className="mt-0.5 block text-[12px] text-[#D93025]">{logoError}</span> : null}
              </span>
              <label
                htmlFor="business-logo"
                className="cursor-pointer rounded-md border-[1.5px] border-primary px-3.5 py-2 text-[13px] font-bold text-primary"
              >
                {data.logoUrl ? "Replace logo" : "Upload logo"}
              </label>
              <input
                id="business-logo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleLogo(file);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground/70">Business Name</span>
                <input
                  className={inputClass}
                  value={data.businessName}
                  onChange={(e) => set({ businessName: e.target.value })}
                  placeholder="Smith Plumbing LLC"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground/70">Business Phone</span>
                <input
                  className={inputClass}
                  value={data.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  placeholder="(234) 567-8900"
                />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-bold text-foreground/70">Business Email</span>
              <input className={inputClass} value={data.email} onChange={(e) => set({ email: e.target.value })} />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-bold text-foreground/70">Business Website (Optional)</span>
              <input className={inputClass} value={data.website} onChange={(e) => set({ website: e.target.value })} />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-bold text-foreground/70">Business Address</span>
              <AddressInput
                className={inputClass}
                value={data.address}
                onChange={(value) => set({ address: value })}
                onPick={(suggestion) =>
                  set({
                    address: suggestion.label,
                    // Remember where the shop is, so an emergency can go to the
                    // nearest crew. Coordinates are not part of the form state
                    // the pro edits; they are saved with the profile.
                    shopPoint: { lat: suggestion.lat ?? null, lng: suggestion.lng ?? null },
                  })
                }
                placeholder="Start typing your address, e.g. 123 Main St"
              />
              <span className="mt-1 block text-[11.5px] text-muted-foreground">
                Pick your address from the list so customers see it correctly.
              </span>
            </label>
            <Nav onBack={back} onNext={next} nextDisabled={!data.businessName || !data.address || data.accountType !== "provider"} />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-center font-display text-[22px] font-semibold">Your trade and area</h2>
            <p className="mb-4 text-center text-[13px] text-muted-foreground">
              Pick the work you do and the cities you travel to. These decide which jobs reach you.
            </p>
            <div className="flex flex-wrap gap-3">
              {CATEGORIES.map((c) => {
                const on = data.services.includes(c.slug);
                return (
                  <button
                    type="button"
                    key={c.slug}
                    onClick={() =>
                      set({
                        services: on
                          ? data.services.filter((s) => s !== c.slug)
                          : [...data.services, c.slug],
                      })
                    }
                    className={`relative w-[140px] rounded-[10px] px-2 py-4 text-center ${
                      on ? "border-2 border-primary bg-[#E9F1FB]" : "border border-border bg-card"
                    }`}
                  >
                    {on && (
                      <span className="absolute left-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded bg-primary">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                          <path d="m5 13 4 4 10-10" />
                        </svg>
                      </span>
                    )}
                    <span className="mb-2 block text-2xl" aria-hidden="true">{c.emoji}</span>
                    <span className="text-[13px] font-bold text-foreground/70">{c.name}</span>
                  </button>
                );
              })}
            </div>
            <h3 className="mb-1 mt-6 text-center font-display text-[20px] font-semibold">Service Area</h3>
            <p className="mb-4 text-center text-[13px] text-muted-foreground">
              {cities.length > 0
                ? "Select the cities you want to receive leads from."
                : "Select the areas you want to receive leads from."}
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {data.cities.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => set({ cities: data.cities.filter((x) => x !== c) })}
                  className="rounded-full border border-[#B9CDE5] bg-[#E9F1FB] px-3.5 py-1.5 text-[12.5px] font-bold text-primary"
                >
                  {c} ×
                </button>
              ))}
            </div>
            {/* The owner's city list is the authority once it has one, so a pro
                picks the same spelling a customer's request will carry. Free
                text stays for the moment the list is empty or offline. */}
            {cities.length > 0 ? (
              <select
                className={inputClass}
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && !data.cities.includes(v)) set({ cities: [...data.cities, v] });
                }}
              >
                <option value="">Add a city you serve…</option>
                {cities
                  .filter((city) => city.is_active && !data.cities.includes(city.label))
                  .map((city) => (
                    <option key={city.label} value={city.label}>
                      {city.label}
                    </option>
                  ))}
              </select>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = cityInput.trim();
                  if (v && !data.cities.includes(v)) set({ cities: [...data.cities, v] });
                  setCityInput("");
                }}
              >
                <input
                  className={inputClass}
                  placeholder="Search and add cities…"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                />
              </form>
            )}
            <Nav onBack={back} onNext={next} nextDisabled={data.services.length === 0 || data.cities.length === 0} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-center font-display text-[22px] font-semibold">Verification and plan</h2>
            <p className="mb-4 text-center text-[13px] text-muted-foreground">
              We check these with your application, usually within 24 hours. Nothing is charged today.
            </p>
            <div className="mb-3 rounded-[10px] border border-border p-3.5">
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-foreground/70">Licence Number (Required)</span>
                  <input
                    className={inputClass}
                    value={data.licenseNumber}
                    onChange={(e) => set({ licenseNumber: e.target.value })}
                    placeholder="e.g. PL.12345"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-foreground/70">State</span>
                  <input
                    className={inputClass}
                    maxLength={2}
                    value={data.licenseState}
                    onChange={(e) => set({ licenseState: e.target.value.toUpperCase() })}
                    placeholder="OH"
                  />
                </label>
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                We check this number when your application is reviewed. Enter it exactly as it appears on your licence.
              </p>
            </div>
            <div className="mb-3 rounded-[10px] border border-border p-3.5">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground/70">
                  Ohio Business Registration Number (Optional)
                </span>
                <input
                  className={inputClass}
                  value={data.businessRegistration}
                  onChange={(e) => set({ businessRegistration: e.target.value })}
                  placeholder="e.g. 1234567"
                />
              </label>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Your business&apos;s registration number from the Ohio Secretary of State. We look it up on{" "}
                <a
                  href="https://businesssearch.ohiosos.gov/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-primary hover:underline"
                >
                  businesssearch.ohiosos.gov
                </a>{" "}
                when your application is reviewed, so we can confirm the business is registered in Ohio.
              </p>
            </div>
            <DocumentSlot
              kind="photo_id"
              label="Photo ID (Required)"
              document={documents.photo_id}
              uploading={uploading === "photo_id"}
              onPick={handleDocument}
              onView={documentSignedUrl}
            />
            <DocumentSlot
              kind="insurance"
              label="Insurance Certificate (Optional)"
              document={documents.insurance}
              uploading={uploading === "insurance"}
              onPick={handleDocument}
              onView={documentSignedUrl}
            />
            {docError && (
              <p role="alert" className="mb-3 rounded-md bg-[#FDECEA] px-4 py-3 text-sm text-[#D93025]">
                {docError}
              </p>
            )}
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-bold text-foreground/70">
                Business Description <span className="font-normal text-muted-foreground">{data.description.length}/500</span>
              </span>
              <textarea
                rows={4}
                maxLength={500}
                className="w-full rounded-md border border-input bg-input px-3 py-2.5 text-[13px] outline-none ring-ring focus:ring-2"
                value={data.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="We provide professional services in your area. Licensed, insured, and committed to quality work."
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground/70">Years in Business</span>
                <select className={inputClass} value={data.years} onChange={(e) => set({ years: e.target.value })}>
                  <option>1-2 years</option>
                  <option>2-5 years</option>
                  <option>5+ years</option>
                  <option>10+ years</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-foreground/70">Number of Employees</span>
                <select className={inputClass} value={data.employees} onChange={(e) => set({ employees: e.target.value })}>
                  <option>1</option>
                  <option>2-5</option>
                  <option>6-10</option>
                  <option>10+</option>
                </select>
              </label>
            </div>
            <h3 className="mb-1 mt-6 font-display text-[18px] font-semibold">Choose your plan</h3>
            <p className="mb-3 text-[12.5px] text-muted-foreground">
              Unlimited lead access in your area, plus the placement and tools to win the work.
            </p>
            <CommissionTerms className="mb-5 rounded-lg bg-[#F7F9FC] p-3.5" />
            {foundingSlots !== null && foundingSlots > 0 ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#F57C00] bg-[#FFF7EC] p-4">
                <div className="min-w-0">
                  <span className="flex items-center gap-2 font-display text-base font-semibold">
                    <Crown className="h-4 w-4 text-[#B35C00]" aria-hidden="true" />
                    Founding Pro — free
                    <span className="rounded-full bg-[#F57C00] px-2 py-0.5 text-[11px] font-bold text-white">
                      {foundingSlots} left
                    </span>
                  </span>
                  <p className="mt-1 text-[12.5px] text-foreground/70">
                    Your first three months are free. Pick the plan you want on the paid cards below, and
                    we ask you to start paying when the three months are up. Cancel anytime.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => set({ plan: "founding" })}
                  className={`h-[42px] flex-none rounded-md px-5 text-sm font-bold ${
                    data.plan === "founding"
                      ? "bg-accent text-accent-foreground"
                      : "border-2 border-[#F57C00] text-[#B35C00]"
                  }`}
                >
                  {data.plan === "founding" ? "Selected" : "Claim a free place"}
                </button>
              </div>
            ) : null}
            <div className="grid gap-3.5 sm:grid-cols-3">
              {PAID_PLANS.map((p) => {
                const on = data.plan === p.key;
                const priceId = planPrices[p.key];
                return (
                  // The card is a container, not one big button: the chosen plan
                  // shows a checkout button, and a button may not be nested
                  // inside another button. Choosing the plan is its own real
                  // button, and the checkout control is a sibling below it.
                  <div
                    key={p.key}
                    className={`relative rounded-xl p-4 text-left ${
                      on ? "border-2 border-accent" : "border border-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => set({ plan: p.key })}
                      aria-pressed={on}
                      className="block w-full cursor-pointer text-left"
                    >
                      {p.recommended ? (
                        <span className="mb-2 inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                          Most popular
                        </span>
                      ) : null}
                      <span className="mb-1.5 block font-display text-base font-semibold">{p.label}</span>
                      <span className="mb-1 block">
                        <span className="font-display text-3xl font-bold">${p.price}</span>
                        <span className="text-xs text-muted-foreground"> /month</span>
                      </span>
                      <span className="mb-3 block text-[12px] text-muted-foreground">{p.tagline}</span>
                    </button>
                    <ul className="mb-4 space-y-1.5">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-2 text-[12.5px] text-foreground/70">
                          <span className="text-[#2E9E4F]" aria-hidden="true">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {on &&
                      (priceId ? (
                        <CheckoutButton
                          priceId={priceId}
                          successPath="/pro/dashboard?upgraded=1"
                          cancelPath="/pro/onboarding"
                          className="h-[42px] w-full rounded-md bg-accent text-sm font-bold text-accent-foreground hover:bg-accent/90"
                        >
                          Select Plan
                        </CheckoutButton>
                      ) : (
                        <span className="block rounded-md bg-muted px-3 py-2 text-center text-[11px] text-muted-foreground">
                          Billing activates once payments are connected
                        </span>
                      ))}
                  </div>
                );
              })}
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-md bg-[#FDECEA] px-4 py-3 text-sm text-[#D93025]">
                {error}
              </p>
            )}
            <p className="mt-3 text-[12.5px] text-[#B3261E]">
              {data.licenseNumber.trim().length < 4 || !documents.photo_id
                ? "Add your licence number and a photo ID above to finish."
                : ""}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <button type="button" onClick={back} className="text-sm font-bold text-foreground/70">
                ← Back
              </button>
              <button
                type="button"
                disabled={saving || data.licenseNumber.trim().length < 4 || !documents.photo_id}
                onClick={async () => {
                  const ok = await saveProvider(data.plan);
                  if (ok) setDone(true);
                }}
                className="h-[50px] flex-1 rounded-md bg-accent font-display text-base font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
              >
                {saving ? "Submitting…" : "Complete Sign Up →"}
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              No long contract — cancel anytime from your dashboard. Your profile goes into review immediately.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * One document slot in the verification step. The visible control is a label for
 * a real file input, so clicking it opens the picker; once a file is stored the
 * slot shows its name and a link to open it.
 */
function DocumentSlot({
  kind,
  label,
  document,
  uploading,
  onPick,
  onView,
}: {
  kind: ProviderDocumentKind;
  label: string;
  document: ProviderDocument | null;
  uploading: boolean;
  onPick: (kind: ProviderDocumentKind, file: File) => void;
  onView: (path: string) => Promise<string | null>;
}) {
  const inputId = `document-${kind}`;
  const [viewError, setViewError] = useState(false);
  const [opening, setOpening] = useState(false);

  async function open() {
    if (!document) return;
    setViewError(false);
    setOpening(true);
    const url = await onView(document.storage_path);
    setOpening(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setViewError(true);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3.5 rounded-[10px] border border-border p-3.5">
      <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[10px] bg-primary text-white">
        📄
      </span>
      <span className="min-w-[160px] flex-1 text-[13px] font-semibold">
        {label}
        {document ? (
          <span className="mt-0.5 block truncate text-[12px] font-normal text-[#2E9E4F]">
            ✓ {document.file_name}
          </span>
        ) : uploading ? (
          <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">Uploading…</span>
        ) : null}
        {viewError ? (
          <span className="mt-0.5 block text-[12px] font-normal text-[#D93025]">
            Could not open the file. Please try again.
          </span>
        ) : null}
      </span>
      {document ? (
        <button
          type="button"
          onClick={() => void open()}
          disabled={opening}
          className="rounded-md border-[1.5px] border-primary px-3.5 py-2 text-[13px] font-bold text-primary disabled:opacity-60"
        >
          {opening ? "Opening…" : "View"}
        </button>
      ) : null}
      <label
        htmlFor={inputId}
        className="cursor-pointer rounded-md border-[1.5px] border-primary px-3.5 py-2 text-[13px] font-bold text-primary"
      >
        {document ? "Replace" : "Upload"}
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(kind, file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center gap-4">
      <button type="button" onClick={onBack} className="text-sm font-bold text-foreground/70">
        ← Back
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="h-[50px] flex-1 rounded-md bg-accent font-display text-base font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
      >
        Continue →
      </button>
    </div>
  );
}

export async function ensureProviderTableReady() {
  requireSupabase();
}
