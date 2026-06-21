import { Loader2 } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";

export function ScanProgress() {
  const progress = useProjectStore((s) => s.scanProgress);

  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="w-full max-w-sm">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Scanning…</span>
          <span className="tabular-nums text-muted-foreground">
            {done} of {total || "?"}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
        {progress?.current && (
          <p className="mt-2 truncate text-center text-xs text-muted-foreground">
            {progress.current}
          </p>
        )}
      </div>
    </div>
  );
}
