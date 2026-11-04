"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";

interface Account {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  blocked: boolean;
}

function day(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

/** The client reports a generic failure; the function's own reason is in the response. */
async function callAdminAccounts<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase()
    .functions.invoke("admin-accounts", { body });
  if (!error) return data as T;
  const response = (error as { context?: Response }).context;
  const detail = await response?.json?.().catch(() => null) as { error?: string } | null;
  throw new Error(detail?.error ?? error.message);
}

export function AdminAccounts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);

  const accounts = useQuery({
    queryKey: ["admin-accounts", applied, page],
    queryFn: () =>
      callAdminAccounts<{ accounts: Account[]; hasMore?: boolean; truncated?: boolean }>({
        action: "list",
        search: applied,
        page,
      }),
  });
  const rows = accounts.data?.accounts ?? [];

  const block = useMutation({
    mutationFn: (input: { id: string; blocked: boolean }) =>
      callAdminAccounts<{ ok: true }>({
        action: "block",
        accountId: input.id,
        blocked: input.blocked,
      }),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-accounts"] });
      toast.success(input.blocked ? "Account blocked" : "Account unblocked");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // The same recovery email the sign-in page sends: only the account holder can
  // finish it, so no administrator ever handles someone else's password.
  const reset = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: new URL("/reset-password", window.location.origin).href,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => toast.success("Password reset email sent"),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Accounts</CardTitle>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied(search.trim());
            setPage(1);
          }}
        >
          <Input
            value={search}
            placeholder="Search by email"
            className="h-9 w-56"
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" size="sm" variant="outline">Search</Button>
        </form>
      </CardHeader>
      <CardContent>
        {accounts.isPending ? (
          <LoadingState title="Loading accounts…" />
        ) : accounts.error ? (
          <ErrorState
            title="Could not load accounts"
            description={(accounts.error as Error).message}
            actionLabel="Try again"
            onAction={() => void accounts.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={applied ? "No matching accounts" : page > 1 ? "No more accounts" : "No accounts"}
            description={
              applied
                ? `Nothing matches “${applied}”.`
                : page > 1
                  ? "This is past the last page."
                  : "Nobody has signed up yet."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[1%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="max-w-[18rem] truncate">{account.email ?? "—"}</TableCell>
                    <TableCell>{day(account.created_at)}</TableCell>
                    <TableCell>{day(account.last_sign_in_at)}</TableCell>
                    <TableCell>{account.blocked ? "Blocked" : "Active"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!account.email || reset.isPending}
                        onClick={() => account.email && reset.mutate(account.email)}
                      >
                        Send reset
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={block.isPending}
                        onClick={() => {
                          if (!account.blocked && !window.confirm("Block this account?")) return;
                          block.mutate({ id: account.id, blocked: !account.blocked });
                        }}
                      >
                        {account.blocked ? "Unblock" : "Block"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {applied && accounts.data?.truncated && (
          <p className="pt-4 text-sm text-muted-foreground">
            Too many accounts to search all of them. Narrow the search.
          </p>
        )}

        {/* A search returns every match at once; only the plain list pages. */}
        {!applied && (page > 1 || accounts.data?.hasMore) && (
          <div className="flex items-center justify-end gap-2 pt-4">
            <span className="mr-auto text-sm text-muted-foreground">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1 || accounts.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!accounts.data?.hasMore || accounts.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
