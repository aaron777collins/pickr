import { CheckSquare, XSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/projectStore";
import { useVisibleItems } from "@/lib/useOrderedItems";
import { useFiltersStore } from "@/stores/filtersStore";

export function StatsBar() {
  const items = useProjectStore((s) => s.items);
  const included = useProjectStore((s) => s.included);
  const includeAll = useProjectStore((s) => s.includeAll);
  const skipAll = useProjectStore((s) => s.skipAll);
  const searchQuery = useProjectStore((s) => s.searchQuery);
  const { sharpOnly, hasPeople, hideDuplicates, skippedOnly, personFilter } =
    useFiltersStore();
  const visibleItems = useVisibleItems();

  const totalCount = items.length;
  const includedCount = items.filter((i) => included[i.path] !== false).length;
  const skippedCount = totalCount - includedCount;

  const filtersActive =
    sharpOnly || hasPeople || hideDuplicates || skippedOnly || !!personFilter || !!searchQuery.trim();

  const visiblePaths = visibleItems.map((i) => i.path);
  const visibleIncludedCount = visibleItems.filter(
    (i) => included[i.path] !== false
  ).length;
  const visibleSkippedCount = visibleItems.length - visibleIncludedCount;

  return (
    <div className="flex h-8 items-center gap-3 border-b border-border px-4 text-xs text-muted-foreground">
      {filtersActive ? (
        <span>
          Showing{" "}
          <strong className="font-medium text-foreground">
            {visibleItems.length}
          </strong>{" "}
          of {totalCount} &middot;{" "}
          <strong className="font-medium text-foreground">
            {visibleIncludedCount}
          </strong>{" "}
          included &middot;{" "}
          <strong className="font-medium text-foreground">
            {visibleSkippedCount}
          </strong>{" "}
          skipped
        </span>
      ) : (
        <span>
          <strong className="font-medium text-foreground">{totalCount}</strong>{" "}
          items &middot;{" "}
          <strong className="font-medium text-foreground">
            {includedCount}
          </strong>{" "}
          included &middot;{" "}
          <strong className="font-medium text-foreground">{skippedCount}</strong>{" "}
          skipped
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => includeAll(visiblePaths)}
          title="Include all visible items"
        >
          <CheckSquare />
          Include All
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => skipAll(visiblePaths)}
          title="Skip all visible items"
        >
          <XSquare />
          Skip All
        </Button>
      </div>
    </div>
  );
}
