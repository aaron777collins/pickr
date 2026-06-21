import { useMemo } from "react";
import { useProjectStore } from "@/stores/projectStore";
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
  const ordered = useOrderedItems();
  const searchQuery = useProjectStore((s) => s.searchQuery);
  return useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((i) => i.filename.toLowerCase().includes(q));
  }, [ordered, searchQuery]);
}
