import { AlertTriangle, Building2, CalendarDays, Home, MapPin, Plus, Search, Warehouse } from "lucide-react";

/** DESIGN PREVIEW of the Properties screen. Every name and number is sample data. */

const PROPERTIES = [
  { name: "Maple Apartments", city: "Akron, OH", kind: "Apartment building", units: 24, rented: 22, open: 5, urgent: 1, spent: 1450, next: "Today, 1:30 PM", icon: Building2, art: "from-[#CFE3F5] to-[#D8A07F]" },
  { name: "Oak St. Residence", city: "Akron, OH", kind: "Single-family home", units: 1, rented: 1, open: 2, urgent: 1, spent: 620, next: "Today, 4:00 PM", icon: Home, art: "from-[#BFE0F7] to-[#9CCB8B]" },
  { name: "Westside Commons", city: "Akron, OH", kind: "Townhomes", units: 8, rented: 8, open: 1, urgent: 0, spent: 380, next: "Today, 10:00 AM", icon: Warehouse, art: "from-[#D6E4F7] to-[#B9A7D9]" },
  { name: "Birchwood Duplex", city: "Cuyahoga Falls, OH", kind: "Duplex", units: 2, rented: 2, open: 0, urgent: 0, spent: 0, next: null, icon: Home, art: "from-[#D5EEF0] to-[#8FC1A9]" },
  { name: "Stow Garden Flats", city: "Stow, OH", kind: "Apartment building", units: 6, rented: 5, open: 0, urgent: 0, spent: 0, next: null, icon: Building2, art: "from-[#E3E9F6] to-[#E3B98B]" },
  { name: "Kent Corner House", city: "Kent, OH", kind: "Single-family home", units: 1, rented: 0, open: 0, urgent: 0, spent: 0, next: null, icon: Home, art: "from-[#CDE6FA] to-[#C7D68F]" },
];

// One property opened up, to show what sits behind a card.
const UNITS = [
  { unit: "Unit 1", tenant: "Alex P.", job: "Heating system repair", status: "In Progress" },
  { unit: "Unit 2", tenant: "Morgan K.", job: null, status: null },
  { unit: "Unit 8", tenant: "Riley S.", job: "Water heater replacement", status: "Needs approval" },
  { unit: "Unit 12", tenant: "Vacant", job: null, status: null },
];

const STATUS_TONE: Record<string, string> = {
  "In Progress": "bg-[#FFEFCF] text-[#8A4B00]",
  "Needs approval": "bg-[#FDE2E2] text-[#B42318]",
};

export function Properties() {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[36px] font-bold leading-tight">Properties</h1>
          <p className="text-[16px] text-[#475569]">12 properties • 48 rental units • 8 open requests</p>
        </div>
        <button type="button" className="flex items-center gap-3 rounded-lg bg-[#F26B1D] px-6 py-4 text-[16px] font-bold text-white shadow-sm hover:bg-[#DD5C10]">
          <Plus className="h-5 w-5" aria-hidden="true" />
          Add Property
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[#E4E9F1] bg-white px-3 py-2.5">
          <Search className="h-4 w-4 text-[#5B6880]" aria-hidden="true" />
          <input aria-label="Search properties" placeholder="Search by name, address or tenant" className="w-full bg-transparent text-[14px] outline-none" />
        </label>
        {["All", "Needs attention", "Has vacancy"].map((filter, index) => (
          <button
            key={filter}
            type="button"
            className={`rounded-full border px-4 py-2 text-[13.5px] font-bold ${index === 0 ? "border-[#0F2447] bg-[#0F2447] text-white" : "border-[#C9D3E3] bg-white text-[#33466B]"}`}
          >
            {filter}
          </button>
        ))}
      </div>

      <ul className="mb-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROPERTIES.map((property) => (
          <li key={property.name} className="overflow-hidden rounded-2xl border border-[#E4E9F1] bg-white shadow-sm">
            <div className={`relative grid h-[120px] place-items-center bg-gradient-to-b ${property.art} text-white`}>
              <property.icon className="h-14 w-14 drop-shadow" aria-hidden="true" />
              {property.urgent ? (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-lg bg-[#D92D20] px-2.5 py-1 text-[12px] font-bold">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  {property.urgent} urgent
                </span>
              ) : null}
              <span className={`absolute right-3 top-3 rounded-lg px-2.5 py-1 text-[12px] font-bold ${property.open ? "bg-[#FFF0E3] text-[#B4470A]" : "bg-[#DCF3E2] text-[#136C34]"}`}>
                {property.open ? `${property.open} open ${property.open === 1 ? "request" : "requests"}` : "All good"}
              </span>
            </div>
            <div className="p-4">
              <strong className="block text-[17px]">{property.name}</strong>
              <span className="flex items-center gap-1.5 text-[13px] text-[#475569]">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {property.city} • {property.kind}
              </span>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-y border-[#EDF1F7] py-2.5 text-center">
                <div>
                  <dt className="text-[11.5px] text-[#5B6880]">Units</dt>
                  <dd className="font-bold">{property.units}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-[#5B6880]">Rented</dt>
                  <dd className="font-bold">{property.rented}</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-[#5B6880]">This month</dt>
                  <dd className="font-bold">${property.spent.toLocaleString("en-US")}</dd>
                </div>
              </dl>
              <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-[#475569]">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {property.next ? `Next visit: ${property.next}` : "No visits booked"}
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="flex-1 rounded-lg border border-[#C9D3E3] py-2 text-[13.5px] font-bold text-[#33466B] hover:bg-[#F3F6FB]">
                  View
                </button>
                <button type="button" className="flex-1 rounded-lg bg-[#F26B1D] py-2 text-[13.5px] font-bold text-white hover:bg-[#DD5C10]">
                  New request
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mb-5 text-center text-[13px] text-[#5B6880]">Showing 6 of 12 properties</p>

      <section className="rounded-2xl border border-[#E4E9F1] bg-white p-5 shadow-sm">
        <h2 className="font-display text-[19px] font-bold">Inside a property: Maple Apartments</h2>
        <p className="mb-3 text-[13px] text-[#475569]">What opens after tapping View. 4 of 24 units shown.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#E4E9F1] text-[12px] uppercase tracking-wide text-[#5B6880]">
                <th scope="col" className="py-2 pr-4 font-semibold">Unit</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Tenant</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Open job</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                <th scope="col" className="py-2 font-semibold"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {UNITS.map((row) => (
                <tr key={row.unit} className="border-b border-[#EDF1F7] last:border-b-0">
                  <td className="py-3 pr-4 font-bold">{row.unit}</td>
                  <td className={`py-3 pr-4 ${row.tenant === "Vacant" ? "text-[#8A4B00]" : ""}`}>{row.tenant}</td>
                  <td className="py-3 pr-4">{row.job ?? <span className="text-[#5B6880]">None</span>}</td>
                  <td className="py-3 pr-4">
                    {row.status ? (
                      <span className={`rounded-lg px-2.5 py-1 text-[12.5px] font-bold ${STATUS_TONE[row.status]}`}>{row.status}</span>
                    ) : null}
                  </td>
                  <td className="py-3 text-right">
                    <button type="button" className="text-[13px] font-bold text-[#D9560B]">New request</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
