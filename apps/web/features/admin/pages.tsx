"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  BellRing,
  Building2,
  ClipboardList,
  Crown,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Siren,
  Star,
  UserSearch,
  UsersRound,
  Wrench,
  Percent,
  Flag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { useAuth } from "@/lib/auth-context";
import { requireSupabase, supabaseRestRoot } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { digitsOf, groupNumber } from "@/lib/fixit-numbers";
import { AdminAccounts } from "./accounts";
import { adminAccounts, adminResources, longColumns, statusColumns } from "./config";
import { AdminOverview } from "./overview";
import { AdminTeam } from "./team";
import { AdminStaffAccess } from "./staff-access";
import { AdminActivity } from "./activity";
import { AdminCommissions } from "./commissions";
import { AdminLeadIntegrity } from "./lead-integrity";
import { AdminCustomerLookup } from "./customer-lookup";
import { AdminTrialReminders } from "./trial-reminders";
import { AdminDispatch } from "./dispatch";
import { AdminServiceDemand } from "./service-demand";
import { AdminProLookup } from "./pro-lookup";
import { AdminSignIn } from "./admin-signin";
import { StatusPill, humanize } from "./ui";

type Row = Record<string, unknown>;

const SYSTEM_COLUMNS = ["created_at", "updated_at"];
const PAGE_SIZE = 100;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** `2026-10-18T…` reads as a date, not a timestamp, in a table cell. */
function shortDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

/**
 * A table with no rows has no sample to learn its columns from, which used to
 * leave Add permanently disabled: the dashboard could never enter the first
 * record. PostgREST describes every table at the REST root, so ask it.
 */
async function tableSchema(table: string): Promise<Record<string, string>> {
  const root = supabaseRestRoot();
  if (!root) return {};
  const response = await fetch(root.url, {
    headers: { apikey: root.key, Authorization: `Bearer ${root.key}` },
  });
  if (!response.ok) return {};
  const document = (await response.json()) as {
    definitions?: Record<string, { properties?: Record<string, { type?: string }> }>;
  };
  const properties = document.definitions?.[table]?.properties ?? {};
  return Object.fromEntries(
    Object.entries(properties).map(([column, spec]) => [column, spec.type ?? "string"]),
  );
}

/** Keep a column's existing type: a text input must not turn 42 into "42". */
function coerce(value: string, sample: unknown, type?: string): unknown {
  if (value === "") return null;
  if (typeof sample === "number" || (sample === undefined && (type === "integer" || type === "number"))) {
    return Number(value);
  }
  if (typeof sample === "boolean" || (sample === undefined && type === "boolean")) {
    return value === "true";
  }
  if ((sample !== null && typeof sample === "object") || (sample === undefined && type === "object")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/** Turn a column name into the words a person would say: `category_slug` -> "Category". */
function columnLabel(column: string): string {
  const cleaned = column.replace(/_slug$/, "").replace(/_id$/, "");
  return humanize(cleaned);
}

/** One managed table: its rows, its search, and the form that edits one. */
function ResourceTable({ table, label, listColumns, primaryKey, select }: {
  table: string;
  label: string;
  listColumns?: string[];
  primaryKey: string;
  select?: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{ key: unknown; values: Record<string, string> } | null>(null);
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);

  const rows = useQuery({
    queryKey: ["admin-rows", table],
    queryFn: async () => {
      const client = requireSupabase();
      // A resource may name its columns when one of them is not readable
      // through the API (a customer's contact details, for instance), because
      // `*` would then fail for every reader.
      // The column list is a runtime string, so the client's generated types do
      // not apply; the row shape is checked by the table the resource names.
      const read = () =>
        client
          .from(table)
          .select((select ?? "*") as never)
          .limit(PAGE_SIZE);
      // Newest first when the table records a creation time; plenty of tables do not.
      let { data, error } = await read().order("created_at", { ascending: false });
      if (error) ({ data, error } = await read());
      if (error) throw new Error(error.message);
      const loaded = (data ?? []) as unknown as Row[];
      // A request's customer number is looked up by the database from the list
      // of requests on this page, so it is right even for a customer who is not
      // in the first page of accounts.
      if (table === "quote_requests" && loaded.length > 0) {
        const { data: numbers } = await client.rpc("request_customer_numbers", {
          p_request_ids: loaded.map((row) => row.id).filter(Boolean),
        });
        const byRequest = new Map(
          ((numbers ?? []) as Array<{ request_id: string; customer_number: number | null }>).map((row) => [
            row.request_id,
            row.customer_number,
          ]),
        );
        return loaded.map((row) => ({
          ...row,
          customer_number: byRequest.get(String(row.id)) ?? null,
        }));
      }
      return loaded;
    },
  }) as UseQueryResult<Row[]>;

  const sample = rows.data?.[0];

  // Only an empty table needs the schema: one row already names every column.
  const schema = useQuery({
    queryKey: ["admin-schema", table],
    enabled: rows.isSuccess && rows.data?.length === 0,
    queryFn: () => tableSchema(table),
  });
  const schemaColumns = useMemo(() => Object.keys(schema.data ?? {}), [schema.data]);

  const columns = useMemo(() => {
    if (listColumns?.length) return listColumns;
    if (sample) return Object.keys(sample);
    return schemaColumns;
  }, [listColumns, sample, schemaColumns]);
  // The form offers every column, not just the ones the list chooses to show.
  const formColumns = useMemo(
    () => (sample ? Object.keys(sample) : schemaColumns.length ? schemaColumns : columns).filter(
      (column) => column !== primaryKey && !SYSTEM_COLUMNS.includes(column),
    ),
    [columns, primaryKey, sample, schemaColumns],
  );
  // A key the database generates (an `id`) is never typed. A natural key — a
  // service's `slug` — has no default, so a new row must supply one; it is
  // asked for on create and then left alone, because editing it would orphan
  // whatever already points at it.
  const naturalKey = primaryKey !== "id";
  const createColumns = useMemo(
    () => (naturalKey ? [primaryKey, ...formColumns] : formColumns),
    [naturalKey, primaryKey, formColumns],
  );

  // Searching filters what is already loaded, which is enough for the sizes a
  // small marketplace holds and keeps every section one round trip.
  const filtered = useMemo(() => {
    const all = rows.data ?? [];
    const needle = term.trim().toLowerCase();
    if (!needle) return all;
    const fields = columns;
    // A number is searched by its digits, so "304 215 887", "304-215-887" and
    // "304215887" all find the same business.
    const digits = digitsOf(needle);
    return all.filter((row) =>
      fields.some((field) => cellText(row[field]).toLowerCase().includes(needle))
      || (digits.length > 0 && fields.some((field) => digitsOf(cellText(row[field])) === digits)),
    );
  }, [rows.data, term, columns]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / 25));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * 25, safePage * 25 + 25);

  const save = useMutation({
    mutationFn: async (input: { key: unknown; values: Record<string, string> }) => {
      const creating = input.key === null;
      const source = creating ? createColumns : formColumns;
      const entries = source.map((column) => [
        column,
        coerce(input.values[column] ?? "", sample?.[column], schema.data?.[column]),
      ]) as [string, unknown][];
      // A field left empty on a new row is omitted, not sent as null, so the
      // column's own default applies: a city is active and ordered zero unless
      // the owner says otherwise, instead of the row failing the NOT NULL check.
      const payload = Object.fromEntries(creating ? entries.filter(([, value]) => value !== null) : entries);
      const target = requireSupabase().from(table);
      const { error } = creating
        ? await target.insert(payload)
        : await target.update(payload).eq(primaryKey, input.key as string);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-rows", table] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
      toast.success("Saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (key: unknown) => {
      const { error } = await requireSupabase().from(table).delete().eq(primaryKey, key as string);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-rows", table] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
      toast.success("Deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** A pill instead of raw text for the columns that hold a state. */
  const renderCell = (column: string, row: Row) => {
    const value = row[column];
    if (statusColumns.has(column) && value !== null && value !== undefined) {
      return <StatusPill value={cellText(value)} />;
    }
    const date = shortDate(value);
    if (date) return date;
    if (longColumns.has(column)) {
      return <span className="block max-w-[24rem] truncate" title={cellText(value)}>{cellText(value)}</span>;
    }
    if (column === "business_name" || column === "author_name" || column === "customer_name") {
      const text = cellText(value);
      return (
        <span className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#E9F1FB] text-[11px] font-bold text-[#1565C0]">
            {initials(text)}
          </span>
          <span className="truncate font-semibold">{text}</span>
        </span>
      );
    }
    if (column === "pro_number") {
      return typeof value === "number" || typeof value === "string" ? (
        <span className="font-display tabular-nums tracking-[0.06em]">{groupNumber(String(value))}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }
    if (column === "customer_number") {
      // Six digits, in the same monospaced shape as the customer's own page, so
      // the number can be read aloud without losing a digit.
      return typeof value === "number" ? (
        <span className="font-display tabular-nums tracking-[0.08em]">{String(value).padStart(6, "0")}</span>
      ) : (
        <span className="text-muted-foreground">No account</span>
      );
    }
    if (column === "is_emergency") {
      // An emergency lead is the one thing on this table that cannot wait, so
      // it reads as a red flag rather than "true".
      return value ? (
        <span className="rounded-full bg-[#FDECEA] px-2.5 py-1 text-[11px] font-bold text-[#C0392B]">
          Emergency
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    }
    if (typeof value === "boolean") {
      return <StatusPill value={value ? "active" : "blocked"} />;
    }
    return <span className="block max-w-[18rem] truncate" title={cellText(value)}>{cellText(value)}</span>;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{label}</CardTitle>
            <p className="pt-1 text-[12.5px] text-muted-foreground">
              {rows.data ? `${rows.data.length} record${rows.data.length === 1 ? "" : "s"}` : "Loading…"}
              {term ? ` · ${filtered.length} matching “${term}”` : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={term}
                onChange={(event) => { setTerm(event.target.value); setPage(0); }}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label}`}
                className="h-9 w-56 pl-8"
              />
            </div>
            <Button
              size="sm"
              disabled={createColumns.length === 0}
              onClick={() =>
                setDraft({ key: null, values: Object.fromEntries(createColumns.map((column) => [column, ""])) })
              }
            >
              Add new
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rows.isPending ? (
            <div className="p-5"><LoadingState title="Loading…" /></div>
          ) : rows.error ? (
            <div className="p-5">
              <ErrorState
                title="Could not load this table"
                description={(rows.error as Error).message}
                actionLabel="Try again"
                onAction={() => void rows.refetch()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={term ? "Nothing matches that search" : "No records yet"}
                description={term ? `No ${label.toLowerCase()} contain “${term}”.` : `Nothing in ${label} so far.`}
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      {columns.map((column) => (
                        <TableHead key={column} className="whitespace-nowrap text-[12px] font-bold uppercase tracking-wide">
                          {columnLabel(column)}
                        </TableHead>
                      ))}
                      <TableHead className="w-[1%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((row, index) => (
                      <TableRow key={String(row[primaryKey] ?? index)}>
                        {columns.map((column) => (
                          <TableCell key={column} className="max-w-[24rem]">
                            {renderCell(column, row)}
                          </TableCell>
                        ))}
                        <TableCell className="whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDraft({
                                key: row[primaryKey] ?? null,
                                values: Object.fromEntries(
                                  formColumns.map((column) => [
                                    column,
                                    row[column] === null || row[column] === undefined
                                      ? ""
                                      : typeof row[column] === "object"
                                        ? JSON.stringify(row[column])
                                        : String(row[column]),
                                  ]),
                                ),
                              })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (!window.confirm("Delete this record? This cannot be undone.")) return;
                              remove.mutate(row[primaryKey]);
                            }}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {pageCount > 1 ? (
                <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
                  <p className="text-[12.5px] text-muted-foreground">
                    Page {safePage + 1} of {pageCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage === 0}
                      onClick={() => setPage((current) => Math.max(0, current - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                    >
                      Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.key === null ? `New ${label}` : `Edit ${label}`}</DialogTitle>
            <DialogDescription>
              {draft?.key === null
                ? "This is saved to the live site as soon as you save."
                : "Changes are live as soon as you save."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2">
            {(draft?.key === null ? createColumns : formColumns).map((column) => (
              <div key={column} className="grid gap-2">
                <Label htmlFor={`admin-${column}`}>{columnLabel(column)}</Label>
                <Input
                  id={`admin-${column}`}
                  value={draft?.values[column] ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current && { ...current, values: { ...current.values, [column]: event.target.value } },
                    )
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const TABLE_ICONS: Record<string, typeof Wrench> = {
  providers: Wrench,
  quote_requests: ClipboardList,
  reviews: Star,
  appointments: CalendarDays,
  messages: MessageSquare,
  service_categories: Wrench,
  service_cities: MapPin,
};

/** What each section is for, in the words of the person running the product. */
const SECTION_HINT: Record<string, string> = {
  overview: "What needs attention across FixIt",
  providers: "Approve professionals and keep their listings accurate",
  quote_requests: "Every job a customer has posted",
  appointments: "Visits booked between customers and pros",
  reviews: "Feedback left on professional profiles",
  messages: "Customer and pro conversations",
  service_categories: "The trades customers choose from",
  service_cities: "The cities FixIt serves, offered to customers and pros",
  commissions: "Commission terms, charges, disputes and the lead ledger",
  lead_integrity: "Fake, duplicate and reported leads waiting on a decision",
  customer_lookup: "Type a customer number to see everything that customer has done",
  trial_reminders: "Free periods ending soon, and whether each pro has been told",
  dispatch: "Emergencies waiting for a crew, nearest first",
  service_waitlist: "Who is asking for a trade nobody serves yet",
  pro_lookup: "Type a business's nine-digit FixIt number to find it",
  accounts: "Everyone with a FixIt account",
  team: "Who works in this dashboard, and as what",
  activity: "A record of every change made here",
};

// The sidebar groups sections the way the work is grouped, not the way the
// tables happen to be named.
const NAV_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Marketplace", keys: ["dispatch", "providers", "pro_lookup", "customer_lookup", "quote_requests", "lead_integrity", "appointments", "reviews", "messages"] },
  { title: "Revenue", keys: ["commissions", "trial_reminders"] },
  { title: "Settings", keys: ["service_waitlist", "service_categories", "service_cities", "accounts", "team", "activity"] },
];

type SectionKey = string;

export function AdminPage() {
  const auth = useAuth();
  const [section, setSection] = useState<SectionKey>("overview");

  const role = useQuery({
    queryKey: ["admin-role", auth.user?.id],
    enabled: auth.status === "authenticated" && Boolean(auth.user),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("app_roles")
        .select("role")
        .eq("user_id", auth.user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.role as "admin" | "manager" | undefined) ?? null;
    },
  });

  const isOwner = role.data === "admin";

  // What this person may open, read from the saved access list. The database
  // enforces the same answer, so this menu and the refusal always agree.
  const workspace = useQuery({
    queryKey: ["admin-workspace", auth.user?.id, role.data],
    enabled: Boolean(role.data),
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc("my_workspace_permissions");
      if (error) throw new Error(error.message);
      return (data ?? []) as string[];
    },
  });
  const granted = workspace.data ? new Set(workspace.data) : null;

  // A screen the owner has since switched off must not stay open in a tab.
  useEffect(() => {
    if (granted && !isOwner && !granted.has(section) && section !== "overview" && section !== "team") {
      setSection("overview");
    }
  }, [granted, isOwner, section]);

  // A section the role may not see must not stay open when access changes.
  useEffect(() => {
    // A section the role may not see must not stay open when the role changes.
    if (["team", "commissions", "trial_reminders", "customer_lookup", "accounts", "service_waitlist"].includes(section) && role.data && !isOwner) {
      setSection("overview");
    }
  }, [isOwner, role.data, section]);

  if (auth.status === "loading" || (auth.status === "authenticated" && role.isPending)) {
    return <LoadingState className="min-h-screen rounded-none border-0" title="Loading the dashboard…" />;
  }
  if (auth.status === "unavailable") {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
        <ErrorState
          title="The dashboard is not available"
          description="This application does not have data services enabled."
        />
      </main>
    );
  }
  // The dashboard has its own sign-in, distinct from the marketplace login:
  // same accounts, but no sign-up and a manager-role check before it opens.
  if (auth.status === "anonymous") {
    return <AdminSignIn />;
  }
  // A failed lookup leaves the role unset, which is not the same as not having
  // one. Saying so before the access check keeps a network blip from reading as
  // a refusal the administrator cannot argue with.
  if (role.error) {
    return (
      <main className="grid min-h-screen place-items-center bg-muted/40 px-4">
        <ErrorState
          title="Could not check your access"
          description="Your role could not be read just now. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void role.refetch()}
        />
      </main>
    );
  }
  if (!role.data) {
    return (
      <main className="mx-auto grid min-h-screen max-w-3xl content-center gap-6 px-4">
        <ErrorState
          title="This account is not a manager"
          description={`Signed in as ${auth.user?.email ?? "an account without a dashboard role"}, which has no dashboard role. Sign in with a manager account, or return to the marketplace.`}
          actionLabel="Sign in as a manager"
          onAction={() => void auth.signOut()}
        />
        <div className="text-center">
          <a href="/" className="text-sm font-bold text-primary hover:underline">Back to FixIt</a>
        </div>
      </main>
    );
  }

  // Staff run the marketplace. The owner alone sees the screens that decide
  // who works here, reach every account, or change the site's settings.
  const OWNER_ONLY = new Set(["commissions", "trial_reminders", "customer_lookup", "accounts", "team", "service_cities", "service_categories", "service_waitlist"]);
  // Until the saved list arrives every screen stays as it was, so the menu
  // never blinks or hides pages from someone whose access is still loading.
  const available = new Set([
    "overview",
    "commissions",
    "lead_integrity",
    "customer_lookup",
    "trial_reminders",
    "dispatch",
    "service_waitlist",
    "pro_lookup",
    ...adminResources.map((resource) => resource.table),
    ...(adminAccounts ? ["accounts"] : []),
    ...(isOwner ? ["team"] : []),
    "activity",
  ].filter((key) => isOwner || !OWNER_ONLY.has(key)));
  for (const key of Array.from(available)) {
    if (!isOwner && granted && !granted.has(key)) available.delete(key);
  }
  const navigation = Object.fromEntries(
    ["overview", "dispatch", "service_waitlist", "pro_lookup", "commissions", "trial_reminders", "lead_integrity", "customer_lookup", ...adminResources.map((resource) => resource.table), "accounts", "team", "activity"]
      .filter((key) => available.has(key))
      .map((key) => {
        const resource = adminResources.find((item) => item.table === key);
        const label =
          key === "overview" ? "Overview"
            : key === "commissions" ? "Commissions"
            : key === "lead_integrity" ? "Lead integrity"
            : key === "customer_lookup" ? "Find customer"
            : key === "trial_reminders" ? "Trial reminders"
            : key === "dispatch" ? "Emergency dispatch"
            : key === "service_waitlist" ? "Trade waitlist"
            : key === "pro_lookup" ? "Find business"
            : key === "accounts" ? "Accounts"
              : key === "team" ? "Team"
                : key === "activity" ? "Activity"
                  : resource?.label ?? key;
        const icon =
          key === "overview" ? LayoutDashboard
            : key === "commissions" ? Percent
            : key === "lead_integrity" ? Flag
            : key === "customer_lookup" ? UserSearch
            : key === "trial_reminders" ? Crown
            : key === "dispatch" ? Siren
            : key === "service_waitlist" ? BellRing
            : key === "pro_lookup" ? Building2
            : key === "accounts" ? UsersRound
              : key === "team" ? ShieldCheck
                : key === "activity" ? ClipboardList
                  : TABLE_ICONS[key] ?? ClipboardList;
        return [key, { key, label, icon }];
      }),
  ) as Record<string, { key: string; label: string; icon: typeof Wrench }>;

  const current = navigation[section] ?? navigation.overview;
  const resource = adminResources.find((item) => item.table === section);
  const hint = SECTION_HINT[section] ?? "Edit records directly; changes are live";

  const goTo = (key: string) => {
    if (!available.has(key)) return;
    setSection(key);
  };

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-2.5 bg-secondary px-5 py-4 text-white">
          <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
          <div>
            <p className="font-display text-[15px] font-semibold leading-tight">FixIt Management</p>
            <p className="text-[11.5px] text-[#9FB0C4]">{isOwner ? "Owner access" : "Staff access"}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => goTo("overview")}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition",
              section === "overview" ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-muted",
            )}
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Overview
          </button>
          {NAV_GROUPS.map((group) => {
            const items = group.keys.map((key) => navigation[key]).filter(Boolean);
            if (items.length === 0) return null;
            return (
              <div key={group.title} className="pt-3">
                <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = item.key === section;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => goTo(item.key)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition",
                        active ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate px-2 pb-2 text-[12.5px] text-muted-foreground">{auth.user?.email}</p>
          <Button variant="outline" className="w-full justify-start" onClick={() => void auth.signOut()}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2.5 lg:hidden">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            <span className="font-display text-[15px] font-semibold">FixIt Management</span>
          </div>
          <div className="hidden lg:block">
            <h1 className="font-display text-xl font-semibold">{current?.label ?? "Dashboard"}</h1>
            <p className="text-[12.5px] text-muted-foreground">{hint}</p>
          </div>
          {/* Small screens get the same navigation as a scrolling row. */}
          <div className="flex max-w-full gap-1 overflow-x-auto lg:hidden">
            {Object.values(navigation).map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant={item.key === section ? "default" : "outline"}
                onClick={() => goTo(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-3 lg:hidden">
            <Button variant="ghost" size="sm" onClick={() => void auth.signOut()}>Sign out</Button>
          </div>
        </header>

        <div className="border-b border-border bg-card px-5 py-4 lg:hidden">
          <h1 className="font-display text-lg font-semibold">{current?.label ?? "Dashboard"}</h1>
          <p className="text-[12.5px] text-muted-foreground">{hint}</p>
        </div>

        <main className="grid flex-1 content-start gap-6 p-5">
          {section === "overview" ? <AdminOverview onOpen={goTo} onGo={goTo} /> : null}
          {section === "commissions" && isOwner ? <AdminCommissions /> : null}
          {section === "lead_integrity" ? <AdminLeadIntegrity /> : null}
          {section === "customer_lookup" && isOwner ? <AdminCustomerLookup /> : null}
          {section === "trial_reminders" && isOwner ? <AdminTrialReminders /> : null}
          {section === "dispatch" ? <AdminDispatch /> : null}
          {section === "service_waitlist" && isOwner ? <AdminServiceDemand /> : null}
          {section === "pro_lookup" ? <AdminProLookup /> : null}
          {section === "accounts" && adminAccounts ? <AdminAccounts /> : null}
          {section === "team" && isOwner ? <AdminTeam selfId={auth.user?.id ?? null} /> : null}
          {section === "team" && isOwner ? <AdminStaffAccess /> : null}
          {section === "activity" ? <AdminActivity /> : null}
          {resource ? (
            <ResourceTable
              table={resource.table}
              label={resource.label}
              listColumns={resource.columns}
              primaryKey={resource.primaryKey ?? "id"}
              select={resource.select}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
