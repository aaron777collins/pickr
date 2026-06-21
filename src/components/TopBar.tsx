import { Camera, Search, Moon, Sun, FolderOpen, Download } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useFolderActions } from "@/lib/useFolderActions";
import { openInExplorer } from "@/lib/commands";
import { truncatePath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopBarProps {
  onExport: () => void;
}

export function TopBar({ onExport }: TopBarProps) {
  const folder = useProjectStore((s) => s.folder);
  const darkMode = useProjectStore((s) => s.darkMode);
  const toggleDarkMode = useProjectStore((s) => s.toggleDarkMode);
  const searchQuery = useProjectStore((s) => s.searchQuery);
  const setSearchQuery = useProjectStore((s) => s.setSearchQuery);
  const items = useProjectStore((s) => s.items);
  const { openFolder } = useFolderActions();

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Camera className="h-5 w-5 text-primary" />
        <span className="font-heading text-lg font-semibold">Pickr</span>
        {folder && (
          <button
            type="button"
            onClick={() => openInExplorer(folder).catch(() => {})}
            title={folder}
            className="min-w-0 truncate rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {truncatePath(folder)}
          </button>
        )}
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by filename…"
          disabled={items.length === 0}
          className="h-8 pl-8"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleDarkMode}
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={openFolder}>
          <FolderOpen className="h-4 w-4" />
          Open Folder
        </Button>
        <Button
          size="sm"
          onClick={onExport}
          disabled={items.length === 0}
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>
    </header>
  );
}
