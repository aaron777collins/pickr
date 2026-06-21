import { useCallback, useEffect, useRef, useState } from "react";
import { loadProject, saveProject } from "@/lib/commands";
import type { ManifestItem, ProjectJson } from "@/lib/types";
import { useProjectStore } from "@/stores/projectStore";
import { useIdentitiesStore } from "@/stores/identitiesStore";

const DEBOUNCE_MS = 2000;

export type SaveStatus = "idle" | "dirty" | "saving" | "saved";

export interface PersistenceApi {
  status: SaveStatus;
  lastSaved: number | null;
  /** Load a project file for `folder` and merge it with a freshly scanned manifest. */
  loadAndMerge: (folder: string, manifest: ManifestItem[]) => Promise<void>;
}

/**
 * Mount once near the app root. Watches the project + identities stores and
 * auto-saves a ProjectJson to <folder>/.pickr after a 2s debounce.
 *
 * The identities store is the source of truth for face tags; we mirror it into
 * the project store so the grid/filters see one consistent list and the saved
 * ProjectJson stays complete.
 */
export function usePersistence(): PersistenceApi {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);
  const firstChangeSkipped = useRef(false);

  // Keep the project store's identities mirror in sync with the identities store.
  useEffect(() => {
    return useIdentitiesStore.subscribe((state) => {
      useProjectStore.getState().setIdentities(state.identities);
    });
  }, []);

  const doSave = useCallback(async () => {
    const ps = useProjectStore.getState();
    if (!ps.folder) return;
    const project: ProjectJson = {
      folder: ps.folder,
      items: ps.items,
      order: ps.order,
      included: ps.included,
      identities: useIdentitiesStore.getState().identities,
    };
    setStatus("saving");
    try {
      await saveProject(ps.folder, project);
      setStatus("saved");
      setLastSaved(Date.now());
    } catch {
      setStatus("dirty");
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (loadingRef.current) return;
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), DEBOUNCE_MS);
  }, [doSave]);

  // Watch meaningful changes: order, included, items, identities.
  useEffect(() => {
    const unsubProject = useProjectStore.subscribe((state, prev) => {
      if (!state.folder) return;
      if (
        state.order !== prev.order ||
        state.included !== prev.included ||
        state.items !== prev.items
      ) {
        if (!firstChangeSkipped.current) {
          firstChangeSkipped.current = true;
          return;
        }
        scheduleSave();
      }
    });
    const unsubIdentities = useIdentitiesStore.subscribe(() => scheduleSave());
    return () => {
      unsubProject();
      unsubIdentities();
    };
  }, [scheduleSave]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const loadAndMerge = useCallback(
    async (folder: string, manifest: ManifestItem[]) => {
      loadingRef.current = true;
      const project = await loadProject(folder);

      if (project) {
        const manifestByPath = new Map(manifest.map((i) => [i.path, i]));

        // Order: keep saved order for items that still exist, append new ones.
        const order: string[] = [];
        const used = new Set<string>();
        for (const path of project.order) {
          if (manifestByPath.has(path)) {
            order.push(path);
            used.add(path);
          }
        }
        for (const item of manifest) {
          if (!used.has(item.path)) order.push(item.path);
        }

        // Included: preserve saved states for surviving items, default new to true.
        const included: Record<string, boolean> = {};
        for (const item of manifest) {
          included[item.path] = project.included[item.path] ?? true;
        }

        // Identities: drop file refs that no longer exist in the manifest.
        const identities = project.identities.map((id) => ({
          ...id,
          files: id.files.filter((f) => manifestByPath.has(f)),
        }));

        useProjectStore.getState().setItems(manifest);
        useProjectStore.getState().setOrder(order);
        useProjectStore.setState({ included, folder });
        useIdentitiesStore.getState().setIdentities(identities);
      } else {
        // No saved project: fresh init with manifest order, all included.
        useProjectStore.getState().setItems(manifest);
        useProjectStore.setState({ folder });
        useIdentitiesStore.getState().setIdentities([]);
      }

      firstChangeSkipped.current = false;
      // Defer clearing the loading flag until after store subscribers fire.
      setTimeout(() => {
        loadingRef.current = false;
      }, 0);
      setStatus("idle");
    },
    []
  );

  return { status, lastSaved, loadAndMerge };
}
