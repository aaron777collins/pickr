import { useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { pickFolder, scanFolder } from "@/lib/commands";
import { loadProject } from "@/lib/commands";
import { useProjectStore } from "@/stores/projectStore";
import type { ScanProgress } from "@/lib/types";

export function useFolderActions() {
  const setFolder = useProjectStore((s) => s.setFolder);
  const setItems = useProjectStore((s) => s.setItems);
  const setOrder = useProjectStore((s) => s.setOrder);
  const setIdentities = useProjectStore((s) => s.setIdentities);
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
      const existing = await loadProject(folder).catch(() => null);
      const items = await scanFolder(folder);
      setItems(items);
      if (existing) {
        const known = new Set(items.map((i) => i.path));
        const restored = existing.order.filter((p) => known.has(p));
        for (const i of items) {
          if (!restored.includes(i.path)) restored.push(i.path);
        }
        setOrder(restored);
        if (existing.identities) setIdentities(existing.identities);
        useProjectStore.setState((s) => ({
          included: { ...s.included, ...existing.included },
        }));
      }
      toast.success(`Scanned ${items.length} items`);
    } catch (err) {
      toast.error(`Scan failed: ${String(err)}`);
    } finally {
      unlisten();
      setScanning(false);
      setScanProgress(null);
    }
  }, [
    setFolder,
    setItems,
    setOrder,
    setIdentities,
    setScanning,
    setScanProgress,
  ]);

  return { openFolder };
}
