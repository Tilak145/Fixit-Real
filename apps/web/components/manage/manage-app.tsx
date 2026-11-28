"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, DoorOpen, DollarSign, FileClock, LayoutGrid, Menu, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { repairFigures, type Organization, type OrganizationKind } from "@/lib/manage-model";
import { createOrganization, getMyOrganization, listProperties, listRepairSummaries, listUnits } from "@/components/manage/data";
import { Properties } from "@/components/manage/properties";
import { Card, ErrorState, field, Loading, primaryButton } from "@/components/manage/ui";

// Only screens that work are in the menu. Later phases add theirs when built.
const NAV = [
  { view: "overview", label: "Overview", icon: LayoutGrid },
  { view: "properties", label: "Properties", icon: Building2 },
];

/** The landlord and property manager dashboard at /manage. */
export function ManageApp() {
  const { status, user, signOut } = useAuth();
  const organization = useQuery({
    queryKey: ["manage", "organization", user?.id],
    enabled: status === "authenticated" && !!user,
    queryFn: () => getMyOrganization(user!.id),
  });

  if (status === "loading") return <Loading label="Loading…" />;
  if (status !== "authenticated" || !user) return <SignedOut />;
  if (organization.isPending) return <Loading label="Loading your account…" />;
  if (organization.isError) {
    return (
      <div className="mx-auto max-w-[520px] p-6">
        <ErrorState message={(organization.error as Error).message} onRetry={() => organization.refetch()} />
      </div>
    );
  }
  if (!organization.data) return <Setup />;
  return <Dashboard organization={organization.data} onSignOut={() => void signOut()} />;
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F3F6FB] px-4 py-12 text-[#0B1B33]">
      <div className="mx-auto max-w-[520px]">
        <Link href="/" className="mb-5 block text-center font-display text-[28px] font-bold">
          Fix<span className="text-[#D9560B]">It</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <Page>
      <Card title="For landlords and property managers">
        <p className="mb-4 text-[14px] leading-relaxed text-[#475569]">
          Keep your properties and units in one place and get prices from local professionals. Free, with no limit on properties.
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/login?next=/manage" className={primaryButton}>Log in</Link>
          <Link href="/register" className="text-center text-[14px] font-bold text-[#1457C0] hover:underline">
            Create a free account first, then come back here
          </Link>
        </div>
      </Card>
    </Page>
  );
}

/** One question set after signing in: who are you managing property as? */
function Setup() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<OrganizationKind>("landlord");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const create = useMutation({
    mutationFn: () => createOrganization({ kind, name, phone }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["manage"] }),
  });
  const choices: Array<{ value: OrganizationKind; title: string; body: string }> = [
    { value: "landlord", title: "Landlord", body: "I own the property I look after. Ready to use at once." },
    { value: "company", title: "Property Manager", body: "A company managing property. FixIt checks it before jobs reach pros." },
  ];
  return (
    <Page>
      <Card title="Set up your property account">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[13px] font-bold">I am a</legend>
            {choices.map((choice) => (
              <label key={choice.value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${kind === choice.value ? "border-[#D9560B] bg-[#FFF5EE]" : "border-[#D8DFEA]"}`}>
                <input type="radio" name="kind" checked={kind === choice.value} onChange={() => setKind(choice.value)} />
                <span>
                  <strong className="block text-[14.5px]">{choice.title}</strong>
                  <span className="block text-[13px] text-[#475569]">{choice.body}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <label className="block text-[13px] font-bold">
            {kind === "company" ? "Company name" : "Your name"}
            <input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className="block text-[13px] font-bold">
            Phone
            <input type="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
          </label>
          {create.isError ? <p role="alert" className="text-[13.5px] text-[#B42318]">{(create.error as Error).message}</p> : null}
          <button type="submit" disabled={create.isPending} className={primaryButton}>
            {create.isPending ? "Creating…" : "Create my property account"}
          </button>
        </form>
      </Card>
    </Page>
  );
}

function Dashboard({ organization, onSignOut }: { organization: Organization; onSignOut: () => void }) {
  const asked = useSearchParams().get("view");
  const view = NAV.some((item) => item.view === asked) ? asked! : "overview";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F3F6FB] text-[#0B1B33]">
      <header className="flex items-center justify-between gap-3 bg-[#0F2447] px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="lg:hidden">
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <Link href="/" className="font-display text-[22px] font-bold">
            Fix<span className="text-[#F26B1D]">It</span>
          </Link>
        </div>
        <div className="flex min-w-0 items-center gap-4 text-[14px]">
          <span className="truncate font-semibold">{organization.name}</span>
          <button type="button" onClick={onSignOut} className="flex-none text-white/80 hover:text-white">Sign out</button>
        </div>
      </header>
      <div className="lg:flex">
        <aside className={`${menuOpen ? "block" : "hidden"} bg-[#0F2447] px-3 py-4 text-white lg:block lg:min-h-[calc(100vh-56px)] lg:w-[230px] lg:flex-none`}>
          <p className="mb-2 px-3 text-[11.5px] font-bold uppercase tracking-wide text-white/60">
            {organization.kind === "company" ? "Property Manager" : "Landlord"}
          </p>
          <nav className="space-y-1">
            {NAV.map(({ view: target, label, icon: Icon }) => (
              <Link
                key={target}
                href={target === "overview" ? "/manage" : `/manage?view=${target}`}
                aria-current={view === target ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14.5px] ${view === target ? "bg-[#D9560B] font-bold" : "hover:bg-white/10"}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          {organization.status !== "approved" ? (
            <p role="status" className="mb-4 rounded-xl border border-[#F0DCB6] bg-[#FFF7EC] px-4 py-3 text-[13.5px] font-bold text-[#8A4B00]">
              {organization.status === "pending"
                ? "FixIt is reviewing your company. You can add properties now."
                : "Your company was not approved. Contact FixIt support."}
            </p>
          ) : null}
          {view === "properties" ? <Properties organization={organization} /> : <Overview organization={organization} />}
        </main>
      </div>
    </div>
  );
}

/** Every number here is counted from this organization's own records. */
function Overview({ organization }: { organization: Organization }) {
  const figures = useQuery({
    queryKey: ["manage", "overview", organization.id],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [properties, units, repairs] = await Promise.all([
        listProperties(organization.id),
        listUnits(organization.id),
        listRepairSummaries(organization.id),
      ]);
      const active = new Set(properties.filter((p) => !p.archived_at).map((p) => p.id));
      return {
        properties: active.size,
        units: units.filter((unit) => !unit.archived_at && active.has(unit.property_id)).length,
        ...repairFigures(repairs),
      };
    },
  });
  if (figures.isPending) return <Loading label="Counting your records…" />;
  if (figures.isError) return <ErrorState message={(figures.error as Error).message} onRetry={() => figures.refetch()} />;
  const data = figures.data;
  const cards = [
    { label: "Properties", value: String(data.properties), icon: Building2, tone: "bg-[#E3EEFD] text-[#1457C0]" },
    { label: "Rental units", value: String(data.units), icon: DoorOpen, tone: "bg-[#FFF0E3] text-[#B4470A]" },
    { label: "Open repairs", value: String(data.open), icon: Wrench, tone: "bg-[#FFF0E3] text-[#B4470A]" },
    { label: "Urgent repairs", value: String(data.urgent), icon: AlertTriangle, tone: "bg-[#FDE7E7] text-[#B42318]" },
    { label: "Prices waiting", value: String(data.waitingForAnswer), icon: FileClock, tone: "bg-[#EEE8FB] text-[#5B3FB0]" },
    { label: "Accepted this month", value: `$${(data.spentThisMonthCents / 100).toLocaleString("en-US")}`, icon: DollarSign, tone: "bg-[#DCF3E2] text-[#136C34]" },
  ];
  return (
    <>
      <h1 className="font-display text-[28px] font-bold">Overview</h1>
      <p className="mb-5 text-[14px] text-[#475569]">{organization.name}</p>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#E4E9F1] bg-white p-4 shadow-sm">
            <span className={`grid h-12 w-12 flex-none place-items-center rounded-full ${tone}`}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] text-[#334155]">{label}</span>
              <strong className="block truncate font-display text-[26px] leading-tight">{value}</strong>
            </span>
          </div>
        ))}
      </div>
      {data.properties === 0 ? (
        <p className="mt-5 text-[14px] text-[#475569]">
          Start by <Link href="/manage?view=properties" className="font-bold text-[#1457C0] hover:underline">adding your first property</Link>.
        </p>
      ) : null}
    </>
  );
}
