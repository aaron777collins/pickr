import { useEffect, useState } from "react";
import { Check, CircleDot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "@/features/persistence/usePersistence";

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved: number | null;
  className?: string;
}

function relativeTime(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

/**
 * Drops into the TopBar (Agent 4). Pass the values returned by usePersistence().
 */
export function SaveIndicator({
  status,
  lastSaved,
  className,
}: SaveIndicatorProps) {
  const [, force] = useState(0);

  // Re-render every 10s so "Saved Xs ago" stays current.
  useEffect(() => {
    if (status !== "saved") return;
    const id = setInterval(() => force((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, [status]);

  let icon: React.ReactNode;
  let text: string;
  let tone = "text-muted-foreground";

  if (status === "saving") {
    icon = <Loader2 className="size-3.5 animate-spin" />;
    text = "Saving…";
  } else if (status === "dirty") {
    icon = <CircleDot className="size-3.5" />;
    text = "Unsaved changes";
    tone = "text-amber-500";
  } else if (status === "saved") {
    icon = <Check className="size-3.5" />;
    text = lastSaved ? `Saved ${relativeTime(lastSaved)}` : "Saved";
    tone = "text-emerald-500";
  } else {
    icon = null;
    text = "";
  }

  if (!text) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium",
        tone,
        className
      )}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
