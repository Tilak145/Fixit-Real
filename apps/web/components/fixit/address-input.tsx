"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { addressApiUrl, MIN_LOOKUP_LENGTH, type AddressSuggestion } from "@/lib/fixit-address";

/**
 * The moment a customer types an address, we look it up and offer the real
 * one to pick. Correct addresses matter twice over: the request is matched to
 * professionals by city, and the pro who accepts it drives to the door.
 *
 * A picked suggestion writes the full, formatted address into the field, so
 * the stored value is always a complete address rather than a half-typed
 * street. If the lookup is unreachable the typing itself still works — the
 * field is never blocked by a network problem.
 */
export function AddressInput({
  value,
  onChange,
  onPick,
  name,
  id,
  placeholder,
  className,
  autoComplete = "street-address",
}: {
  value: string;
  /** Fires on every keystroke, so the parent keeps what the customer typed. */
  onChange: (value: string) => void;
  /** Fires when a suggestion is chosen, with the city already resolved. */
  onPick?: (suggestion: AddressSuggestion) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  // The text we already looked up, so choosing a suggestion (which changes the
  // value) does not immediately trigger a new lookup for its own result.
  const lastLookup = useRef("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = value.trim();
    // A picked suggestion is not looked up again until the customer adds to
    // it: typing "123 Main St, Akron" after picking "123 Main Street,
    // Cleveland" must offer Akron's addresses, not keep the old result.
    const alreadyPicked = query === lastLookup.current;
    if (query.length < MIN_LOOKUP_LENGTH || alreadyPicked) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // Keep what the customer already typed while the new lookup runs. Hiding
    // the list made the fields below jump under the pointer mid-typing.
    setLoading(true);

    // Debounce: wait for a pause in typing so a whole street is looked up once
    // rather than once per letter.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      lastLookup.current = query;
      setLoading(true);
      try {
        // The app's own route consults the address services on the server,
        // where the US Census lookup (which confirms real house numbers) is
        // reachable. It answers with one merged list of suggestions.
        const response = await fetch(addressApiUrl(query), { signal: controller.signal });
        if (!response.ok) throw new Error("lookup failed: " + response.status);
        const body = (await response.json()) as { suggestions?: AddressSuggestion[] };
        const found = body.suggestions ?? [];
        setSuggestions(found);
        setHighlight(-1);
        setOpen(found.length > 0);
      } catch {
        // Offline, blocked, or no match: the customer simply keeps typing.
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }

    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  // Clicking anywhere else closes the list without discarding what was typed.
  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  function choose(suggestion: AddressSuggestion) {
    lastLookup.current = suggestion.label;
    onChange(suggestion.label);
    onPick?.(suggestion);
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      choose(suggestions[highlight]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <input
        id={id}
        name={name}
        type="text"
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading ? (
        <Loader2
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
      {open ? (
        <ul
          role="listbox"
          data-testid="address-suggestions"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-[260px] overflow-auto rounded-md border border-border bg-card py-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.key} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(suggestion)}
                onMouseEnter={() => setHighlight(index)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] ${
                  index === highlight ? "bg-muted" : "hover:bg-muted"
                }`}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 flex-none text-accent" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block font-semibold">{suggestion.line1}</span>
                  <span className="block text-[12px] text-muted-foreground">
                    {[suggestion.city, [suggestion.state, suggestion.postcode].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

