import { useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { pickFolder, scanFolder } from "@/lib/commands";
import { useProjectStore } from "@/stores/projectStore";
import type { ManifestItem, ScanProgress } from "@/lib/types";

type LoadAndMerge = (folder: string, manifest: ManifestItem[]) => Promise<void>;

export function useFolderActions(loadAndMerge: LoadAndMerge) {
  const setFolder = useProjectStore((s) => s.setFolder);
  const setScanning = useProjectStore((s) => s.setScanning);
  const setScanProgress = useProjectStore((s) => s.setScanProgress);

  const openFolder = useCallback(async () => {
    let folder: string | null = null;
    try {
      folder = await pickFolder();
    } catch (err) {
      toast.error(`Could not open folder picker: ${String(err)}`);
      return;
    }
    if (!folder) return;

    setFolder(folder);
    setScanning(true);
    setScanProgress(null);

    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      setScanProgress(event.payload);
    });

    try {
      const items = await scanFolder(folder);
      await loadAndMerge(folder, items);
      toast.success(`Scanned ${items.length} items`);
    } catch (err) {
      toast.error(`Scan failed: ${String(err)}`);
    } finally {
      unlisten();
      setScanning(false);
      setScanProgress(null);
    }
  }, [loadAndMerge, setFolder, setScanning, setScanProgress]);

  return { openFolder };
}
