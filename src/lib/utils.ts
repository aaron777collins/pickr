import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { convertFileSrc } from "@tauri-apps/api/core"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function assetUrl(path: string): string {
  return convertFileSrc(path)
}

export function truncatePath(path: string, segments = 2): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  if (parts.length <= segments) return path
  return "…/" + parts.slice(-segments).join("/")
}
