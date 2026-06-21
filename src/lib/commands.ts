import { invoke } from "@tauri-apps/api/core";
import type {
  ManifestItem,
  FaceBox,
  ExportItem,
  ExportSummary,
  ProjectJson,
} from "./types";

export async function scanFolder(path: string): Promise<ManifestItem[]> {
  return invoke<ManifestItem[]>("scan_folder", { path });
}

export async function exportRenamed(
  items: ExportItem[],
  destFolder: string
): Promise<ExportSummary> {
  return invoke<ExportSummary>("export_renamed", { items, destFolder });
}

export async function openInExplorer(path: string): Promise<void> {
  return invoke<void>("open_in_explorer", { path });
}

export async function faceDetect(path: string): Promise<FaceBox[]> {
  return invoke<FaceBox[]>("face_detect", { path });
}

export async function faceMatch(
  embedding: string,
  manifestPath: string
): Promise<string[]> {
  return invoke<string[]>("face_match", { embedding, manifestPath });
}

export async function saveProject(
  folder: string,
  project: ProjectJson
): Promise<void> {
  return invoke<void>("save_project", { folder, project });
}

export async function loadProject(folder: string): Promise<ProjectJson | null> {
  return invoke<ProjectJson | null>("load_project", { folder });
}

export async function pickFolder(): Promise<string | null> {
  return invoke<string | null>("pick_folder");
}
