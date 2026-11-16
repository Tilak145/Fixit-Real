"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, CalendarRange, Check, ClipboardCheck, Copy, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** The screens a task can point at, so the work opens in one click. */
const TASK_SCREENS: { key: string; label: string }[] = [
  { key: "providers", label: "Professionals" },
  { key: "quote_requests", label: "Quote requests" },
  { key: "quotes", label: "Quotes" },
  { key: "appointments", label: "Appointments" },
  { key: "reviews", label: "Reviews" },
  { key: "messages", label: "Messages" },
  { key: "lead_integrity", label: "Lead integrity" },
  { key: "dispatch", label: "Emergency dispatch" },
];

/**
 * The everyday jobs of running the marketplace, one group per screen. Choosing
 * one fills in the task and the screen it is done on; the wording stays editable.
 */
const COMMON_TASKS: { screen: string; group: string; tasks: string[] }[] = [
  {
    screen: "providers",
    group: "Professionals",
    tasks: [
      "Approve the professionals waiting for approval",
      "Check the licence of each new professional",
      "Check the insurance paperwork of each new professional",
      "Check the business registration of each new professional",
      "Make sure every listing has the right trades and cities",
    ],
  },
  {
    screen: "quote_requests",
    group: "Quote requests",
    tasks: [
      "Go through the new customer requests",
      "Follow up requests that have no price from a pro yet",
      "Close requests that are finished or abandoned",
    ],
  },
  {
    screen: "quotes",
    group: "Quotes",
    tasks: [
      "Check the prices professionals sent this week",
      "Look at declined prices and the reasons customers gave",
    ],
  },
  {
    screen: "appointments",
    group: "Appointments",
    tasks: [
      "Check today's scheduled visits",
      "Follow up cancelled visits",
      "Confirm finished visits were marked completed",
    ],
  },
  {
    screen: "reviews",
    group: "Reviews",
    tasks: ["Read the new reviews and flag anything rude or fake"],
  },
  {
    screen: "messages",
    group: "Messages",
    tasks: [
      "Read new conversations and look for problems",
      "Follow up conversations nobody has answered",
    ],
  },
  {
    screen: "lead_integrity",
    group: "Lead integrity",
    tasks: [
      "Decide on the fake or duplicate leads waiting",
      "Decide on the lead disputes professionals raised",
    ],
  },
  {
    screen: "dispatch",
    group: "Emergency dispatch",
    tasks: ["Watch for emergencies and contact the nearest crew"],
  },
];

const SCREEN_LABEL = new Map(TASK_SCREENS.map((screen) => [screen.key, screen.label]));

interface Task {
  id: string;
  title: string;
  details: string | null;
  screen: string | null;
  assigned_to: string;
  due_on: string | null;
  status: "open" | "done";
  done_at: string | null;
  done_note: string | null;
  created_at: string;
}

interface Person {
  user_id: string;
  email: string | null;
  role: "admin" | "manager";
  manages_tasks: boolean;
}

function roleLabel(person: Person): string {
  if (person.role === "admin") return "Owner";
  return person.manages_tasks ? "Manager" : "Staff";
}

const TASK_FIELDS = "id,title,details,screen,assigned_to,due_on,status,done_at,done_note,created_at";

async function loadTasks(): Promise<Task[]> {
  // Row security decides the list: the owner gets everyone's, staff their own.
  const { data, error } = await requireSupabase()
    .from("staff_tasks")
    .select(TASK_FIELDS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as Task[];
}

async function loadPeople(): Promise<Person[]> {
  const { data, error } = await requireSupabase().rpc("staff_task_people");
  if (error) throw new Error(error.message);
  return (data ?? []) as Person[];
}

function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function today(): string {
  return iso(new Date());
}

/** The seven dates of a week, Monday first. 0 is this week, 1 next, -1 last. */
function weekDays(offset: number): string[] {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return iso(day);
  });
}

function dayName(date: string, long = true): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: long ? "long" : "short",
    month: "short",
    day: "numeric",
  });
}

/** Open tasks laid out the way a working week reads. */
function byDay(open: Task[]): { key: string; label: string; tone?: "late" | "today"; tasks: Task[] }[] {
  const now = today();
  const week = weekDays(0);
  const weekEnd = week[6];
  const groups: { key: string; label: string; tone?: "late" | "today"; tasks: Task[] }[] = [
    { key: "late", label: "Overdue", tone: "late", tasks: open.filter((task) => task.due_on && task.due_on < now) },
    ...week
      .filter((date) => date >= now)
      .map((date) => ({
        key: date,
        label: date === now ? `Today · ${dayName(date)}` : dayName(date),
        tone: date === now ? ("today" as const) : undefined,
        tasks: open.filter((task) => task.due_on === date),
      })),
    { key: "later", label: "After this week", tasks: open.filter((task) => task.due_on && task.due_on > weekEnd) },
    { key: "none", label: "No due date", tasks: open.filter((task) => !task.due_on) },
  ];
  return groups.filter((group) => group.tasks.length > 0 || group.tone === "today");
}

function dueLabel(task: Task): { text: string; late: boolean } | null {
  if (!task.due_on) return null;
  const now = today();
  const date = new Date(`${task.due_on}T00:00:00`);
  const text = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (task.status === "done") return { text: `Was due ${text}`, late: false };
  if (task.due_on < now) return { text: `Overdue · was due ${text}`, late: true };
  if (task.due_on === now) return { text: "Due today", late: false };
  return { text: `Due ${text}`, late: false };
}

/** Open tasks first: overdue, then by due date, then the ones with no date. */
function byUrgency(a: Task, b: Task): number {
  if (a.due_on && b.due_on) return a.due_on.localeCompare(b.due_on);
  if (a.due_on) return -1;
  if (b.due_on) return 1;
  return b.created_at.localeCompare(a.created_at);
}

/**
 * Work handed to the people in this dashboard. The owner writes tasks and gives
 * them to a named person; each member of staff sees only their own list and
 * ticks things off. The database holds both rules, not this page.
 */
export function AdminStaffTasks({
  isOwner,
  selfId,
  canOpen,
  onOpenScreen,
}: {
  isOwner: boolean;
  selfId: string | null;
  canOpen: (screen: string) => boolean;
  onOpenScreen: (screen: string) => void;
}) {
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ["admin-staff-tasks"], queryFn: loadTasks });
  // A manager is staff the owner trusts to hand out work; the database decides.
  const power = useQuery({
    queryKey: ["admin-can-assign-tasks", selfId],
    enabled: !isOwner,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc("can_assign_tasks");
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });
  const manages = isOwner || power.data === true;
  const people = useQuery({ queryKey: ["admin-staff-task-people", manages], queryFn: loadPeople, enabled: manages });
  // A task belongs to the person it was given to, so the list opens on your
  // own. Someone who hands out work can switch to the tasks they gave others.
  const [personFilter, setPersonFilter] = useState<string>("mine");
  const [showDone, setShowDone] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-staff-tasks"] });

  const setDone = useMutation({
    mutationFn: async (input: { id: string; done: boolean; note?: string }) => {
      const { error } = await requireSupabase().rpc("set_staff_task_done", {
        p_task_id: input.id,
        p_done: input.done,
        p_note: input.note ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_data, input) => {
      await refresh();
      toast.success(input.done ? "Marked as done" : "Reopened");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().from("staff_tasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Task removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const nameOf = useMemo(() => {
    const emails = new Map((people.data ?? []).map((person) => [person.user_id, person.email]));
    return (userId: string) => (userId === selfId ? "You" : emails.get(userId) ?? "A team member");
  }, [people.data, selfId]);

  const all = tasks.data ?? [];
  const mine = !manages
    ? all
    : personFilter === "all"
      ? all.filter((task) => task.assigned_to !== selfId)
      : all.filter((task) => task.assigned_to === (personFilter === "mine" ? selfId : personFilter));
  const open = mine.filter((task) => task.status === "open").sort(byUrgency);
  const done = mine
    .filter((task) => task.status === "done")
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));
  const now = today();
  const overdue = open.filter((task) => task.due_on && task.due_on < now).length;
  const dueToday = open.filter((task) => task.due_on === now).length;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const doneThisWeek = done.filter((task) => (task.done_at ?? "") >= weekAgo).length;

  return (
    <div className="space-y-6" data-testid="staff-tasks">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Open" value={tasks.data ? open.length : null} hint={dueToday ? `${dueToday} due today` : "Nothing due today"} />
        <Stat label="Overdue" value={tasks.data ? overdue : null} hint="Past the due date" warn={overdue > 0} />
        <Stat label="Done this week" value={tasks.data ? doneThisWeek : null} hint="Finished in the last 7 days" />
      </div>

      {manages ? (
        <WeekPlanner people={people.data ?? []} tasks={all} selfId={selfId} onSaved={refresh} />
      ) : null}

      {manages ? (
        <NewTaskForm
          people={people.data ?? []}
          loadingPeople={people.isPending}
          peopleError={people.error ? (people.error as Error).message : null}
          selfId={selfId}
          onCreated={refresh}
        />
      ) : null}

      {manages && (people.data?.length ?? 0) > 0 ? (
        <PeopleSummary
          people={people.data ?? []}
          tasks={all}
          selfId={selfId}
          selected={personFilter}
          onSelect={setPersonFilter}
        />
      ) : null}

      <Card>
        <CardHeader className="space-y-0 border-b p-5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <CardTitle className="text-base">
                {!manages || personFilter === "mine"
                  ? "Your week"
                  : personFilter === "all"
                    ? "Tasks given to others"
                    : `This week · ${nameOf(personFilter)}`}
              </CardTitle>
              <p className="pt-1 text-[12.5px] text-muted-foreground">
                {manages && personFilter !== "mine"
                  ? "Day by day. Each task is seen only by the person it was given to, and by whoever gave it."
                  : "Day by day. Mark each one done when you finish it."}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.isPending ? (
            <div className="p-5"><LoadingState title="Loading tasks…" /></div>
          ) : tasks.error ? (
            <div className="p-5">
              <ErrorState
                title="Could not load the tasks"
                description={(tasks.error as Error).message}
                actionLabel="Try again"
                onAction={() => void tasks.refetch()}
              />
            </div>
          ) : open.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={manages ? "No open tasks" : "You are all caught up"}
                description={
                  manages
                    ? "Write a task above and give it to someone on the team."
                    : "New tasks from your manager will appear here."
                }
              />
            </div>
          ) : (
            <div>
              {byDay(open).map((group) => (
                <section key={group.key} data-testid="task-day">
                  <h3
                    className={cn(
                      "border-y border-border bg-muted/40 px-5 py-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground",
                      group.tone === "late" && "text-destructive",
                      group.tone === "today" && "bg-primary/10 text-primary",
                    )}
                  >
                    {group.label} · {group.tasks.length}
                  </h3>
                  {group.tasks.length === 0 ? (
                    <p className="px-5 py-3 text-sm text-muted-foreground">Nothing due today.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {group.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          who={manages ? nameOf(task.assigned_to) : null}
                          isOwner={manages}
                          busy={setDone.isPending || remove.isPending}
                          canOpen={canOpen}
                          onOpenScreen={onOpenScreen}
                          onDone={(note) => setDone.mutate({ id: task.id, done: true, note })}
                          onReopen={() => setDone.mutate({ id: task.id, done: false })}
                          onRemove={() => remove.mutate(task.id)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {done.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b p-5">
            <CardTitle className="text-base">Finished · {done.length}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowDone((value) => !value)}>
              {showDone ? "Hide" : "Show"}
            </Button>
          </CardHeader>
          {showDone ? (
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {done.slice(0, 50).map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    who={manages ? nameOf(task.assigned_to) : null}
                    isOwner={manages}
                    busy={setDone.isPending || remove.isPending}
                    canOpen={canOpen}
                    onOpenScreen={onOpenScreen}
                    onDone={(note) => setDone.mutate({ id: task.id, done: true, note })}
                    onReopen={() => setDone.mutate({ id: task.id, done: false })}
                    onRemove={() => remove.mutate(task.id)}
                  />
                ))}
              </ul>
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: number | null; hint: string; warn?: boolean }) {
  return (
    <Card>
      <CardContent className="gap-1 pt-5">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("font-display text-3xl font-semibold tabular-nums", warn && "text-destructive")}>
          {value ?? "—"}
        </p>
        <p className="text-[12.5px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/** One line per person: how much is on their plate and how much they finished. */
function PeopleSummary({
  people,
  tasks,
  selfId,
  selected,
  onSelect,
}: {
  people: Person[];
  tasks: Task[];
  selfId: string | null;
  selected: string;
  onSelect: (userId: string) => void;
}) {
  const now = today();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return (
    <Card>
      <CardHeader className="space-y-0 border-b p-5">
        <CardTitle className="text-base">Workload by person</CardTitle>
        <p className="pt-1 text-[12.5px] text-muted-foreground">Your own tasks, or the ones you gave to someone else.</p>
      </CardHeader>
      <CardContent className="grid gap-2 p-5 sm:grid-cols-2 xl:grid-cols-3">
        <button
          type="button"
          onClick={() => onSelect("mine")}
          aria-pressed={selected === "mine"}
          className={cn(
            "rounded-lg border px-3.5 py-3 text-left transition hover:bg-muted/40",
            selected === "mine" ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <span className="block font-semibold">Your tasks</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {tasks.filter((task) => task.status === "open" && task.assigned_to === selfId).length} open
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelect("all")}
          aria-pressed={selected === "all"}
          className={cn(
            "rounded-lg border px-3.5 py-3 text-left transition hover:bg-muted/40",
            selected === "all" ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <span className="block font-semibold">Given to others</span>
          <span className="block text-[12.5px] text-muted-foreground">
            {tasks.filter((task) => task.status === "open" && task.assigned_to !== selfId).length} open
          </span>
        </button>
        {people.filter((person) => person.user_id !== selfId).map((person) => {
          const theirs = tasks.filter((task) => task.assigned_to === person.user_id);
          const open = theirs.filter((task) => task.status === "open");
          const late = open.filter((task) => task.due_on && task.due_on < now).length;
          const finished = theirs.filter((task) => task.status === "done" && (task.done_at ?? "") >= weekAgo).length;
          return (
            <button
              key={person.user_id}
              type="button"
              onClick={() => onSelect(person.user_id)}
              aria-pressed={selected === person.user_id}
              data-testid="task-person"
              className={cn(
                "rounded-lg border px-3.5 py-3 text-left transition hover:bg-muted/40",
                selected === person.user_id ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <span className="block truncate font-semibold">
                {person.email ?? "A team member"}
                {person.user_id === selfId ? " (you)" : ""}
              </span>
              <span className="block text-[12.5px] text-muted-foreground">
                {roleLabel(person)} · {open.length} open
                {late ? <span className="font-semibold text-destructive"> · {late} overdue</span> : null}
                {" · "}{finished} done this week
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

const FIELD =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function NewTaskForm({
  people,
  loadingPeople,
  peopleError,
  selfId,
  onCreated,
}: {
  people: Person[];
  loadingPeople: boolean;
  peopleError: string | null;
  selfId: string | null;
  onCreated: () => Promise<unknown>;
}) {
  // Several tasks for several people in one go: every task on the list is
  // given to every person ticked.
  const [items, setItems] = useState<{ title: string; screen: string | null }[]>([]);
  const [draft, setDraft] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueOn, setDueOn] = useState("");

  function addItem(title: string, screen: string | null) {
    const clean = title.trim().slice(0, 200);
    if (clean.length < 3) return;
    setItems((list) => (list.some((item) => item.title === clean) ? list : [...list, { title: clean, screen }]));
  }

  function choosePreset(value: string) {
    if (!value) return;
    const [group, index] = value.split(":");
    const found = COMMON_TASKS.find((item) => item.screen === group);
    const text = found?.tasks[Number(index)];
    if (found && text) addItem(text, found.screen);
  }

  function addDraft() {
    addItem(draft, null);
    if (draft.trim().length >= 3) setDraft("");
  }

  // Anything still in the box counts, so nobody loses a task by not pressing Add.
  const typed = draft.trim().length >= 3 && !items.some((item) => item.title === draft.trim());
  const all = typed ? [...items, { title: draft.trim().slice(0, 200), screen: null }] : items;
  const total = all.length * assignees.length;

  const create = useMutation({
    mutationFn: async () => {
      const rows = assignees.flatMap((userId) =>
        all.map((item) => ({ title: item.title, screen: item.screen, assigned_to: userId, due_on: dueOn || null })),
      );
      const { error } = await requireSupabase().from("staff_tasks").insert(rows);
      if (error) throw new Error(error.message);
      return rows.length;
    },
    onSuccess: async (saved) => {
      setItems([]);
      setDraft("");
      await onCreated();
      toast.success(`${saved} task${saved === 1 ? "" : "s"} given`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ready = total > 0 && !create.isPending;
  // Staff first: they are who the work is usually handed to.
  const ordered = [...people].sort((a, b) => (a.role === b.role ? 0 : a.role === "manager" ? -1 : 1));

  return (
    <Card>
      <CardHeader className="space-y-0 border-b p-5">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <CardTitle className="text-base">Give tasks</CardTitle>
            <p className="pt-1 text-[12.5px] text-muted-foreground">
              Add as many tasks as you like, tick everyone who should get them, and give them all at once.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <form
          className="grid gap-4"
          data-testid="new-task-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) create.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="task-preset">What needs doing</Label>
            <select
              id="task-preset"
              data-testid="task-preset"
              value=""
              onChange={(event) => choosePreset(event.target.value)}
              className={FIELD}
            >
              <option value="">Choose a common task to add it to the list</option>
              {COMMON_TASKS.map((item) => (
                <optgroup key={item.screen} label={item.group}>
                  {item.tasks.map((text, index) => (
                    <option key={text} value={`${item.screen}:${index}`} disabled={items.some((added) => added.title === text)}>
                      {text}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-title">Or type your own</Label>
            <div className="flex gap-2">
              <Input
                id="task-title"
                value={draft}
                maxLength={200}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addDraft();
                  }
                }}
                placeholder="Type a task and press Add"
              />
              <Button type="button" variant="outline" className="h-9" disabled={draft.trim().length < 3} onClick={addDraft} data-testid="add-typed-task">
                Add
              </Button>
            </div>
          </div>

          {items.length > 0 ? (
            <ul className="grid gap-1.5 rounded-lg border border-border bg-muted/30 p-3" data-testid="task-list-draft">
              {items.map((item) => (
                <li key={item.title} className="flex items-center justify-between gap-3 rounded-md bg-card px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold">{item.title}</span>
                    {item.screen ? (
                      <span className="block text-[12px] text-muted-foreground">On: {SCREEN_LABEL.get(item.screen) ?? item.screen}</span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Take “${item.title}” off the list`}
                    onClick={() => setItems((list) => list.filter((other) => other.title !== item.title))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label>Give to</Label>
              {ordered.length > 1 ? (
                <button
                  type="button"
                  className="text-[12.5px] font-semibold text-primary hover:underline"
                  onClick={() =>
                    setAssignees(assignees.length === ordered.length ? [] : ordered.map((person) => person.user_id))
                  }
                >
                  {assignees.length === ordered.length ? "Untick everyone" : "Tick everyone"}
                </button>
              ) : null}
            </div>
            {loadingPeople ? <p className="text-sm text-muted-foreground">Loading the team…</p> : null}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {ordered.map((person) => {
                const on = assignees.includes(person.user_id);
                return (
                  <label
                    key={person.user_id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition",
                      on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="checkbox"
                      data-testid="task-assignee"
                      checked={on}
                      onChange={() =>
                        setAssignees((list) =>
                          on ? list.filter((id) => id !== person.user_id) : [...list, person.user_id],
                        )
                      }
                      className="h-4 w-4 accent-[hsl(var(--primary))]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {person.email ?? "A team member"}
                        {person.user_id === selfId ? " (you)" : ""}
                      </span>
                      <span className="block text-[12px] text-muted-foreground">{roleLabel(person)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="task-due">Due (optional, same for all)</Label>
            <Input id="task-due" type="date" value={dueOn} min={today()} onChange={(event) => setDueOn(event.target.value)} />
          </div>

          {peopleError ? <p className="text-sm text-destructive">{peopleError}</p> : null}
          {!loadingPeople && !peopleError && !people.some((person) => person.role === "manager") ? (
            <p className="text-[12.5px] text-muted-foreground">
              There are no staff yet, only owners. Add a member of staff on the Team screen to give them work.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={!ready} data-testid="create-task">
              {create.isPending ? "Saving…" : total === 0 ? "Give tasks" : `Give ${total} task${total === 1 ? "" : "s"}`}
            </Button>
            {all.length > 0 && assignees.length > 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                {all.length} task{all.length === 1 ? "" : "s"} × {assignees.length} {assignees.length === 1 ? "person" : "people"}
              </p>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">Add at least one task and tick at least one person.</p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * A whole week for one person, written in one go: a box per day, one task per
 * line. "Copy last week" brings back what that person had the week before.
 */
function WeekPlanner({
  people,
  tasks,
  selfId,
  onSaved,
}: {
  people: Person[];
  tasks: Task[];
  selfId: string | null;
  onSaved: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [offset, setOffset] = useState(0);
  const [days, setDays] = useState<string[]>(() => Array(7).fill(""));
  const dates = weekDays(offset);
  const now = today();

  const lines = days.map((text) => text.split("\n").map((line) => line.trim()).filter((line) => line.length >= 3));
  const count = lines.reduce((sum, list) => sum + list.length, 0);

  const save = useMutation({
    mutationFn: async () => {
      const rows = lines.flatMap((list, index) =>
        list.map((title) => ({ title: title.slice(0, 200), assigned_to: assignee, due_on: dates[index] })),
      );
      const { error } = await requireSupabase().from("staff_tasks").insert(rows);
      if (error) throw new Error(error.message);
      return rows.length;
    },
    onSuccess: async (saved) => {
      setDays(Array(7).fill(""));
      await onSaved();
      toast.success(`${saved} task${saved === 1 ? "" : "s"} added to the week`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function copyLastWeek() {
    const before = weekDays(offset - 1);
    const copied = before.map((date) =>
      tasks
        .filter((task) => task.assigned_to === assignee && task.due_on === date)
        .map((task) => task.title)
        .join("\n"),
    );
    if (copied.every((text) => !text)) {
      toast.error("That person had no tasks the week before.");
      return;
    }
    setDays(copied);
  }

  const ordered = [...people].sort((a, b) => (a.role === b.role ? 0 : a.role === "manager" ? -1 : 1));

  return (
    <Card data-testid="week-planner">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b p-5">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <CardTitle className="text-base">Plan someone&apos;s week</CardTitle>
            <p className="pt-1 text-[12.5px] text-muted-foreground">
              Write what they need to do each day, one task per line, and save the whole week at once.
            </p>
          </div>
        </div>
        <Button variant={open ? "outline" : "default"} size="sm" onClick={() => setOpen((value) => !value)} data-testid="open-week-planner">
          {open ? "Close" : "Plan a week"}
        </Button>
      </CardHeader>
      {open ? (
        <CardContent className="grid gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="week-person">Who</Label>
              <select id="week-person" value={assignee} onChange={(event) => setAssignee(event.target.value)} className={FIELD}>
                <option value="">Choose a person</option>
                {ordered.map((person) => (
                  <option key={person.user_id} value={person.user_id}>
                    {person.email ?? "A team member"}
                    {person.user_id === selfId ? " (you)" : ""} · {roleLabel(person)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="week-which">Which week</Label>
              <select id="week-which" value={offset} onChange={(event) => setOffset(Number(event.target.value))} className={FIELD}>
                {[0, 1, 2].map((value) => {
                  const span = weekDays(value);
                  const name = value === 0 ? "This week" : value === 1 ? "Next week" : "The week after";
                  return (
                    <option key={value} value={value}>
                      {name} ({dayName(span[0], false)} to {dayName(span[6], false)})
                    </option>
                  );
                })}
              </select>
            </div>
            <Button type="button" variant="outline" disabled={!assignee} onClick={copyLastWeek} data-testid="copy-last-week">
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy the week before
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DAY_NAMES.map((name, index) => {
              const past = dates[index] < now;
              return (
                <div key={name} className={cn("grid gap-1.5", past && "opacity-60")}>
                  <Label htmlFor={`week-day-${index}`}>
                    {name} <span className="font-normal text-muted-foreground">· {dayName(dates[index], false).split(", ")[1] ?? ""}</span>
                  </Label>
                  <textarea
                    id={`week-day-${index}`}
                    data-testid="week-day"
                    rows={4}
                    value={days[index]}
                    disabled={past}
                    onChange={(event) =>
                      setDays((current) => current.map((text, at) => (at === index ? event.target.value : text)))
                    }
                    className={cn(FIELD, "h-auto py-2")}
                    placeholder={past ? "Already passed" : "One task per line"}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={!assignee || count === 0 || save.isPending}
              onClick={() => save.mutate()}
              data-testid="save-week"
            >
              {save.isPending ? "Saving…" : count === 0 ? "Save the week" : `Save ${count} task${count === 1 ? "" : "s"}`}
            </Button>
            <p className="text-[12.5px] text-muted-foreground">Each line becomes one task, due on that day.</p>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function TaskRow({  task,
  who,
  isOwner,
  busy,
  canOpen,
  onOpenScreen,
  onDone,
  onReopen,
  onRemove,
}: {
  task: Task;
  who: string | null;
  isOwner: boolean;
  busy: boolean;
  canOpen: (screen: string) => boolean;
  onOpenScreen: (screen: string) => void;
  onDone: (note: string) => void;
  onReopen: () => void;
  onRemove: () => void;
}) {
  const [finishing, setFinishing] = useState(false);
  const [note, setNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const due = dueLabel(task);
  const isDone = task.status === "done";
  const screenLabel = task.screen ? SCREEN_LABEL.get(task.screen) ?? null : null;

  return (
    <li className="grid gap-3 px-5 py-4" data-testid="task-row">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold", isDone && "text-muted-foreground line-through")}>{task.title}</p>
          {task.details ? <p className="whitespace-pre-wrap pt-1 text-sm text-muted-foreground">{task.details}</p> : null}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-[12.5px] text-muted-foreground">
            {who ? <span>For: <span className="font-semibold text-foreground/80">{who}</span></span> : null}
            {due ? (
              <span className={cn("inline-flex items-center gap-1", due.late && "font-semibold text-destructive")}>
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {due.text}
              </span>
            ) : null}
            {isDone && task.done_at ? <span>Finished {new Date(task.done_at).toLocaleString()}</span> : null}
          </p>
          {isDone && task.done_note ? (
            <p className="pt-1.5 text-sm" data-testid="task-done-note">Note: “{task.done_note}”</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {task.screen && screenLabel && canOpen(task.screen) && !isDone ? (
            <Button variant="outline" size="sm" onClick={() => onOpenScreen(task.screen!)}>
              Open {screenLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null}
          {isDone ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={onReopen}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Reopen
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={() => setFinishing((value) => !value)} data-testid="finish-task">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Mark done
            </Button>
          )}
          {isOwner ? (
            confirmRemove ? (
              <>
                <Button variant="destructive" size="sm" disabled={busy} onClick={onRemove}>Remove</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>Keep</Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" aria-label="Remove this task" onClick={() => setConfirmRemove(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            )
          ) : null}
        </div>
      </div>
      {finishing && !isDone ? (
        <form
          className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            onDone(note);
            setFinishing(false);
          }}
        >
          <Input
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What you did (optional)"
            aria-label="A note about what you did"
            data-testid="task-note"
          />
          <Button type="submit" size="sm" className="h-10" disabled={busy} data-testid="confirm-task-done">
            Confirm done
          </Button>
        </form>
      ) : null}
    </li>
  );
}
