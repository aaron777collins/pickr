# Architecture

## Directory Tree

```
pickr/
  src/                        # React frontend
    components/
      ui/                     # shadcn/ui primitives (Base UI-based)
        badge.tsx
        button.tsx
        card.tsx
        dialog.tsx
        dropdown-menu.tsx
        input.tsx
        scroll-area.tsx
        separator.tsx
        slider.tsx
        sonner.tsx
        tabs.tsx
        toggle.tsx
        tooltip.tsx
      EmptyState.tsx           # splash shown before any folder is opened
      ExportDialog.tsx         # rename-and-copy export workflow
      Lightbox.tsx             # full-screen preview (react-photo-view) + face-tag trigger
      SaveIndicator.tsx        # save status badge rendered in TopBar
      ScanProgress.tsx         # streaming progress UI during sidecar scan
      Sidebar.tsx              # collapsible right panel (hosts FilterChips)
      SortableGrid.tsx         # dnd-kit drag-to-reorder thumbnail grid
      Thumbnail.tsx            # single grid cell: image/video, badges, selection
      TopBar.tsx               # folder picker, export, dark-mode, save status
    features/
      face-tag/
        FaceTagModal.tsx       # modal for tagging a face to an identity
      filters/
        dupHelpers.ts          # getDupGroupInfo — per-group color and best-in-group flag
        FilterChips.tsx        # filter toggle chips rendered inside Sidebar
      persistence/
        usePersistence.ts      # debounced auto-save + loadAndMerge on folder open
    stores/
      filtersStore.ts          # filter toggles + applyFilters pure selector
      identitiesStore.ts       # face identities (name, embedding, color, files)
      projectStore.ts          # folder, items, order, included, scanning, darkMode
    lib/
      commands.ts              # typed wrappers around Tauri invoke() calls
      folderContext.ts         # React context providing openFolder to avoid prop drilling
      types.ts                 # shared TypeScript types (ManifestItem, Identity, etc.)
      useFolderActions.ts      # orchestrates pick_folder → scan → dedup → loadAndMerge
      useOrderedItems.ts       # derives filtered + ordered item list from stores
      utils.ts                 # cn() Tailwind class-merge helper
    App.tsx                    # root component — layout, routing between states
    main.tsx                   # Vite entry point
    index.css                  # Tailwind v4 + shadcn CSS theme
  src-tauri/                   # Rust backend (Tauri 2)
    src/
      commands.rs              # all #[tauri::command] implementations
      lib.rs                   # plugin registration, invoke_handler wiring
      main.rs                  # entry point
    capabilities/              # Tauri v2 capability JSON (fs, dialog, shell)
    tauri.conf.json            # app metadata, window config, sidecar allowlist
    Cargo.toml
  sidecar/                     # Python AI CLI
    pickr_sidecar/
      __main__.py              # CLI dispatcher (pickr-sidecar entry point)
      protocol.py              # NDJSON stdout helpers / stderr logging
      scan.py                  # scan_folder → manifest (mtime cache)
      thumbs.py                # HEIC decode, video frames, thumbnails
      ai.py                    # sharpness, pHash, Haar face count
      recognize.py             # face detection/recognition (OpenCV YuNet + SFace)
      dedup.py                 # pHash union-find grouping
    tests/                     # pytest (test_ai, test_scan)
    pyproject.toml
  docs/
    ARCHITECTURE.md            # this file
  THIRD_PARTY_LICENSES.md      # commercial license compliance listing
  NOTICE                       # standard attribution notice
```

## Sidecar CLI Contract

The Python sidecar is invoked as a subprocess: `pickr-sidecar <command> [args]`.
It is **argument-driven**, not stdin-driven.

### Output protocol

- stdout carries **only** newline-delimited JSON — one object per line.
- All logging/warnings go to **stderr**.
- Event shapes:
  - progress: `{"type":"progress","done":N,"total":M,"current":"file"}`
  - result:   `{"type":"result","data":<payload>}`
  - error:    `{"type":"error","message":"..."}`
- Exit codes: `0` success, `1` runtime error, `2` usage error. An `error` event
  is emitted before a non-zero exit.

### Commands

**`scan <folder>`** — Non-recursive scan of a folder for media
(`jpg jpeg png heic heif mp4 mov avi webm mkv`). Generates 320px-long-edge JPEG
thumbnails into `<folder>/.pickr/thumbs/` and caches results by source mtime in
`<folder>/.pickr/cache.json` (unchanged files are skipped on re-scan). Streams
`progress` events, then one `result` whose `data` is an array of manifest items:

```json
{
  "path": "/abs/photo.jpg",
  "filename": "photo.jpg",
  "kind": "image" | "video",
  "w": 4032, "h": 3024,
  "duration_sec": null | 12.5,
  "sharpness": 7,
  "face_count": 2,
  "phash": "abc123hex" | null,
  "thumb_path": "/abs/.pickr/thumbs/photo_thumb.jpg" | null,
  "faces": [ { "x":0,"y":0,"w":0,"h":0,"embedding_b64":"..." } ]
}
```

`faces` is populated by OpenCV's YuNet face detector + SFace recognizer (ONNX
models auto-downloaded on first use). Videos use a frame at 40% of duration for
analysis and thumbnailing. Face coordinates are absolute pixels.

**`dedup <manifest_json_path>`** — Reads a manifest JSON (a bare array, or
`{"data":[...]}`), groups items whose pHashes are within Hamming distance ≤ 8,
and adds `dup_group` (int) to each member. Items with no near duplicate get
`dup_group: null`. Emits `{"type":"result","data":[...updated manifest...]}`.

**`face_detect <image_or_video_path>`** — Detects faces in an image (or a
video's representative frame). Emits
`{"type":"result","data":[{"x","y","w","h","embedding_b64"}]}`. Embeddings are
base64 of a 128-d float64 vector.

**`face_match <embedding_b64> <manifest_json_path>`** — Compares the embedding
against every manifest item's `faces[].embedding_b64`; emits
`{"type":"result","data":["/abs/path1","/abs/path2"]}` for items whose cosine
similarity exceeds 0.6.

### Degradation

Face detection requires OpenCV 4.8+ (a core dependency). ONNX models for YuNet
and SFace are auto-downloaded to the platform cache on first use (~37 MB total).
Missing ffmpeg disables video thumbnails (logged to stderr, file still listed).
Unreadable/corrupt files are logged to stderr and skipped without failing the scan.

## Tauri Commands

Rust commands exposed to the frontend via `invoke()`. All are `async`. Implementations
live in `src-tauri/src/commands.rs`.

| Command | Signature | Description |
|---------|-----------|-------------|
| `pick_folder` | `() → Option<String>` | Opens native folder-picker dialog; returns selected path or null |
| `scan_folder` | `(path: String) → Vec<ManifestItem>` | Invokes sidecar `scan`, streams progress events via Tauri `emit`, returns manifest |
| `face_detect` | `(path: String) → Vec<FaceBox>` | Invokes sidecar `face_detect`; returns face bounding boxes + embeddings |
| `face_match` | `(embedding_b64: String, manifest_path: String) → Vec<String>` | Invokes sidecar `face_match`; returns matching file paths |
| `export_renamed` | `(items: Vec<ExportItem>, dest: String) → ()` | Copies files to destination folder with sequential rename |
| `save_project` | `(folder: String, project: ProjectJson) → ()` | Writes `.pickr/project.json` inside the folder |
| `load_project` | `(folder: String) → Option<ProjectJson>` | Reads `.pickr/project.json`; returns null when absent |
| `open_in_explorer` | `(path: String) → ()` | Reveals path in the OS file manager (cross-platform) |

## UI Components

### Top-level layout (`src/App.tsx`)

```
TopBar
  └─ folder open, export trigger, dark-mode toggle, SaveIndicator
[main area — switches on state]
  ScanProgress    (while scanning)
  SortableGrid    (folder open, scan done)
  EmptyState      (no folder selected)
Sidebar
  └─ FilterChips
Lightbox         (portal, shown on item selection)
ExportDialog     (portal, shown on export trigger)
Toaster          (sonner, bottom-right)
```

### Component responsibilities

**`TopBar`** — App header. Provides folder-open button (via `FolderContext`), export trigger, dark-mode toggle, and `SaveIndicator` status badge.

**`SortableGrid`** — dnd-kit `DndContext` + `SortableContext` wrapping a CSS grid of `Thumbnail` cards. Calls `applyFilters()` to get the visible ordered item list. Drag end updates `order` in the project store.

**`Thumbnail`** — Single grid cell. Renders the thumbnail image (or video badge), sharpness/dup/face badge overlays, selection checkbox, and a context menu (open in explorer, include/exclude).

**`Lightbox`** — Full-screen image viewer using `react-photo-view`. Keyboard shortcut `F` opens `FaceTagModal` for the current image.

**`Sidebar`** — Collapsible right panel. Currently hosts `FilterChips`.

**`FilterChips`** — Row of toggle buttons for sharpOnly, hasPeople, hideDuplicates, skippedOnly, and per-identity person filters.

**`ExportDialog`** — Modal dialog for choosing export destination and naming scheme; calls `export_renamed`.

**`ScanProgress`** — Displays a progress bar fed by Tauri events emitted during `scan_folder`.

**`EmptyState`** — Splash shown when no folder is open; prompts the user to open one.

**`SaveIndicator`** — Badge showing save status (idle / saving / saved / error). Receives status from `usePersistence`.

## Stores (`src/stores/`)

**`projectStore`** — Primary app state: `folder`, `items` (ManifestItem[]), `order` (path[]), `included` (Record<path, boolean>), `scanning`, `darkMode`. Mutations: `setFolder`, `setItems`, `setOrder`, `setIncluded`, `setScanning`, `toggleDarkMode`.

**`filtersStore`** — Filter toggle booleans (`sharpOnly`, `hasPeople`, `hideDuplicates`, `skippedOnly`, `personFilter`) and `searchQuery`. Exports `applyFilters(items, order, included, identities, filters, query)` as a pure selector.

**`identitiesStore`** — Face identity list: `Identity = { name, embedding_b64, color, files[] }`. Colors assigned from a fixed 10-color palette. `addIdentity` merges file lists when the name already exists.

## Features (`src/features/`)

**`usePersistence`** — Mounts once at app root. Subscribes to project + identities stores and debounces writes to `.pickr/project.json` (2 s after last change). Exposes `{ status, lastSaved, loadAndMerge }`. `loadAndMerge(folder, manifest)` reconciles a saved project with a fresh scan result: surviving paths keep their saved order/include state, new files default to `included=true`, missing files are dropped (including from identity `files[]`).

**`FaceTagModal`** — Opened from Lightbox via keyboard shortcut `F`. Props: `imagePath`, `onClose`. Displays detected face thumbnails and lets the user assign each to a named identity.

**`FilterChips`** — Renders filter toggles sourced from `filtersStore`. Includes per-identity chip buttons for person filtering.

**`dupHelpers`** (`getDupGroupInfo`) — Given an item and the full item list, returns `{ groupSize, isBest, color }` for rendering chain/stack badges on duplicate thumbnails.

## Data Flow

```
User opens folder
  → pick_folder (Tauri) → folder path
  → scan_folder (Tauri) → sidecar scan → ManifestItem[]
                        → Tauri events → ScanProgress UI
  → sidecar dedup       → dup_group fields added
  → loadAndMerge        → reconcile with .pickr/project.json
  → projectStore        → items, order, included

User drags thumbnail
  → SortableGrid onDragEnd → projectStore.setOrder
  → usePersistence debounce → save_project (Tauri)

User tags a face (Lightbox → F → FaceTagModal)
  → face_detect (Tauri) → FaceBox[]
  → identitiesStore.addIdentity
  → usePersistence debounce → save_project

User exports
  → ExportDialog → export_renamed (Tauri) → files copied to dest
```
