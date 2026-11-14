"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowRight, ChevronDown, MapPin, Search } from "lucide-react";
import { QuoteRequestForm } from "@/components/fixit/request-quote";

/**
 * The home page's search, which opens the full request form in place.
 *
 * "Find a Professional" used to send the visitor to /request and lose the page
 * they were reading. Now the same form opens as a panel for that job and city
 * or service, so posting a job happens without leaving the home page. The
 * address bar is not touched; the full page at /request still exists for links.
 */
export function HeroSearch({
  cities,
  chosenCity,
}: {
  cities: Array<{ label: string }>;
  chosenCity: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState("");
  const [city, setCity] = useState(chosenCity ?? cities[0]?.label ?? "");
  const [service, setService] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  // The form only reads these once, when it opens. A stable function keeps it
  // from re-initialising on every keystroke behind the panel.
  const fromLink = useCallback(
    (key: string) => {
      if (key === "job") return job;
      if (key === "city") return city;
      if (key === "service") return service;
      return null;
    },
    [job, city, service],
  );

  function close() {
    setOpen(false);
    window.setTimeout(() => firstField.current?.focus(), 0);
  }

  return (
    <>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const words = job.toLowerCase();
          const found = [
            ["plumb", "plumbing"],
            ["leak", "plumbing"],
            ["faucet", "plumbing"],
            ["toilet", "plumbing"],
            ["drain", "plumbing"],
            ["heat", "hvac"],
            ["air", "hvac"],
            ["furnace", "hvac"],
            ["electric", "electrical"],
            ["outlet", "electrical"],
            ["light", "electrical"],
            ["garage", "garage-doors"],
            ["roof", "roofing"],
            ["clean", "cleaning"],
            ["pest", "pest-control"],
            ["lawn", "landscaping"],
          ].find(([word]) => words.includes(word));
          setService(found ? found[1] : null);
          setOpen(true);
        }}
      >
        <div>
          <label htmlFor="hero-job" className="mb-1.5 block text-[13px] font-bold text-foreground/80">
            What do you need help with?
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-[13px] h-[18px] w-[18px] text-muted-foreground" aria-hidden="true" />
            <input
              ref={firstField}
              id="hero-job"
              name="job"
              type="text"
              value={job}
              onChange={(event) => setJob(event.target.value)}
              placeholder="Leaky faucet, stuck garage door…"
              className="h-11 w-full rounded-md border border-border bg-input px-3.5 pl-10 text-[15px] outline-none ring-ring focus:ring-2"
            />
          </div>
        </div>
        <div>
          <label htmlFor="hero-loc" className="mb-1.5 block text-[13px] font-bold text-foreground/80">
            Where is the job?
          </label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3.5 top-[13px] h-[18px] w-[18px] text-accent" aria-hidden="true" />
            {cities.length > 0 ? (
              <>
                <select
                  id="hero-loc"
                  name="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="h-11 w-full appearance-none rounded-md border border-border bg-input px-3.5 pl-10 pr-10 text-[15px] outline-none ring-ring focus:ring-2"
                >
                  {cities.map((entry) => (
                    <option key={entry.label} value={entry.label}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </>
            ) : (
              <input
                id="hero-loc"
                name="city"
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Your city"
                className="h-11 w-full rounded-md border border-border bg-input px-3.5 pl-10 text-[15px] outline-none ring-ring focus:ring-2"
              />
            )}
          </div>
        </div>
        <button
          type="submit"
          className="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-md bg-accent font-display text-base font-semibold text-accent-foreground hover:bg-accent/90"
        >
          Get Free Quotes <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </form>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Request a free quote"
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/55 p-4 sm:p-8"
          onMouseDown={(event) => {
            if (!boxRef.current?.contains(event.target as Node)) close();
          }}
        >
          <div ref={boxRef} className="relative w-full max-w-[640px] rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <button
              type="button"
              onClick={close}
              className="mb-3 text-[13px] font-bold text-muted-foreground hover:text-primary"
            >
              ← Back to the page
            </button>
            <QuoteRequestForm
              key={open ? job + "|" + city + "|" + (service ?? "") : "closed"}
              initial={{ fromLink, onDone: close, surface: "window" }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
