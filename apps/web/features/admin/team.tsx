"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Mail, ShieldCheck, UserCog, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { requireSupabase } from "@/lib/supabase";
import { StatusPill } from "./ui";

type Role = "admin" | "manager";

interface TeamMember {
  user_id: string;
  role: Role;
  created_at: string;
  email: string | null;
}

interface DirectoryAccount {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const ROLE_LABEL: Record<Role, string> = { admin: "Owner", manager: "Staff" };
const ROLE_HINT: Record<Role, string> = {
  admin: "Owner: full access, including who works here, commissions, mail and every account",
  manager: "Staff: exactly the screens you switch on below",
};

function day(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function initials(email: string | null): string {
  const name = (email ?? "").split("@")[0] ?? "";
  return name.split(/[._-]/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/** A role is a capability, so it reads as a pill: owner is the stronger one. */
function RolePill({ role }: { role: Role }) {
  return (
    <span
      className={
        role === "admin"
          ? "inline-flex items-center gap-1.5 rounded-full border border-[#C6DBF4] bg-[#E9F1FB] px-2.5 py-0.5 text-[12px] font-semibold text-[#1565C0]"
          : "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[12px] font-semibold text-muted-foreground"
      }
    >
      {role === "admin" ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <UserCog className="h-3.5 w-3.5" aria-hidden="true" />}
      {ROLE_LABEL[role]}
    </span>
  );
}

async function members(): Promise<TeamMember[]> {
  // The roles table is readable only by the owner, through a function that says
  // so in its own words rather than making the page guess.
  const { data, error } = await requireSupabase().rpc("admin_team_roles");
  if (error) throw new Error(error.message);

  // app_roles holds ids and roles only; the emails come from the directory
  // lookup, which the owner alone may call.
  const { data: people, error: peopleError } = await requireSupabase().rpc("admin_search_accounts", {
    term: "",
    max_rows: 50,
  });
  if (peopleError) throw new Error(peopleError.message);
  const emailById = new Map(
    ((people ?? []) as DirectoryAccount[]).map((person) => [person.user_id, person.email]),
  );
  return ((data ?? []) as TeamMember[]).map((member) => ({
    ...member,
    email: emailById.get(member.user_id) ?? null,
  }));
}

/** Accounts the database will never let anyone demote or remove. */
async function protectedOwners(): Promise<Set<string>> {
  const { data, error } = await requireSupabase().rpc("protected_owner_ids");
  if (error) throw new Error(error.message);
  return new Set((data ?? []) as string[]);
}

async function directory(term: string): Promise<DirectoryAccount[]> {
  const { data, error } = await requireSupabase().rpc("admin_search_accounts", {
    term,
    max_rows: 20,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as DirectoryAccount[];
}

/**
 * Who works in the dashboard, and as what. Only an owner may change this, and
 * the database enforces that: the page just fails loudly if it is wrong.
 */
export function AdminTeam({ selfId }: { selfId: string | null }) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [applied, setApplied] = useState("");

  const team = useQuery({ queryKey: ["admin-team"], queryFn: members });
  const locked = useQuery({ queryKey: ["admin-protected-owner"], queryFn: protectedOwners });
  const people = useQuery({
    queryKey: ["admin-directory", applied],
    queryFn: () => directory(applied),
  });

  // Adding someone changes both lists: the team grows and they vanish from the
  // candidates, so refresh the directory as well as the team.
  const saved = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-team"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-directory"] });
  };

  const add = useMutation({
    mutationFn: async (input: { userId: string; role: Role }) => {
      const { error } = await requireSupabase().rpc("add_team_member", {
        p_user_id: input.userId,
        p_role: input.role,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await saved();
      toast.success("Added to the team");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setRole = useMutation({
    mutationFn: async (input: { userId: string; role: Role }) => {
      const { error } = await requireSupabase().rpc("set_team_role", {
        p_user_id: input.userId,
        p_role: input.role,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await saved();
      toast.success("Access updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await requireSupabase().rpc("remove_team_member", { p_user_id: userId });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await saved();
      toast.success("Access removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const owners = (team.data ?? []).filter((member) => member.role === "admin").length;
  const memberIds = useMemo(() => new Set((team.data ?? []).map((member) => member.user_id)), [team.data]);
  const candidates = (people.data ?? []).filter((person) => !memberIds.has(person.user_id));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="gap-1 pt-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">People with access</p>
            <p className="font-display text-3xl font-semibold tabular-nums">{team.data?.length ?? "—"}</p>
            <p className="text-[12.5px] text-muted-foreground">Sign in at this dashboard</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-1 pt-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Owners</p>
            <p className="font-display text-3xl font-semibold tabular-nums">{team.data ? owners : "—"}</p>
            <p className="text-[12.5px] text-muted-foreground">Can change the team</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="gap-1 pt-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">Staff</p>
            <p className="font-display text-3xl font-semibold tabular-nums">{team.data ? (team.data.length - owners) : "—"}</p>
            <p className="text-[12.5px] text-muted-foreground">Run the marketplace</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b p-5">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <CardTitle className="text-base">Your team</CardTitle>
              <p className="pt-1 text-[12.5px] text-muted-foreground">
                Everyone here signs in with their own FixIt account.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {team.isPending ? (
            <div className="p-5"><LoadingState title="Loading the team…" /></div>
          ) : team.error ? (
            <div className="p-5">
              <ErrorState
                title="Could not load the team"
                description={(team.error as Error).message}
                actionLabel="Try again"
                onAction={() => void team.refetch()}
              />
            </div>
          ) : (team.data ?? []).length === 0 ? (
            <div className="p-5">
              <EmptyState title="No team members yet" description="Add someone below to give them access." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[12px] font-bold uppercase tracking-wide">Person</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wide">Access</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wide">Added</TableHead>
                    <TableHead className="w-[1%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(team.data ?? []).map((member) => {
                    const isSelf = member.user_id === selfId;
                    const isLocked = locked.data?.has(member.user_id) ?? false;
                    return (
                      <TableRow key={member.user_id}>
                        <TableCell>
                          <span className="flex items-center gap-2.5">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E9F1FB] text-[12px] font-bold text-[#1565C0]">
                              {initials(member.email)}
                            </span>
                            <span className="min-w-0">
                              <span className="block max-w-[18rem] truncate font-semibold">
                                {member.email ?? member.user_id}
                              </span>
                              {isSelf ? (
                                <span className="text-[12px] text-muted-foreground">That is you</span>
                              ) : null}
                              {isLocked ? (
                                <span className="flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
                                  <Lock className="h-3 w-3" aria-hidden="true" />
                                  Protected owner: this access cannot be changed
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <RolePill role={member.role} />
                          <span className="block pt-1 text-[12px] text-muted-foreground">
                            {ROLE_HINT[member.role]}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">
                          {day(member.created_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={setRole.isPending || isSelf || isLocked}
                            title={isLocked ? "The protected owner always keeps owner access" : undefined}
                            onClick={() =>
                              setRole.mutate({
                                userId: member.user_id,
                                role: member.role === "admin" ? "manager" : "admin",
                              })
                            }
                          >
                            {member.role === "admin" ? "Make staff" : "Make owner"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-1 text-destructive hover:text-destructive"
                            disabled={remove.isPending || isSelf || isLocked || (member.role === "admin" && owners === 1)}
                            title={isLocked ? "The protected owner cannot be removed" : undefined}
                            onClick={() => {
                              if (!window.confirm("Remove this person's dashboard access?")) return;
                              remove.mutate(member.user_id);
                            }}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="border-t px-5 py-3 text-[12.5px] text-muted-foreground">
            The last owner cannot be removed or demoted, and the protected owner always keeps full access — the database
            refuses both, whoever asks.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-0 border-b p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <CardTitle className="text-base">Add someone</CardTitle>
              <p className="pt-1 text-[12.5px] text-muted-foreground">
                They need a FixIt account first — the one they registered with. Search for it here.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="gap-4 p-5">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(term.trim());
            }}
          >
            <div className="grid flex-1 gap-2 sm:max-w-sm">
              <Label htmlFor="team-search">Search by email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="team-search"
                  value={term}
                  placeholder="name@example.com"
                  className="h-10 pl-8"
                  onChange={(event) => setTerm(event.target.value)}
                />
              </div>
            </div>
            <Button type="submit" variant="outline" className="h-10">Search accounts</Button>
          </form>

          {people.isPending ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : people.error ? (
            <p role="alert" className="text-sm text-destructive">
              {(people.error as Error).message}
            </p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {applied
                ? `No account matching “${applied}” that is not already on the team.`
                : "No other accounts yet. They can register on the site first."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-[12px] font-bold uppercase tracking-wide">Account</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wide">Joined</TableHead>
                    <TableHead className="text-[12px] font-bold uppercase tracking-wide">Last seen</TableHead>
                    <TableHead className="w-[1%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((person) => (
                    <TableRow key={person.user_id}>
                      <TableCell className="max-w-[20rem] truncate font-semibold">{person.email ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">{day(person.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">{day(person.last_sign_in_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Button
                          size="sm"
                          disabled={add.isPending}
                          onClick={() => add.mutate({ userId: person.user_id, role: "manager" })}
                        >
                          Add as staff
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-1"
                          disabled={add.isPending}
                          onClick={() => add.mutate({ userId: person.user_id, role: "admin" })}
                        >
                          Add as owner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold">
              <StatusPill value="active" />
              Staff run the marketplace; owners also manage the team.
            </p>
            <p className="pt-1.5 text-[12.5px] text-muted-foreground">
              Give owner access only to people who should also be able to add or remove others.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
