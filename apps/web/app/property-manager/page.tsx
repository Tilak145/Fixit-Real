import Link from "next/link";
import { notFound } from "next/navigation";
import { Properties } from "./properties";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowRight,
  DoorOpen,
  FileText,
  HardHat,
  Home,
  KeyRound,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Plug,
  Plus,
  Settings,
  Thermometer,
  User,
  Users,
  Wrench,
} from "lucide-react";

/**
 * DESIGN PREVIEW of the property manager dashboard. Every name and number here
 * is sample data and no button does anything yet. It exists only on a developer's
 * computer: the live site answers "page not found" until it is built for real.
 */
export const metadata = {
  title: "Property Manager (design preview) — FixIt",
  robots: { index: false, follow: false },
};

const NAV = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Properties", icon: Building2 },
  { label: "Maintenance", icon: Wrench },
  { label: "Tenants", icon: Users },
  { label: "Contractors", icon: HardHat },
  { label: "Schedule", icon: CalendarDays },
  { label: "Invoices", icon: FileText },
  { label: "Reports", icon: BarChart3 },
  { label: "Messages", icon: MessageSquare, badge: 3 },
  { label: "Settings", icon: Settings },
];

const STATS = [
  { label: "Properties", value: 12, icon: Building2, tone: "bg-[#E3EEFD] text-[#1D6FE0]" },
  { label: "Rental Units", value: 48, icon: Home, tone: "bg-[#FFF0E3] text-[#F26B1D]" },
  { label: "Open Requests", value: 8, icon: Wrench, tone: "bg-[#FFF0E3] text-[#F26B1D]" },
  { label: "Urgent Repairs", value: 2, icon: AlertTriangle, tone: "bg-[#FDE7E7] text-[#D92D20]" },
];

const SPENDING = [
  { month: "Jun", amount: 1150 },
  { month: "Jul", amount: 2000 },
  { month: "Aug", amount: 1780 },
  { month: "Sep", amount: 2790 },
  { month: "Oct", amount: 2230 },
  { month: "Nov", amount: 2450 },
];
const AXIS_MAX = 4000;
const TICKS = [4000, 3000, 2000, 1000, 0];

const STATUS_TONE: Record<string, string> = {
  Urgent: "bg-[#FDE2E2] text-[#B42318]",
  "In Progress": "bg-[#FFEFCF] text-[#8A4B00]",
  Scheduled: "bg-[#DDEBFE] text-[#1457C0]",
  Completed: "bg-[#DCF3E2] text-[#136C34]",
};

const REQUESTS = [
  { title: "Leaking kitchen pipe", where: "Oak St. Residence • Unit 2", status: "Urgent", when: "Just now", icon: Wrench },
  { title: "Heating system repair", where: "Maple Apartments • Unit 1", status: "In Progress", when: "2 hours ago", icon: Thermometer },
  { title: "Bathroom electrical issue", where: "Westside Commons • Unit 3", status: "Scheduled", when: "Today, 10:00 AM", icon: Plug },
  { title: "Door lock replacement", where: "Oak St. Residence • Unit 2", status: "Completed", when: "Yesterday", icon: KeyRound },
];

const PROPERTIES = [
  { name: "Oak St. Residence", city: "Akron, OH", kind: "Single-family home", open: 2, icon: Home, art: "from-[#BFE0F7] to-[#9CCB8B]" },
  { name: "Maple Apartments", city: "Akron, OH", kind: "24 rental units", open: 5, icon: Building2, art: "from-[#CFE3F5] to-[#D8A07F]" },
];

// The ring shows the 8 open requests; completed ones are listed beside it.
const OPEN_PARTS = [
  { label: "Urgent", count: 2, colour: "#E5484D" },
  { label: "In Progress", count: 3, colour: "#F59E0B" },
  { label: "Scheduled", count: 2, colour: "#2F80ED" },
];
const COMPLETED = { label: "Completed", count: 11, colour: "#2FA84F" };

// Prices the manager has not answered yet, urgent first. Sample figures only.
const APPROVALS = [
  { job: "Water heater replacement", property: "Maple Apartments", unit: "Unit 8", pro: "Sample Plumbing", price: 1250, start: "Can start tomorrow", urgent: true, parts: "Labour $450 • Materials $800", warranty: "1-year warranty", sent: "Sent 1 hour ago" },
  { job: "Roof leak repair", property: "Oak St. Residence", unit: "Unit 1", pro: "Sample Roofing Co.", price: 480, start: "Can start Friday", urgent: false, parts: "Labour $320 • Materials $160", warranty: "90-day warranty", sent: "Sent today" },
  { job: "Dishwasher not draining", property: "Westside Commons", unit: "Unit 5", pro: "Sample Appliance Repair", price: 165, start: "Can start next week", urgent: false, parts: "Labour $90 • Service call $75", warranty: "30-day warranty", sent: "Sent yesterday" },
];

// Who is arriving where today, earliest first. Sample names only.
const VISITS = [
  { time: "10:00 AM", job: "Bathroom electrical issue", property: "Westside Commons", unit: "Unit 3", pro: "Sample Electric Co.", tenant: "Jamie R." },
  { time: "1:30 PM", job: "Heating system repair", property: "Maple Apartments", unit: "Unit 1", pro: "Sample Heating & Air", tenant: "Alex P." },
  { time: "4:00 PM", job: "Leaking kitchen pipe", property: "Oak St. Residence", unit: "Unit 2", pro: "Sample Plumbing", tenant: "Sam T." },
];

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="46" height="40" viewBox="0 0 46 40" aria-hidden="true">
        <path d="M23 1 1 20h6v19h32V20h6z" fill="#F26B1D" />
        <path d="M17 22h5v5h-5zm7 0h5v5h-5zm-7 7h5v5h-5zm7 0h5v5h-5z" fill="#fff" />
      </svg>
      <span className="leading-none">
        <span className="block font-display text-[28px] font-bold text-white">
          Fix<span className="text-[#F26B1D]">It</span>
        </span>
        <span className="block text-[10.5px] font-bold tracking-[0.14em] text-white">LOCAL SERVICES</span>
      </span>
    </span>
  );
}

function Panel({ title, link, children }: { title: string; link?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E4E9F1] bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-[19px] font-bold">{title}</h2>
        {link ? (
          <button type="button" className="flex items-center gap-1 text-[14px] font-bold text-[#D9560B]">
            View All <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function SpendingChart() {
  return (
    <div className="mt-3 flex gap-3 text-[12px] text-[#5B6880]">
      <div className="flex h-[160px] flex-col justify-between text-right tabular-nums" aria-hidden="true">
        {TICKS.map((tick) => (
          <span key={tick} className="leading-none">${tick.toLocaleString("en-US")}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-[160px]">
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
            {TICKS.map((tick) => (
              <span key={tick} className="block h-px bg-[#E4E9F1]" />
            ))}
          </div>
          <div className="relative flex h-full items-end justify-around">
            {SPENDING.map((bar, index) => (
              <div
                key={bar.month}
                title={`${bar.month}: $${bar.amount.toLocaleString("en-US")}`}
                className={`w-[11%] min-w-[18px] rounded-t-[4px] ${index === SPENDING.length - 1 ? "bg-[#F26B1D]" : "bg-[#A9C1E6]"} hover:opacity-80`}
                style={{ height: `${(bar.amount / AXIS_MAX) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-around">
          {SPENDING.map((bar) => (
            <span key={bar.month} className="w-[11%] min-w-[18px] text-center">{bar.month}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Maintenance spending by month</caption>
        <tbody>
          {SPENDING.map((bar) => (
            <tr key={bar.month}>
              <th scope="row">{bar.month}</th>
              <td>${bar.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusRing() {
  const total = OPEN_PARTS.reduce((sum, part) => sum + part.count, 0);
  const radius = 62;
  const around = 2 * Math.PI * radius;
  let before = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="Open requests by status">
        <g transform="rotate(-90 80 80)">
          {OPEN_PARTS.map((part) => {
            const length = (part.count / total) * around;
            const offset = before;
            before += length;
            return (
              <circle
                key={part.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={part.colour}
                strokeWidth="24"
                strokeDasharray={`${length - 2} ${around - length + 2}`}
                strokeDashoffset={-offset}
              >
                <title>{`${part.label}: ${part.count}`}</title>
              </circle>
            );
          })}
        </g>
        <text x="80" y="72" textAnchor="middle" className="fill-[#0B1B33] text-[24px] font-bold">8</text>
        <text x="80" y="91" textAnchor="middle" className="fill-[#0B1B33] text-[13px]">Open</text>
        <text x="80" y="107" textAnchor="middle" className="fill-[#0B1B33] text-[13px]">Requests</text>
      </svg>
      <ul className="min-w-[180px] flex-1 text-[14px]">
        {[...OPEN_PARTS, COMPLETED].map((part) => (
          <li key={part.label} className="flex items-center gap-3 border-b border-[#EDF1F7] py-2 last:border-b-0">
            <span className="h-3 w-3 flex-none rounded-full" style={{ background: part.colour }} aria-hidden="true" />
            <span className="flex-1">
              {part.label}
              {part.label === "Completed" ? <span className="text-[#5B6880]"> (This Month)</span> : null}
            </span>
            <strong className="tabular-nums">{part.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function PropertyManagerPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  // Not published: only a developer's computer shows this page.
  if (process.env.NODE_ENV === "production") notFound();
  // Only Overview and Properties are designed so far.
  const view = (await searchParams).view === "properties" ? "Properties" : "Overview";

  return (
    <div className="min-h-screen bg-[#F3F6FB] text-[#0B1B33]">
      {/* Shrinks to fit a narrower window, so it keeps the same layout as the full-size design. */}
      <div className="lg:[zoom:0.65] min-[1280px]:[zoom:0.78] min-[1440px]:[zoom:0.88] min-[1640px]:[zoom:1]">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#0F2447] px-5 py-3">
        <Logo />
        <div className="flex items-center gap-5 text-white">
          <button type="button" aria-label="Notifications" className="relative">
            <Bell className="h-7 w-7" aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#F26B1D]" />
          </button>
          <button type="button" className="flex items-center gap-3 text-[15px] font-semibold">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#0F2447]">
              <User className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">Akron Property Management</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="lg:flex">
        <aside className="bg-[#0F2447] px-4 py-4 text-white lg:w-[260px] lg:flex-none lg:min-h-[calc(154vh-72px)] min-[1280px]:min-h-[calc(128vh-72px)] min-[1440px]:min-h-[calc(114vh-72px)] min-[1640px]:min-h-[calc(100vh-72px)]">
          <button type="button" className="flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-[15px] font-semibold">
            <Building2 className="h-5 w-5" aria-hidden="true" />
            <span className="flex-1 text-left">Property Manager</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="mb-2 mt-5 hidden px-4 text-[12px] font-semibold tracking-wide text-white/60 lg:block">WORKSPACE</p>
          <nav className="mt-3 flex gap-1.5 overflow-x-auto lg:mt-0 lg:block lg:space-y-1.5">
            {NAV.map(({ label, icon: Icon, badge }) => {
              const active = label === view;
              const look = `flex flex-none items-center gap-4 rounded-lg px-4 py-3 text-[15.5px] font-medium lg:w-full ${active ? "bg-[#F26B1D] font-bold" : "hover:bg-white/10"}`;
              const inside = (
                <>
                  <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
                  <span className="flex-1 whitespace-nowrap text-left">{label}</span>
                  {badge ? (
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#F26B1D] px-1.5 text-[12px] font-bold">{badge}</span>
                  ) : null}
                </>
              );
              if (label === "Overview" || label === "Properties") {
                return (
                  <Link
                    key={label}
                    href={label === "Overview" ? "/property-manager" : "/property-manager?view=properties"}
                    aria-current={active ? "page" : undefined}
                    className={look}
                  >
                    {inside}
                  </Link>
                );
              }
              return (
                <button key={label} type="button" className={look}>
                  {inside}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-8">
          <p className="mb-3 inline-block rounded-full bg-[#FFF3D6] px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[#6B4300]">
            Design preview · sample data
          </p>
          {view === "Properties" ? (
            <Properties />
          ) : (
          <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-[36px] font-bold leading-tight">Good afternoon!</h1>
              <p className="text-[16px] text-[#475569]">
                Manage your properties, maintenance requests and service providers all in one place.
              </p>
            </div>
            <button type="button" className="flex items-center gap-3 rounded-lg bg-[#F26B1D] px-6 py-4 text-[16px] font-bold text-white shadow-sm hover:bg-[#DD5C10]">
              <Plus className="h-5 w-5" aria-hidden="true" />
              New Service Request
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STATS.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="flex items-center gap-4 rounded-2xl border border-[#E4E9F1] bg-white p-5 shadow-sm">
                <span className={`grid h-14 w-14 flex-none place-items-center rounded-full ${tone}`}>
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[14px] text-[#334155]">{label}</span>
                  <strong className="block font-display text-[32px] leading-tight">{value}</strong>
                </span>
              </div>
            ))}
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Waiting for Your Approval" link>
              <p className="-mt-2 mb-2 text-[12.5px] text-[#475569]">
                {APPROVALS.length} prices from pros. A job cannot start until you answer.
              </p>
              <ul className="space-y-1.5">
                {APPROVALS.map((item) => (
                  <li
                    key={item.job}
                    className={`rounded-lg border px-2.5 py-2 ${item.urgent ? "border-[#F3B9B5] bg-[#FFF6F5]" : "border-[#E4E9F1]"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {item.urgent ? <AlertTriangle className="h-3.5 w-3.5 flex-none text-[#B42318]" aria-label="Urgent" /> : null}
                        <strong className="truncate text-[13.5px]">{item.job}</strong>
                      </span>
                      <strong className="flex-none font-display text-[16px] leading-tight tabular-nums">${item.price.toLocaleString("en-US")}</strong>
                    </div>
                    <p className="text-[12px] text-[#475569]">
                      {item.property} • {item.unit} • <strong className="font-semibold text-[#0B1B33]">{item.pro}</strong>
                    </p>
                    <p className="text-[11.5px] text-[#475569]">{item.parts}</p>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11.5px] text-[#475569]">
                        {item.start} • {item.warranty} • {item.sent}
                      </span>
                      <span className="ml-auto flex gap-1.5">
                        <button type="button" className="rounded-md bg-[#1E8E4A] px-3 py-1 text-[12.5px] font-bold text-white hover:bg-[#17743C]">
                          Accept
                        </button>
                        <button type="button" className="rounded-md border border-[#C9D3E3] bg-white px-3 py-1 text-[12.5px] font-bold text-[#33466B] hover:bg-[#F3F6FB]">
                          Decline
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Today's Visits" link>
              <p className="-mt-2 mb-2 text-[12.5px] text-[#475569]">{VISITS.length} pros arriving today.</p>
              <ul className="space-y-1.5">
                {VISITS.map((visit) => (
                  <li key={visit.time} title={visit.job} className="flex items-center gap-2.5 rounded-lg border border-[#E4E9F1] px-2.5 py-2">
                    <span className="w-[76px] flex-none rounded-md bg-[#DDEBFE] py-1 text-center text-[12.5px] font-bold tabular-nums text-[#1457C0]">
                      {visit.time}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[13.5px]">
                        {visit.property} • {visit.unit}
                      </strong>
                      <span className="flex items-center gap-3 text-[12px] text-[#475569]">
                        <span className="flex min-w-0 items-center gap-1">
                          <HardHat className="h-3.5 w-3.5 flex-none text-[#F26B1D]" aria-label="Pro" />
                          <span className="truncate">{visit.pro}</span>
                        </span>
                        <span className="flex flex-none items-center gap-1">
                          <User className="h-3.5 w-3.5" aria-label="Tenant" />
                          {visit.tenant}
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <Panel title="Maintenance Spending">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="block font-display text-[36px] leading-none">$2,450</strong>
                  <span className="text-[14px] text-[#475569]">This Month</span>
                </div>
                {/* The sample figures rise from October, so the badge says so. */}
                <span className="rounded-lg bg-[#FFEFCF] px-3 py-2 text-center text-[13px] font-bold text-[#8A4B00]">
                  <span className="flex items-center justify-center gap-1 text-[16px]">
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    10%
                  </span>
                  <span className="font-medium">vs. last month</span>
                </span>
              </div>
              <SpendingChart />
            </Panel>

            <Panel title="Recent Maintenance Requests" link>
              <ul className="space-y-2">
                {REQUESTS.map(({ title, where, status, when, icon: Icon }) => (
                  <li key={title} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E4E9F1] p-2 sm:flex-nowrap">
                    <span className="grid h-12 w-16 flex-none place-items-center rounded-lg bg-gradient-to-br from-[#E8EDF5] to-[#C9D3E3] text-[#33466B]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[15px]">{title}</strong>
                      <span className="block truncate text-[13px] text-[#475569]">{where}</span>
                    </span>
                    <span className={`flex-none rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${STATUS_TONE[status]}`}>{status}</span>
                    <span className="w-[104px] flex-none text-[12.5px] text-[#475569]">{when}</span>
                    <ChevronRight className="h-5 w-5 flex-none" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <Panel title="Properties" link>
              <ul className="space-y-2">
                {PROPERTIES.map(({ name, city, kind, open, icon: Icon, art }) => (
                  <li key={name} className="flex items-center gap-4 rounded-xl border border-[#E4E9F1] p-2">
                    <span className={`grid h-[76px] w-[120px] flex-none place-items-center rounded-lg bg-gradient-to-b ${art} text-white`}>
                      <Icon className="h-10 w-10 drop-shadow" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[16px]">{name}</strong>
                      <span className="flex items-center gap-1.5 text-[13.5px] text-[#475569]">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        {city}
                      </span>
                      <span className="flex items-center gap-1.5 text-[13.5px] text-[#475569]">
                        <DoorOpen className="h-4 w-4" aria-hidden="true" />
                        {kind}
                      </span>
                    </span>
                    <span className="flex-none rounded-lg bg-[#FFF0E3] px-3 py-1.5 text-[12.5px] font-bold text-[#B4470A]">{open} Open Requests</span>
                    <ChevronRight className="h-5 w-5 flex-none" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Request Status">
              <StatusRing />
            </Panel>
          </div>
          </>
          )}
        </main>
      </div>
      </div>
    </div>
  );
}
