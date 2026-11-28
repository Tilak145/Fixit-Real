"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";

interface Account {
  id: string;
  name: string;
  kind: "landlord" | "company";
  status: "pending" | "approved" | "rejected";
  phone: string | null;
  owner_email: string | null;
  created_at: string;
  properties: number;
  units: number;
  requests: number;
  open_requests: number;
}

const STATUS = {
  pending: { label: "Waiting for you", className: "bg-[#FFF4E5] text-[#8A4B00]" },
  approved: { label: "Can send jobs", className: "bg-[#E6F4EA] text-[#136C34]" },
  rejected: { label: "Cannot send jobs", className: "bg-[#FDE7E7] text-[#B42318]" },
};

async function accounts(): Promise<Account[]> {
  const { data, error } = await requireSupabase().rpc("admin_property_accounts");
  if (error) throw new Error(error.message);
  return (data ?? []) as Account[];
}

/**
 * Landlords and property managers: how many there are, how busy, and the
 * owner's decision on which may send jobs to professionals. Companies wait for
 * that decision; landlords may send from the start and can be stopped here.
 */
export function AdminPropertyAccounts() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["admin-property-accounts"], queryFn: accounts, refetchInterval: 60_000 });
  const decide = useMutation({
    mutationFn: async (input: { id: string; status: Account["status"] }) => {
      const { error } = await requireSupabase().rpc("decide_organization", { p_org: input.id, p_status: input.status });
      if (error) throw new Error(error.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-property-accounts"] }),
  });

  if (list.isPending) return <LoadingState title="Loading property accounts…" />;
  if (list.isError) {
    return <ErrorState title="Could not load property accounts" description={(list.error as Error).message} />;
  }
  const rows = list.data;
  const sum = (key: "properties" | "units" | "requests" | "open_requests") => rows.reduce((total, row) => total + row[key], 0);
  const counts = [
    { label: "Landlords", value: rows.filter((row) => row.kind === "landlord").length },
    { label: "Property managers", value: rows.filter((row) => row.kind === "company").length },
    { label: "Waiting for approval", value: rows.filter((row) => row.status === "pending").length },
    { label: "Properties", value: sum("properties") },
    { label: "Units", value: sum("units") },
    { label: "Repair requests", value: sum("requests") },
    { label: "Open now", value: sum("open_requests") },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {counts.map((count) => (
          <Card key={count.label}>
            <CardContent className="p-4">
              <div className="font-display text-2xl font-semibold tabular-nums">{count.value}</div>
              <div className="text-[12.5px] text-muted-foreground">{count.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {decide.isError ? <p role="alert" className="text-sm text-destructive">{(decide.error as Error).message}</p> : null}

      {rows.length === 0 ? (
        <EmptyState title="No property accounts yet" description="Landlords and property managers appear here after they set up an account." />
      ) : (
        <ul className="grid gap-3">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <strong className="break-words font-display text-[16px]">{row.name}</strong>
                  <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-bold ${STATUS[row.status].className}`}>{STATUS[row.status].label}</span>
                </p>
                <p className="break-words text-[13px] text-muted-foreground">
                  {row.kind === "company" ? "Property manager" : "Landlord"} • {row.owner_email ?? "no email"}
                  {row.phone ? ` • ${row.phone}` : ""} • joined {new Date(row.created_at).toLocaleDateString("en-US")}
                </p>
                <p className="text-[13px] text-muted-foreground">
                  {row.properties} properties • {row.units} units • {row.requests} requests ({row.open_requests} open)
                </p>
              </div>
              <div className="flex gap-2">
                {row.status !== "approved" ? (
                  <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, status: "approved" })}>
                    Approve
                  </Button>
                ) : null}
                {row.status !== "rejected" ? (
                  <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: row.id, status: "rejected" })}>
                    {row.status === "pending" ? "Decline" : "Stop sending jobs"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12.5px] text-muted-foreground">
        Stopping an account does not recall jobs it has already sent. The account owner is emailed when you decide.
      </p>
    </div>
  );
}
