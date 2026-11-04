"use client";

import { useQuery } from "@tanstack/react-query";
import { listCities, type ServiceCity } from "@/lib/fixit";

/**
 * The cities FixIt serves, read from the list the owner keeps in the dashboard.
 *
 * The list is shared: a customer choosing where a job is and a professional
 * choosing the areas they cover both pick from the same rows, so the exact
 * string that reaches a service area is the one a request carries and matching
 * cannot fail on a spelling difference. A slow or unavailable list is not an
 * error the customer should see; the field simply falls back to typing.
 */
export function useCities(): { cities: ServiceCity[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: ["service-cities"],
    queryFn: listCities,
    staleTime: 5 * 60_000,
  });
  return { cities: query.data ?? [], isLoading: query.isLoading };
}

/**
 * A city field backed by the owner's list, with a typed fallback for the moment
 * the list is empty or the connection is down. The submitted control is always
 * named city, so a plain HTML form and a React form both post the same value.
 */
export function CitySelect({
  value,
  onChange,
  name = "city",
  id,
  className,
  placeholder = "Choose your city",
  required = true,
  allowCustom = true,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
  className?: string;
  placeholder?: string;
  required?: boolean;
  allowCustom?: boolean;
}) {
  const { cities } = useCities();
  const active = cities.filter((city) => city.is_active);
  const known = active.some((city) => city.label === value);

  // Nothing to choose from yet, or the value is not on the list: keep the plain
  // input so the form still works and an existing saved city is not lost.
  if (active.length === 0 || (allowCustom && !known && value)) {
    return (
      <input
        id={id}
        name={name}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <select
      id={id}
      name={name}
      required={required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {active.map((city) => (
        <option key={city.label} value={city.label}>
          {city.label}
        </option>
      ))}
    </select>
  );
}
