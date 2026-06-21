import { create } from "zustand";
import type { Identity, ManifestItem } from "@/lib/types";

export interface FiltersState {
  sharpOnly: boolean;
  hasPeople: boolean;
  hideDuplicates: boolean;
  skippedOnly: boolean;
  personFilter: string | null;

  toggleSharpOnly: () => void;
  toggleHasPeople: () => void;
  toggleHideDuplicates: () => void;
  toggleSkippedOnly: () => void;
  setPersonFilter: (name: string | null) => void;
  clearAll: () => void;
}

export const SHARP_THRESHOLD = 7;

export const useFiltersStore = create<FiltersState>((set) => ({
  sharpOnly: false,
  hasPeople: false,
  hideDuplicates: false,
  skippedOnly: false,
  personFilter: null,

  toggleSharpOnly: () => set((s) => ({ sharpOnly: !s.sharpOnly })),
  toggleHasPeople: () => set((s) => ({ hasPeople: !s.hasPeople })),
  toggleHideDuplicates: () => set((s) => ({ hideDuplicates: !s.hideDuplicates })),
  toggleSkippedOnly: () => set((s) => ({ skippedOnly: !s.skippedOnly })),
  setPersonFilter: (name) =>
    set((s) => ({ personFilter: s.personFilter === name ? null : name })),
  clearAll: () =>
    set({
      sharpOnly: false,
      hasPeople: false,
      hideDuplicates: false,
      skippedOnly: false,
      personFilter: null,
    }),
}));

/**
 * Pure selector applied to project-store data. Composes all active filters
 * with AND logic and returns items in the supplied `order`.
 *
 * Integration: the grid calls this with project store state + filters store
 * state + search query. Kept pure (no store reads) so it is testable and the
 * grid controls when it recomputes.
 */
export function applyFilters(
  items: ManifestItem[],
  order: string[],
  included: Record<string, boolean>,
  filters: Pick<
    FiltersState,
    "sharpOnly" | "hasPeople" | "hideDuplicates" | "skippedOnly" | "personFilter"
  >,
  identities: Identity[],
  searchQuery: string
): ManifestItem[] {
  const byPath = new Map(items.map((i) => [i.path, i]));

  // Order items per the order array; append any not present in order at the end.
  const ordered: ManifestItem[] = [];
  const seen = new Set<string>();
  for (const path of order) {
    const item = byPath.get(path);
    if (item) {
      ordered.push(item);
      seen.add(path);
    }
  }
  for (const item of items) {
    if (!seen.has(item.path)) ordered.push(item);
  }

  let result = ordered;

  if (filters.sharpOnly) {
    result = result.filter((i) => i.sharpness >= SHARP_THRESHOLD);
  }

  if (filters.hasPeople) {
    result = result.filter((i) => i.face_count >= 1);
  }

  if (filters.skippedOnly) {
    result = result.filter((i) => included[i.path] === false);
  }

  if (filters.personFilter) {
    const identity = identities.find((id) => id.name === filters.personFilter);
    const fileSet = new Set(identity?.files ?? []);
    result = result.filter((i) => fileSet.has(i.path));
  }

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    result = result.filter((i) => i.filename.toLowerCase().includes(q));
  }

  if (filters.hideDuplicates) {
    // Keep the highest-sharpness member of each dup group; items with no group
    // (dup_group === null) are always kept.
    const bestByGroup = new Map<number, ManifestItem>();
    for (const item of result) {
      if (item.dup_group === null) continue;
      const current = bestByGroup.get(item.dup_group);
      if (!current || item.sharpness > current.sharpness) {
        bestByGroup.set(item.dup_group, item);
      }
    }
    result = result.filter((item) => {
      if (item.dup_group === null) return true;
      return bestByGroup.get(item.dup_group)?.path === item.path;
    });
  }

  return result;
}
