"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Lock, RotateCcw, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/**
 * Every screen the owner can hand to a member of staff, grouped the way the
 * dashboard's own menu is. The keys are the ones the database checks, so a
 * switch here is the same permission that decides what opens.
 */
const SCREENS: { group: string; items: { key: string; label: string; hint: string }[] }[] = [
  {
    group: "Marketplace",
    items: [
      { key: "overview", label: "Overview", hint: "The day's queue: new asks, waiting approvals, recent activity" },
      { key: "dispatch", label: "Emergency dispatch", hint: "Find and contact the nearest crew for an emergency" },
      { key: "providers", label: "Professionals", hint: "Approve a business and check its licence, insurance and registration" },
      { key: "pro_lookup", label: "Find business", hint: "Look up any business by its 9-digit number" },
      { key: "quote_requests", label: "Quote requests", hint: "Every customer request and who is handling it" },
      { key: "lead_integrity", label: "Lead integrity", hint: "Fake or duplicate leads and the disputes raised on them" },
      { key: "quotes", label: "Quotes", hint: "What each professional priced and whether the customer chose it" },
      { key: "provider_availability", label: "Provider hours", hint: "When each business says it is available" },
      { key: "appointments", label: "Appointments", hint: "Scheduled visits and their outcome" },
      { key: "reviews", label: "Reviews", hint: "Customer feedback on professionals" },
      { key: "messages", label: "Messages", hint: "Conversations between customers and professionals" },
      { key: "lead_disputes", label: "Lead disputes", hint: "Claims that a lead was fake or not theirs" },
      { key: "quote_request_contacts", label: "Lead contacts", hint: "Customer phone and email on each request" },
      { key: "provider_documents", label: "Provider documents", hint: "Uploaded licence and insurance paperwork" },
    ],
  },
  {
    group: "Record keeping",
    items: [{ key: "activity", label: "Activity", hint: "What each person did in the dashboard, and when" }],
  },
];

const ALL_KEYS = SCREENS.flatMap((group) => group.items.map((item) => item.key));

interface StaffRow {
  user_id: string;
  role: "admin" | "manager";
  permissions: string[] | null;
  created_at: string;
}

async function loadAccess(): Promise<{ staff: StaffRow[]; emails: Map<string, string | null> }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc("staff_access");
  if (error) throw new Error(error.message);
  // The roles carry ids only; the owner may also read the account directory.
  const { data: people, error: peopleError } = await client.rpc("admin_search_accounts", {
    term: "",
    max_rows: 50,
  });
  if (peopleError) throw new Error(peopleError.message);
  const emails = new Map<string, string | null>(
    ((people ?? []) as { user_id: string; email: string | null }[]).map((person) => [person.user_id, person.email]),
  );
  return { staff: (data ?? []) as StaffRow[], emails };
}

function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((key) => set.has(key));
}

function summary(saved: string[] | null): string {
  if (saved === null) return "Standard staff screens";
  if (saved.length === 0) return "No screens: can sign in, sees nothing";
  return `${saved.length} of ${ALL_KEYS.length} screens · customised`;
}

/**
 * What each member of staff may open. The list is kept on the server, so a
 * screen switched off here actually closes for that person, on the website and
 * in the phone app alike.
 */
export function AdminStaffAccess() {
  const queryClient = useQueryClient();
  const access = useQuery({ queryKey: ["admin-staff-access"], queryFn: loadAccess });
  const [openId, setOpenId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (input: { userId: string; screens: string[] | null }) => {
      const { error } = await requireSupabase().rpc("set_staff_permissions", {
        p_user_id: input.userId,
        p_permissions: input.screens,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_data, input) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-staff-access"] });
      toast.success(input.screens === null ? "Back to the standard staff screens" : "Access saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const staff = useMemo(() => (access.data?.staff ?? []).filter((row) => row.role === "manager"), [access.data]);
  const owners = (access.data?.staff ?? []).filter((row) => row.role === "admin");

  useEffect(() => {
    if (openId && !staff.some((row) => row.user_id === openId)) setOpenId(null);
  }, [openId, staff]);

  return (
    <Card>
      <CardHeader className="space-y-0 border-b p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <CardTitle className="text-base">What your staff can open</CardTitle>
            <p className="pt-1 text-[12.5px] text-muted-foreground">
              Choose each person&apos;s screens. A screen switched off closes for them, and the database refuses it too.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="gap-4 p-5">
        {access.isPending ? (
          <LoadingState title="Loading staff access…" />
        ) : access.error ? (
          <ErrorState
            title="Could not load staff access"
            description={(access.error as Error).message}
            actionLabel="Try again"
            onAction={() => void access.refetch()}
          />
        ) : staff.length === 0 ? (
          <EmptyState
            title="No staff yet"
            description="Add a member of staff above, then choose what they can open here."
          />
        ) : (
          <div className="grid gap-3">
            {staff.map((row) => {
              const saved = row.permissions;
              const open = openId === row.user_id;
              const email = access.data?.emails.get(row.user_id) ?? null;
              return (
                <div key={row.user_id} className="rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : row.user_id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40"
                  >
                    <UserCog className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{email ?? row.user_id}</span>
                      <span className="block text-[12.5px] text-muted-foreground">{summary(saved)}</span>
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>
                  {open ? (
                    <ScreenChooser
                      current={saved ?? ALL_KEYS}
                      standard={saved === null}
                      busy={save.isPending}
                      onSave={(screens) => save.mutate({ userId: row.user_id, screens })}
                      onReset={() => save.mutate({ userId: row.user_id, screens: null })}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-4 text-[12.5px] text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <p>
            Owners ({owners.map((row) => access.data?.emails.get(row.user_id) ?? row.user_id).join(", ") || "none"})
            always have every screen. Commissions, customer look-up, trial reminders, accounts, cities, services,
            the trade waitlist and this team page are owner-only and cannot be handed out.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** The switches for one person, saved together. */
function ScreenChooser({
  current,
  standard,
  busy,
  onSave,
  onReset,
}: {
  current: string[];
  standard: boolean;
  busy: boolean;
  onSave: (screens: string[]) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(current);
  const changed = !sameList(draft, current);

  function toggle(key: string) {
    setDraft((list) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]));
  }

  return (
    <div className="grid gap-4 border-t border-border bg-muted/20 px-4 py-4">
      {SCREENS.map((group) => {
        const keys = group.items.map((item) => item.key);
        const allOn = keys.every((key) => draft.includes(key));
        return (
          <div key={group.group} className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{group.group}</p>
              <button
                type="button"
                className="text-[12.5px] font-semibold text-primary hover:underline"
                onClick={() =>
                  setDraft((list) =>
                    allOn ? list.filter((key) => !keys.includes(key)) : Array.from(new Set([...list, ...keys])),
                  )
                }
              >
                {allOn ? "Switch the group off" : "Give the whole group"}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => {
                const on = draft.includes(item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggle(item.key)}
                    aria-pressed={on}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-left transition",
                      on ? "border-[#C6DBF4] bg-card" : "border-border opacity-70 hover:opacity-100",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                      )}
                      aria-hidden="true"
                    >
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold">{item.label}</span>
                      <span className="block text-[12.5px] text-muted-foreground">{item.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button size="sm" disabled={busy || !changed} onClick={() => onSave(draft)}>
          {busy ? "Saving…" : "Save access"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || (standard && !changed)}
          onClick={() => {
            setDraft(ALL_KEYS);
            onReset();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Back to standard
        </Button>
        <p className="text-[12.5px] text-muted-foreground">{summary(draft)}</p>
      </div>
    </div>
  );
}
