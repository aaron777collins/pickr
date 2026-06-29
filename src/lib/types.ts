export interface ManifestItem {
  path: string;
  filename: string;
  kind: "image" | "video";
  w: number;
  h: number;
  duration_sec: number | null;
  sharpness: number;
  face_count: number;
  phash: string | null;
  thumb_path: string | null;
  dup_group: number | null;
  preview_path: string | null;
  faces: FaceBox[];
}

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  embedding_b64: string;
}

export interface ExportItem {
  src_path: string;
  order_index: number;
  include: boolean;
}

export interface ExportSummary {
  exported_count: number;
  skipped_count: number;
  dest_folder: string;
}

export interface BlurExportItem {
  src: string;
  dest: string;
  kind: "image" | "video";
}

export interface BlurExportConfig {
  keep_embeddings: string[];
  items: BlurExportItem[];
}

export interface Identity {
  name: string;
  embedding_b64: string;
  color: string;
  files: string[];
}

export interface ScanProgress {
  done: number;
  total: number;
  current: string;
}

export interface ProjectJson {
  folder: string;
  items: ManifestItem[];
  order: string[];
  included: Record<string, boolean>;
  identities: Identity[];
}
