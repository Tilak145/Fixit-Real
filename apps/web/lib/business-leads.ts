/**
 * Keeps only the requests that belong on one business's dashboard: its own
 * claimed jobs, and jobs in a service it offers and a city it serves. The
 * database already limits a normal pro to these, but an account that is also
 * staff may read every request, and its business must not be shown them all.
 */
export function leadsForBusiness<T extends { category_slug: string; city: string; claimed_by: string | null }>(
  rows: T[],
  business: { id: string; services: string[]; cities: string[] },
): T[] {
  return rows.filter(
    (row) =>
      row.claimed_by === business.id ||
      (business.services.includes(row.category_slug) && business.cities.includes(row.city)),
  );
}