"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Check, Copy } from "lucide-react";
import { getMyAvailability, saveMyAvailability } from "@/lib/fixit";
import {
  describeWeek,
  formatMinute,
  isOpenAt,
  minuteToTimeValue,
  timeValueToMinute,
  validateWindow,
  weekGrid,
  type AvailabilityWindow,
} from "@/lib/fixit-availability";

/**
 * The professional's week, edited as a calendar: for each day, whether they
 * work and between which hours. Saving the week is also what controls whether
 * emergency requests are offered to them, so the opt-in sits right beside the
 * hours it depends on.
 */
export function AvailabilityCalendar({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const availability = useQuery({ queryKey: ["my-availability"], queryFn: getMyAvailability });
  const [draft, setDraft] = useState<AvailabilityWindow[] | null>(null);
  const [acceptsEmergency, setAcceptsEmergency] = useState<boolean | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const windows = draft ?? availability.data?.windows ?? [];
  const emergency = acceptsEmergency ?? availability.data?.acceptsEmergency ?? false;
  const grid = weekGrid(windows);
  const now = new Date();
  const openNow = isOpenAt(windows, now);

  const save = useMutation({
    mutationFn: saveMyAvailability,
    onSuccess: async () => {
      setMessage({ kind: "ok", text: "Your hours are saved." });
      setDraft(null);
      setAcceptsEmergency(null);
      await queryClient.invalidateQueries({ queryKey: ["my-availability"] });
    },
    onError: (error: Error) => setMessage({ kind: "error", text: error.message }),
  });

  function updateWindow(weekday: number, patch: Partial<AvailabilityWindow>) {
    const current = windows.find((w) => w.weekday === weekday);
    const next = current
      ? { ...current, ...patch }
      : { weekday, startMinute: 9 * 60, endMinute: 17 * 60, ...patch };
    setDraft([...windows.filter((w) => w.weekday !== weekday), next].sort((a, b) => a.weekday - b.weekday));
    setMessage(null);
  }

  function removeWindow(weekday: number) {
    setDraft(windows.filter((w) => w.weekday !== weekday));
    setMessage(null);
  }

  function copyToWeekdays() {
    const source = windows.find((w) => w.weekday >= 1 && w.weekday <= 5) ?? windows[0];
    if (!source) return;
    const weekdayWindows = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      startMinute: source.startMinute,
      endMinute: source.endMinute,
    }));
    const weekend = windows.filter((w) => w.weekday === 0 || w.weekday === 6);
    setDraft([...weekdayWindows, ...weekend].sort((a, b) => a.weekday - b.weekday));
    setMessage(null);
  }

  if (availability.isPending) {
    return <p className="text-sm text-muted-foreground">Loading your hours…</p>;
  }
  if (availability.isError) {
    return <p className="text-sm text-destructive">We could not load your hours. Refresh to try again.</p>;
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-[13px] font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
            {describeWeek(windows)}
          </span>
          <span
            className={
              "rounded-full px-3 py-1.5 text-[12px] font-bold " +
              (openNow ? "bg-[#E6F4EA] text-[#2E9E4F]" : "bg-muted text-muted-foreground")
            }
          >
            {openNow ? "Open now" : "Closed now"}
          </span>
        </div>
      )}

      <ul className="divide-y divide-border rounded-xl border border-border">
        {grid.map((day) => {
          const on = Boolean(day.window);
          const invalid =
            day.window && validateWindow(day.window.startMinute, day.window.endMinute) ? true : false;
          return (
            <li key={day.weekday} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <label className="flex min-w-[132px] items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(event) =>
                    event.target.checked ? updateWindow(day.weekday, {}) : removeWindow(day.weekday)
                  }
                  className="h-4 w-4"
                  aria-label={"Work on " + day.label}
                  data-testid={"availability-day-" + day.weekday}
                />
                <span className="text-[13.5px] font-semibold">{day.label}</span>
              </label>
              {on && day.window ? (
                <span className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    value={minuteToTimeValue(day.window.startMinute)}
                    onChange={(event) => {
                      const minute = timeValueToMinute(event.target.value);
                      if (minute !== null) updateWindow(day.weekday, { startMinute: minute });
                    }}
                    className="h-[38px] rounded-md border border-input bg-input px-2.5 text-sm outline-none ring-ring focus:ring-2"
                    aria-label={day.label + " start time"}
                  />
                  <span className="text-[12.5px] text-muted-foreground">to</span>
                  <input
                    type="time"
                    value={minuteToTimeValue(day.window.endMinute)}
                    onChange={(event) => {
                      const minute = timeValueToMinute(event.target.value);
                      if (minute !== null) updateWindow(day.weekday, { endMinute: minute });
                    }}
                    className="h-[38px] rounded-md border border-input bg-input px-2.5 text-sm outline-none ring-ring focus:ring-2"
                    aria-label={day.label + " end time"}
                  />
                  <span className="text-[12.5px] text-muted-foreground">
                    {formatMinute(day.window.startMinute)}–{formatMinute(day.window.endMinute)}
                  </span>
                  {invalid ? (
                    <span className="text-[12px] font-semibold text-[#C0392B]">
                      End must be after start
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-[12.5px] text-muted-foreground">Day off</span>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={copyToWeekdays}
        data-testid="copy-weekdays"
        className="inline-flex h-[38px] items-center gap-2 rounded-md border border-border px-3.5 text-[13px] font-bold text-foreground/70 hover:border-primary hover:text-primary"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy these hours to Mon–Fri
      </button>

      <label
        className={
          "flex cursor-pointer items-start gap-3 rounded-xl border p-4 " +
          (emergency ? "border-[#E8A0A0] bg-[#FDECEA]" : "border-border bg-muted/40")
        }
      >
        <input
          type="checkbox"
          checked={emergency}
          onChange={(event) => {
            setAcceptsEmergency(event.target.checked);
            setMessage(null);
          }}
          className="mt-0.5 h-4 w-4 flex-none"
          data-testid="emergency-optin"
        />
        <span>
          <span className="flex items-center gap-1.5 text-[13.5px] font-bold">
            <AlertTriangle className="h-4 w-4 text-[#C0392B]" aria-hidden="true" />
            Send me emergency requests
          </span>
          <span className="mt-0.5 block text-[12px] text-muted-foreground">
            Emergency jobs — a burst pipe, a water leak, no heat — go only to professionals who
            turn this on. Leave it off and you still receive every normal request in your area.
          </span>
        </span>
      </label>

      <p className="rounded-md bg-muted/50 px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
        Need to stop new leads today without changing your week? Use{" "}
        <strong className="font-bold text-foreground/80">Pause new leads</strong> at the top of the
        dashboard. It takes effect immediately and your hours here stay as they are.
      </p>

      {message ? (
        <p
          className={
            "text-[13px] " + (message.kind === "ok" ? "text-[#2E9E4F]" : "text-[#D93025]")
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            save.mutate({
              acceptsEmergency: emergency,
              // The switch is not edited here, so it is carried through
              // unchanged: saving the week must never quietly re-open a pro
              // who has paused new leads.
              acceptingWork: availability.data?.acceptingWork ?? true,
              windows,
            })
          }
          disabled={save.isPending || !draft && acceptsEmergency === null}
          data-testid="save-hours"
          className="inline-flex h-[40px] items-center gap-2 rounded-md bg-primary px-4 text-[13.5px] font-bold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {save.isPending ? "Saving…" : "Save hours"}
        </button>
        {draft || acceptsEmergency !== null ? (
          <span className="text-[12.5px] text-muted-foreground">
            You have unsaved changes.
          </span>
        ) : null}
      </div>
    </div>
  );
}

