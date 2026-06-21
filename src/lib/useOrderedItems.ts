import { useMemo } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { applyFilters, useFiltersStore } from "@/stores/filtersStore";
import { useIdentitiesStore } from "@/stores/identitiesStore";
import type { ManifestItem } from "./types";

export function useOrderedItems(): ManifestItem[] {
  const items = useProjectStore((s) => s.items);
  const order = useProjectStore((s) => s.order);

  return useMemo(() => {
    const byPath = new Map(items.map((i) => [i.path, i]));
    const ordered = order
      .map((p) => byPath.get(p))
      .filter((i): i is ManifestItem => i !== undefined);
    const seen = new Set(order);
    for (const item of items) {
      if (!seen.has(item.path)) ordered.push(item);
    }
    return ordered;
  }, [items, order]);
}

export function useVisibleItems(): ManifestItem[] {
  const items = useProjectStore((s) => s.items);
  const order = useProjectStore((s) => s.order);
  const included = useProjectStore((s) => s.included);
  const searchQuery = useProjectStore((s) => s.searchQuery);
  const sharpOnly = useFiltersStore((s) => s.sharpOnly);
  const hasPeople = useFiltersStore((s) => s.hasPeople);
  const hideDuplicates = useFiltersStore((s) => s.hideDuplicates);
  const skippedOnly = useFiltersStore((s) => s.skippedOnly);
  const personFilter = useFiltersStore((s) => s.personFilter);
  const identities = useIdentitiesStore((s) => s.identities);

  return useMemo(
    () =>
      applyFilters(
        items,
        order,
        included,
        { sharpOnly, hasPeople, hideDuplicates, skippedOnly, personFilter },
        identities,
        searchQuery
      ),
    [
      items,
      order,
      included,
      sharpOnly,
      hasPeople,
      hideDuplicates,
      skippedOnly,
      personFilter,
      identities,
      searchQuery,
    ]
  );
}
