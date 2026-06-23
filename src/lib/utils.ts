import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { convertFileSrc } from "@tauri-apps/api/core"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function assetUrl(path: string): string {
  return convertFileSrc(path)
}

/** Join path segments onto a base, using the separator the base already uses
 * (backslash on Windows paths, forward slash otherwise). */
export function joinPath(base: string, ...segments: string[]): string {
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  const trimmed = base.replace(/[\\/]+$/, "");
  return [trimmed, ...segments].join(sep);
}

export function truncatePath(path: string, segments = 2): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  if (parts.length <= segments) return path
  return "…/" + parts.slice(-segments).join("/")
}
