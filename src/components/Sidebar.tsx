import { useState, type ReactNode } from "react";
import { ChevronRight, ChevronLeft, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  children?: ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-l bg-card transition-[width] duration-200",
        open ? "w-80" : "w-11"
      )}
    >
      <div className="flex h-11 items-center justify-between border-b px-2">
        {open && (
          <span className="flex items-center gap-1.5 px-1 text-sm font-medium">
            <SlidersHorizontal className="h-4 w-4" />
            Filters & Tags
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          className={cn(!open && "mx-auto")}
        >
          {open ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {open && (
        <ScrollArea className="flex-1">
          <div className="p-3">
            {children ?? (
              <p className="text-sm text-muted-foreground">
                Filters and face tags will appear here.
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </aside>
  );
}
