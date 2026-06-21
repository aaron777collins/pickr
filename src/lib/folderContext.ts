import { createContext, useContext } from "react";

interface FolderContextValue {
  openFolder: () => Promise<void> | void;
}

export const FolderContext = createContext<FolderContextValue | null>(null);

export function useOpenFolder(): () => Promise<void> | void {
  const ctx = useContext(FolderContext);
  if (!ctx) {
    throw new Error("useOpenFolder must be used within FolderContext.Provider");
  }
  return ctx.openFolder;
}
