"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";
import { humanize } from "./ui";

interface Entry {
  id: number;
  table_name: string;
  action: "insert" | "update" | "delete";
  row_id: string | null;
  actor_email: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

const ACTION_TONE: Record<Entry["action"], "default" | "secondary" | "destructive"> = {
  insert: "default",
  update: "secondary",
  delete: "destructive",
};

const PAGE = 30;

function moment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

/** The one line that says what changed, drawn from the change itself. */
function describe(entry: Entry): string {
  const detail = entry.detail ?? {};
  const name =
    detail.business_name ?? detail.name ?? detail.title ?? detail.author_name ??
    detail.customer_name ?? detail.category_slug ?? detail.slug;
  const subject = typeof name === "string" && name ? name : entry.row_id ?? "a record";
  return `${humanize(entry.action === "insert" ? "added" : entry.action === "delete" ? "removed" : "changed")} ${subject}`;
}

async function entries(): Promise<Entry[]> {
  const { data, error } = await requireSupabase()
    .from("activity_log")
    .select("id,table_name,action,row_id,actor_email,detail,created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as Entry[];
}

/**
 * A record of every change made from the dashboard — or anywhere — so a team
 * can see who did what without asking around. The database writes these rows
 * itself (see migration 0012), and nothing in the app may edit them.
 */
export function AdminActivity() {
  const log = useQuery({ queryKey: ["admin-activity"], queryFn: entries });
  const [term, setTerm] = useState("");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const all = log.data ?? [];
    if (!needle) return all;
    return all.filter((entry) =>
      [entry.table_name, entry.action, entry.actor_email ?? "", entry.row_id ?? "", describe(entry)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [log.data, term]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <CardTitle className="text-base">Activity</CardTitle>
              <p className="pt-1 text-[12.5px] text-muted-foreground">
                Who changed what, newest first.
              </p>
            </div>
          </div>
          <Input
            value={term}
            onChange={(event) => { setTerm(event.target.value); setShown(PAGE); }}
            placeholder="Search the log…"
            aria-label="Search the activity log"
            className="h-9 w-full sm:w-56"
          />
        </CardHeader>
        <CardContent className="p-0">
          {log.isPending ? (
            <div className="border-0 p-5"><LoadingState title="Loading the log…" /></div>
          ) : log.error ? (
            <div className="p-5">
              <ErrorState
                title="Could not load the activity log"
                description={(log.error as Error).message}
                actionLabel="Try again"
                onAction={() => void log.refetch()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={term ? "Nothing matches that search" : "No activity yet"}
                description={term ? `Nothing in the log mentions “${term}”.` : "Changes made here will appear as they happen."}
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {filtered.slice(0, shown).map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 px-5 py-3.5">
                    <Badge variant={ACTION_TONE[entry.action]} className="mt-0.5 shrink-0 capitalize">
                      {entry.action}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{describe(entry)}</span>
                        <span className="text-muted-foreground"> in {humanize(entry.table_name)}</span>
                      </p>
                      <p className="truncate pt-0.5 text-[12.5px] text-muted-foreground">
                        {entry.actor_email ?? "Unknown person"} · {moment(entry.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {filtered.length > shown ? (
                <div className="border-t px-5 py-3">
                  <Button variant="outline" size="sm" onClick={() => setShown((current) => current + PAGE)}>
                    Show more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
