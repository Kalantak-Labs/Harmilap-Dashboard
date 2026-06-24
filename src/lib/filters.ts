/** Shared helpers for Excel-style per-column table filters (server-side). */

export type ColFilters = Record<string, string>;

/** Build the `filters` query param (JSON array of {col,val}) from a filter map. */
export function filtersToParam(filters: ColFilters): string | undefined {
  const items = Object.entries(filters)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([col, val]) => ({ col, val }));
  return items.length ? JSON.stringify(items) : undefined;
}

/** Number of active column filters. */
export function activeFilterCount(filters: ColFilters): number {
  return Object.values(filters).filter((v) => v != null && String(v).trim() !== "").length;
}
