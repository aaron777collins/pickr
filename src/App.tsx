import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { SortableGrid } from "@/components/SortableGrid";
import { Lightbox } from "@/components/Lightbox";
import { ExportDialog } from "@/components/ExportDialog";
import { Sidebar } from "@/components/Sidebar";
import { ScanProgress } from "@/components/ScanProgress";
import { EmptyState } from "@/components/EmptyState";
import { FilterChips } from "@/features/filters/FilterChips";
import { usePersistence } from "@/features/persistence/usePersistence";
import { useProjectStore } from "@/stores/projectStore";
import { useFolderActions } from "@/lib/useFolderActions";
import { FolderContext } from "@/lib/folderContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const folder = useProjectStore((s) => s.folder);
  const scanning = useProjectStore((s) => s.scanning);
  const darkMode = useProjectStore((s) => s.darkMode);
  const [exportOpen, setExportOpen] = useState(false);
  const persistence = usePersistence();
  const { openFolder } = useFolderActions(persistence.loadAndMerge);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <FolderContext.Provider value={{ openFolder }}>
    <TooltipProvider delay={400}>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <TopBar
          onExport={() => setExportOpen(true)}
          saveStatus={persistence.status}
          lastSaved={persistence.lastSaved}
        />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto">
            {scanning ? (
              <ScanProgress />
            ) : folder ? (
              <SortableGrid />
            ) : (
              <EmptyState />
            )}
          </main>
          <Sidebar>
            <FilterChips />
          </Sidebar>
        </div>
        <Lightbox />
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
        <Toaster theme={darkMode ? "dark" : "light"} position="bottom-right" />
      </div>
    </TooltipProvider>
    </FolderContext.Provider>
  );
}

export default App;
