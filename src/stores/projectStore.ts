import { create } from "zustand";
import type { ManifestItem, ScanProgress, Identity } from "@/lib/types";

interface ProjectState {
  folder: string | null;
  items: ManifestItem[];
  order: string[];
  included: Record<string, boolean>;
  identities: Identity[];
  lightboxIndex: number | null;
  scanning: boolean;
  scanProgress: ScanProgress | null;
  darkMode: boolean;
  searchQuery: string;

  setFolder: (folder: string) => void;
  setItems: (items: ManifestItem[]) => void;
  setOrder: (order: string[]) => void;
  setIdentities: (identities: Identity[]) => void;
  toggleInclude: (path: string) => void;
  setLightboxIndex: (index: number | null) => void;
  setScanning: (scanning: boolean) => void;
  setScanProgress: (progress: ScanProgress | null) => void;
  toggleDarkMode: () => void;
  setSearchQuery: (query: string) => void;
  moveItem: (activeId: string, overId: string) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  folder: null,
  items: [],
  order: [],
  included: {},
  identities: [],
  lightboxIndex: null,
  scanning: false,
  scanProgress: null,
  darkMode: true,
  searchQuery: "",

  setFolder: (folder) => set({ folder }),

  setItems: (items) =>
    set({
      items,
      order: items.map((i) => i.path),
      included: Object.fromEntries(items.map((i) => [i.path, true])),
    }),

  setOrder: (order) => set({ order }),

  setIdentities: (identities) => set({ identities }),

  toggleInclude: (path) =>
    set((state) => ({
      included: { ...state.included, [path]: !(state.included[path] ?? true) },
    })),

  setLightboxIndex: (index) => set({ lightboxIndex: index }),
  setScanning: (scanning) => set({ scanning }),
  setScanProgress: (scanProgress) => set({ scanProgress }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  moveItem: (activeId, overId) =>
    set((state) => {
      const oldIndex = state.order.indexOf(activeId);
      const newIndex = state.order.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return state;
      }
      const next = [...state.order];
      next.splice(oldIndex, 1);
      next.splice(newIndex, 0, activeId);
      return { order: next };
    }),

  reset: () =>
    set({
      folder: null,
      items: [],
      order: [],
      included: {},
      identities: [],
      lightboxIndex: null,
      scanning: false,
      scanProgress: null,
      searchQuery: "",
    }),
}));

if (import.meta.env.DEV) {
  (window as unknown as { __projectStore?: typeof useProjectStore }).__projectStore =
    useProjectStore;
}
