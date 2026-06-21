import { create } from "zustand";
import type { Identity } from "@/lib/types";

export const IDENTITY_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#06b6d4",
];

interface IdentitiesState {
  identities: Identity[];

  setIdentities: (identities: Identity[]) => void;
  addIdentity: (name: string, embedding_b64: string, files: string[]) => void;
  removeIdentity: (name: string) => void;
  addFilesToIdentity: (name: string, files: string[]) => void;
  getIdentityColor: (name: string) => string;
}

function nextColor(existing: Identity[]): string {
  return IDENTITY_COLORS[existing.length % IDENTITY_COLORS.length];
}

export const useIdentitiesStore = create<IdentitiesState>((set, get) => ({
  identities: [],

  setIdentities: (identities) => set({ identities }),

  addIdentity: (name, embedding_b64, files) =>
    set((s) => {
      const existing = s.identities.find((i) => i.name === name);
      if (existing) {
        // Re-tagging an existing person: merge files, keep latest embedding.
        const merged = Array.from(new Set([...existing.files, ...files]));
        return {
          identities: s.identities.map((i) =>
            i.name === name ? { ...i, embedding_b64, files: merged } : i
          ),
        };
      }
      return {
        identities: [
          ...s.identities,
          {
            name,
            embedding_b64,
            color: nextColor(s.identities),
            files: Array.from(new Set(files)),
          },
        ],
      };
    }),

  removeIdentity: (name) =>
    set((s) => ({ identities: s.identities.filter((i) => i.name !== name) })),

  addFilesToIdentity: (name, files) =>
    set((s) => ({
      identities: s.identities.map((i) =>
        i.name === name
          ? { ...i, files: Array.from(new Set([...i.files, ...files])) }
          : i
      ),
    })),

  getIdentityColor: (name) => {
    const found = get().identities.find((i) => i.name === name);
    return found?.color ?? "#ffffff";
  },
}));
