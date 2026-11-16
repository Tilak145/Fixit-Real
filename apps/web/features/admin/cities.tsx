"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/states";
import { requireSupabase } from "@/lib/supabase";
import { US_STATES, cityAlreadyListed, cityLabel, cleanCityName } from "@/lib/city-label";
import { DEFAULT_STATE, isKnownState } from "@/lib/states";

interface CityRow {
  label: string;
  state: string;
  sort_order: number;
  is_active: boolean;
  lat: number | null;
  lng: number | null;
}

/**
 * The owner's city list. Adding a city is one name and one state: the label,
 * its place in the order and its map position are all worked out here, so
 * nothing has to be typed in a particular format.
 */
export function AdminCities() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [state, setState] = useState(DEFAULT_STATE);

  const cities = useQuery({
    queryKey: ["admin-rows", "service_cities"],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("service_cities")
        .select("label,state,sort_order,is_active,lat,lng")
        .order("sort_order")
        .order("label");
      if (error) throw new Error(error.message);
      return (data ?? []) as CityRow[];
    },
  });
  const list = cities.data ?? [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin-rows", "service_cities"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
  };

  const typedLabel = cityLabel(name, state);
  const duplicate = typedLabel !== "" && cityAlreadyListed(typedLabel, list.map((city) => city.label));

  const add = useMutation({
    mutationFn: async () => {
      // The lookup fixes the spelling's capitals and finds the map position.
      // It is a convenience: if it cannot answer, the city is still added.
      let finalName = cleanCityName(name);
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const response = await fetch(
          `/api/fixit/city?name=${encodeURIComponent(finalName)}&state=${encodeURIComponent(state)}`,
        );
        const found = (await response.json()) as { found: boolean; name?: string; lat?: number; lng?: number };
        if (found.found) {
          // Only take the service's spelling when it is the same word, so a
          // near-miss match never renames what the owner typed.
          if (found.name && found.name.toLowerCase() === finalName.toLowerCase()) finalName = found.name;
          lat = found.lat ?? null;
          lng = found.lng ?? null;
        }
      } catch {
        // Offline or blocked: carry on without a position.
      }
      const label = cityLabel(finalName, state);
      if (!label) throw new Error("Type the city's name first.");
      if (cityAlreadyListed(label, list.map((city) => city.label))) {
        throw new Error(`${label} is already on the list.`);
      }
      const sort_order = list.reduce((max, city) => Math.max(max, city.sort_order), 0) + 1;
      const { error } = await requireSupabase()
        .from("service_cities")
        .insert({ label, state, sort_order, is_active: true, lat, lng });
      if (error) throw new Error(error.message);
      return { label, located: lat !== null };
    },
    onSuccess: async ({ label, located }) => {
      setName("");
      await refresh();
      if (located) toast.success(`${label} added. Customers and pros can pick it now.`);
      else toast.warning(`${label} added, but we could not find it on the map. Check the spelling.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setActive = useMutation({
    mutationFn: async (input: { label: string; is_active: boolean }) => {
      const { error } = await requireSupabase()
        .from("service_cities")
        .update({ is_active: input.is_active })
        .eq("label", input.label);
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_data, input) => {
      await refresh();
      toast.success(input.is_active ? `${input.label} is open.` : `${input.label} is marked coming soon.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const move = useMutation({
    mutationFn: async (input: { index: number; by: -1 | 1 }) => {
      const next = [...list];
      const target = input.index + input.by;
      if (target < 0 || target >= next.length) return;
      [next[input.index], next[target]] = [next[target], next[input.index]];
      // Renumber from 1 so the order is always clean, saving only what moved.
      for (const [position, city] of next.entries()) {
        if (city.sort_order === position + 1) continue;
        const { error } = await requireSupabase()
          .from("service_cities")
          .update({ sort_order: position + 1 })
          .eq("label", city.label);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (label: string) => {
      const { error } = await requireSupabase().from("service_cities").delete().eq("label", label);
      if (error) throw new Error(error.message);
    },
    onSuccess: async (_data, label) => {
      await refresh();
      toast.success(`${label} removed.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = add.isPending || setActive.isPending || move.isPending || remove.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!typedLabel || duplicate || add.isPending) return;
    add.mutate();
  };

  return (
    <>
      <Card>
        <CardHeader className="border-b p-5">
          <CardTitle className="text-base">Add a city</CardTitle>
          <p className="pt-1 text-[12.5px] text-muted-foreground">
            Type the city&apos;s name and pick its state. It goes to the end of the list and is open straight away.
          </p>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-[220px] flex-1 gap-2">
              <Label htmlFor="city-name">City name</Label>
              <Input
                id="city-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="For example, Hudson"
                maxLength={60}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city-state">State</Label>
              <select
                id="city-state"
                value={state}
                onChange={(event) => setState(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {US_STATES.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={!typedLabel || duplicate || add.isPending} data-testid="add-city">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {add.isPending ? "Adding…" : "Add city"}
            </Button>
          </form>
          <p className="pt-3 text-[12.5px] text-muted-foreground" aria-live="polite">
            {duplicate ? (
              <span className="font-semibold text-destructive">{typedLabel} is already on the list.</span>
            ) : typedLabel ? (
              <>Will be shown as <strong className="text-foreground">{typedLabel}</strong>.</>
            ) : (
              "Customers and professionals will see it exactly as it is shown here."
            )}
            {typedLabel && !isKnownState(state) ? (
              <> This is the first city in this state: licence checks still use the Ohio links until the state is set up.</>
            ) : null}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b p-5">
          <CardTitle className="text-base">Cities</CardTitle>
          <p className="pt-1 text-[12.5px] text-muted-foreground">
            {cities.data
              ? `${list.length} cit${list.length === 1 ? "y" : "ies"}, in the order customers see them`
              : "Loading…"}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {cities.isPending ? (
            <div className="p-5"><LoadingState title="Loading…" /></div>
          ) : cities.error ? (
            <div className="p-5">
              <ErrorState
                title="Could not load the cities"
                description={(cities.error as Error).message}
                actionLabel="Try again"
                onAction={() => void cities.refetch()}
              />
            </div>
          ) : list.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No cities yet" description="Add the first city above." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((city, index) => (
                <li key={city.label} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3" data-testid="city-row">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-[160px] flex-1">
                    <p className="text-sm font-semibold">{city.label}</p>
                    {city.lat === null || city.lng === null ? (
                      <p className="text-[12px] text-muted-foreground">Not placed on the map</p>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-[13px] text-foreground/80">
                    <Switch
                      checked={city.is_active}
                      disabled={busy}
                      onCheckedChange={(checked) => setActive.mutate({ label: city.label, is_active: checked })}
                      aria-label={`${city.label} is open`}
                    />
                    <span className="w-[92px]">{city.is_active ? "Open" : "Coming soon"}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={busy || index === 0}
                      onClick={() => move.mutate({ index, by: -1 })}
                      aria-label={`Move ${city.label} up`}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={busy || index === list.length - 1}
                      onClick={() => move.mutate({ index, by: 1 })}
                      aria-label={`Move ${city.label} down`}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove ${city.label}? Professionals who serve it and requests already posted there keep the name, but nobody can pick it any more. To pause a city instead, switch it to Coming soon.`,
                          )
                        ) return;
                        remove.mutate(city.label);
                      }}
                      aria-label={`Remove ${city.label}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
