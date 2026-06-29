# CLAUDE.md -- Pickr

## Stack
- Tauri 2 (Rust shell) + React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui (New York style, neutral palette)
- Zustand for state, dnd-kit for drag-and-drop
- Python sidecar for AI (sharpness, dedup, face recognition)

## Directory Layout
```
src/              # React frontend
src/components/   # UI components (TopBar, Grid, Lightbox, etc.)
src/components/ui/# shadcn primitives (Base UI-based)
src/stores/       # zustand stores (project, filters, identities)
src/features/     # feature modules (filters, face-tag, persistence)
src/lib/          # types, command wrappers, utilities
src-tauri/        # Rust backend (Tauri commands, sidecar spawning)
sidecar/          # Python CLI (scan, dedup, face_detect, face_match)
docs/             # Architecture docs + usage guide
```

## Run Commands
```bash
npm run dev          # Vite dev server (http://localhost:1420)
npm run tauri dev    # Full desktop app (first run compiles Rust)
npm run build        # Production build (frontend)
```

## Sidecar (Python)
```bash
cd sidecar && source .venv/bin/activate
pickr-sidecar scan <folder>          # scan + thumbnails + AI analysis
pickr-sidecar dedup <manifest.json>  # group by pHash similarity
pickr-sidecar face_detect <path>     # detect faces + embeddings
pickr-sidecar face_match <emb> <manifest.json>  # find matching faces
```
- Output: newline-delimited JSON on stdout (type: progress/result/error)
- Logs go to stderr only
- Sidecar binary found by: $PICKR_SIDECAR_PATH > PATH > sidecar/.venv/bin/pickr-sidecar
- Face detection uses OpenCV's YuNet + SFace (ONNX models, auto-downloaded on first use)

## Key Decisions
- Path alias: `@/` maps to `src/`
- shadcn components use Base UI (not Radix) — `@base-ui/react`
- Tauri 2 capability-based permissions in `src-tauri/capabilities/`
- Python sidecar communicates via newline-delimited JSON over stdout
- Face coordinates from sidecar are absolute pixels (not normalized)
- phash and thumb_path can be null (Optional in Rust, string|null in TS)
- FolderContext provides openFolder to avoid prop drilling

## Filters, Faces & Persistence (src/stores, src/features)

### Identity store (`src/stores/identitiesStore.ts`)
Source of truth for face tags. `Identity = { name, embedding_b64, color, files[] }`.
Colors assigned sequentially from a fixed 10-color palette. `addIdentity` merges
files when the name already exists. The persistence hook mirrors this list into
the project store's `identities` so the grid/filters and saved file stay in sync.

### Filter logic (`src/stores/filtersStore.ts`)
`applyFilters()` is a pure selector (no store reads) the grid calls with project
state + filter state + search query. Filters compose with **AND**:
- `sharpOnly`: sharpness ≥ 7 (`SHARP_THRESHOLD`)
- `hasPeople`: face_count ≥ 1
- `hideDuplicates`: keep only the highest-sharpness member of each `dup_group`
  (items with `dup_group === null` always kept)
- `skippedOnly`: `included[path] === false`
- `personFilter`: path is in the matching identity's `files`
- `searchQuery`: filename substring, case-insensitive
Items are returned in `order`; any item missing from `order` is appended.

### Duplicate UX (`src/features/filters/dupHelpers.ts`)
`getDupGroupInfo(item, allItems)` returns group size, best-in-group flag, and a
deterministic per-group color for the Thumbnail to draw chain/stack badges.

### Project file schema (`.pickr/project.json`)
```
ProjectJson { folder, items: ManifestItem[], order: string[],
              included: Record<path, boolean>, identities: Identity[] }
```
`load_project` returns null when absent. On folder open, `usePersistence`'s
`loadAndMerge(folder, manifest)` reconciles a saved project with a fresh scan:
keep saved order/include for surviving paths, append new files (included=true),
drop missing files (incl. from identity `files[]`).

### Persistence debounce (`src/features/persistence/usePersistence.ts`)
Mount once near the app root. Subscribes to project + identities stores and
auto-saves a `ProjectJson` **2s after the last change** (`DEBOUNCE_MS`). Exposes
`{ status, lastSaved, loadAndMerge }`; `SaveIndicator` renders the status in the
TopBar. Saves are suppressed while `loadAndMerge` runs.

### Integration points
- `FilterChips` → Sidebar shell
- `FaceTagModal` → opened from Lightbox on `F` (props: `imagePath`, `onClose`)
- `SaveIndicator` → TopBar (pass `usePersistence()` return values)
- `applyFilters` → grid item source; `getDupGroupInfo` → Thumbnail badges
