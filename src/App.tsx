import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { SortableGrid } from "@/components/SortableGrid";
import { Lightbox } from "@/components/Lightbox";
import { ExportDialog } from "@/components/ExportDialog";
import { Sidebar } from "@/components/Sidebar";
import { ScanProgress } from "@/components/ScanProgress";
import { EmptyState } from "@/components/EmptyState";
import { useProjectStore } from "@/stores/projectStore";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

function App() {
  const folder = useProjectStore((s) => s.folder);
  const scanning = useProjectStore((s) => s.scanning);
  const darkMode = useProjectStore((s) => s.darkMode);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <TooltipProvider delay={400}>
      <div className="flex h-screen flex-col bg-background text-foreground">
        <TopBar onExport={() => setExportOpen(true)} />
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
          <Sidebar />
        </div>
        <Lightbox />
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
        <Toaster theme={darkMode ? "dark" : "light"} position="bottom-right" />
      </div>
    </TooltipProvider>
  );
}

export default App;
