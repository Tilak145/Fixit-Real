"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LayoutGrid, Menu, User, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Organization, OrganizationKind } from "@/lib/manage-model";
import { createOrganization, getMyOrganization } from "@/components/manage/data";
import { Overview } from "@/components/manage/overview";
import { Properties } from "@/components/manage/properties";
import { Repairs } from "@/components/manage/repairs";
import { NotificationBell } from "@/components/fixit/notification-bell";
import { Card, ErrorState, field, Loading, primaryButton } from "@/components/manage/ui";

// Only screens that work are in the menu. Later phases add theirs when built.
const NAV = [
  { view: "overview", label: "Overview", icon: LayoutGrid },
  { view: "properties", label: "Properties", icon: Building2 },
  { view: "repairs", label: "Maintenance", icon: Wrench },
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
          <Link href="/register?next=/manage" className="text-center text-[14px] font-bold text-[#1457C0] hover:underline">
            Create a free account
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
      {/* Shrinks to fit a narrower window, so it keeps the same layout as the full-size design. */}
      <div className="lg:[zoom:0.65] min-[1280px]:[zoom:0.78] min-[1440px]:[zoom:0.88] min-[1640px]:[zoom:1]">
      <header className="flex items-center justify-between gap-3 bg-[#0F2447] px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="lg:hidden">
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <Logo />
        </div>
        <div className="flex min-w-0 items-center gap-2 text-[14px] sm:gap-4">
          <NotificationBell customer home="/manage?view=repairs" />
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white text-[#0F2447]">
            <User className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="hidden truncate font-semibold sm:inline">{organization.name}</span>
          <button type="button" onClick={onSignOut} className="flex-none text-white/80 hover:text-white">Sign out</button>
        </div>
      </header>
      <div className="lg:flex">
        <aside className={`${menuOpen ? "block" : "hidden"} bg-[#0F2447] px-3 py-4 text-white lg:block lg:min-h-[calc(154vh-72px)] lg:w-[250px] lg:flex-none min-[1280px]:min-h-[calc(128vh-72px)] min-[1440px]:min-h-[calc(114vh-72px)] min-[1640px]:min-h-[calc(100vh-72px)]`}>
          <p className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[15px] font-semibold">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            {organization.kind === "company" ? "Property Manager" : "Landlord"}
          </p>
          <p className="mb-2 mt-5 px-3 text-[12px] font-semibold tracking-wide text-white/60">WORKSPACE</p>
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
                : "FixIt has not approved sending jobs from this account. Contact FixIt support."}
            </p>
          ) : null}
          {view === "properties" ? <Properties organization={organization} /> : null}
          {view === "repairs" ? <Repairs organization={organization} /> : null}
          {view === "overview" ? <Overview organization={organization} /> : null}
        </main>
      </div>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" aria-label="FixIt home" className="flex items-center gap-2.5">
      <svg width="42" height="36" viewBox="0 0 46 40" aria-hidden="true">
        <path d="M23 1 1 20h6v19h32V20h6z" fill="#F26B1D" />
        <path d="M17 22h5v5h-5zm7 0h5v5h-5zm-7 7h5v5h-5zm7 0h5v5h-5z" fill="#fff" />
      </svg>
      <span className="leading-none">
        <span className="block font-display text-[25px] font-bold text-white">
          Fix<span className="text-[#F26B1D]">It</span>
        </span>
        <span className="block text-[10px] font-bold tracking-[0.14em] text-white">LOCAL SERVICES</span>
      </span>
    </Link>
  );
}
