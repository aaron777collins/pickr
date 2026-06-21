# Pickr — Project Handoff Brief

## What you're building

**Pickr** — a desktop app for picking the best photos and videos out of a folder, dragging them into the order you want, and exporting renamed/numbered copies (so a video editor pulls them in order). Aimed at people making slideshows, video intros, or social-media reels who don't want a full NLE just to curate.

Origin: the user just hand-curated 39 shots from ~50 files for a Christian children's-book intro video. The process was painful enough that this tool is the productized version of that workflow.

## Tech stack (locked in)

- **Tauri 2.x** (Rust shell, native window, ~10MB binary)
- **React 18 + TypeScript + Vite**
- **Tailwind CSS v4** (`@tailwindcss/vite` plugin, `@import "tailwindcss"` in CSS)
- **shadcn/ui** components
- **dnd-kit** for drag-to-reorder grid
- **zustand** for state
- **lucide-react** for icons
- **react-photo-view** for image lightbox (video lightbox custom with HTML5 `<video>`)
- **Python sidecar** (spawned by Tauri) for: HEIC convert, video thumbnail extraction, sharpness scoring, perceptual-hash dedup, OpenCV face detection, `face_recognition` (dlib) for face matching
- **MIT license**
- **Public GitHub repo**

## Scope

### v1 (build this session)
- Folder picker → grid of thumbnails (HEIC, JPG, PNG, MP4, MOV)
- **Drag-to-reorder** via dnd-kit (sortable grid)
- Click thumbnail → **fullscreen lightbox** with image viewer or video player (HTML5 controls)
- **Include / Skip** toggle per item (skipped items dimmed, excluded from export)
- **AI badges** on thumbnails (computed once per folder, cached):
  - Sharpness (Laplacian variance, 1–10)
  - Face count (OpenCV Haar)
  - Duplicate group ID (pHash, similar items stacked)
- **Face recognition workflow:**
  - User clicks a thumbnail → "Tag faces" → app draws boxes on detected faces
  - User types a name on a face (e.g., "Zophia") → embedding saved
  - App shows all other thumbnails containing that face (subtle highlight + filter chip)
- **Export** ordered Include-marked items to a chosen output folder, prefixed `01_`, `02_`, etc.
- **Save/load project** as a JSON file in the source folder (so you can close and reopen)

### v2 (defer)
- **Face blurring on export** — non-tagged faces blurred Gaussian, per-frame for videos via ffmpeg + face tracking
- **Aesthetic scoring** — NIMA model, badge alongside sharpness
- **Captioning** — BLIP-2 or LLaVA, "young woman reading to children" tags

## Architecture

```
pickr/
├── src/                       # React UI
│   ├── components/            # shadcn + custom
│   ├── features/
│   │   ├── grid/             # SortableGrid, Thumbnail
│   │   ├── lightbox/         # ImageLightbox, VideoLightbox
│   │   ├── face-tag/         # FaceTagModal, identity store
│   │   ├── filters/          # FilterChips, AI badge filters
│   │   └── export/           # ExportDialog
│   ├── stores/               # zustand: project, identities, filters
│   ├── lib/                  # tauri command wrappers
│   └── App.tsx
├── src-tauri/                 # Rust shell
│   ├── src/
│   │   ├── lib.rs            # commands registered here
│   │   └── commands.rs       # scan_folder, export_renamed, save_project, etc.
│   └── tauri.conf.json
├── sidecar/                   # Python media analysis
│   ├── pickr_sidecar/
│   │   ├── __main__.py       # CLI dispatcher
│   │   ├── scan.py           # scan_folder → manifest.json
│   │   ├── thumbs.py         # generate thumbnails (HEIC + video)
│   │   ├── ai.py             # sharpness, pHash, face detection
│   │   └── recognize.py      # face_recognition wrapper
│   ├── pyproject.toml
│   └── README.md
├── LICENSE                    # MIT
├── README.md
├── CLAUDE.md                  # notes for future Claude sessions
└── docs/ARCHITECTURE.md
```

**Communication:**
- Tauri commands invoke the Python sidecar as a subprocess. Stdin: JSON request, stdout: JSON response (newline-delimited for streaming progress).
- All file paths stay on disk; the UI references absolute paths via `convertFileSrc` for `<img>`/`<video>`.
- Project state autosaves to `.pickr.json` in the source folder.

## Repo location

User suggested `/c/dev/repos/pickr` from the Windows laptop. On your dev server, pick whatever works — e.g. `~/dev/pickr` or `~/code/pickr`. Push to **public GitHub** as `pickr` under the user's account.

## Conventions

- **Commit footer:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **PR style:** small, focused; describe what + why; no `--no-verify`
- **License:** MIT, copyright 2026 contributors
- **Code style:** Prettier defaults, ESLint with the Vite-React-TS preset, no comments unless explaining a non-obvious *why*

## Setup prereqs to install if missing

- Rust + cargo (rustup)
- Node 20+
- Python 3.10+
- `gh` CLI (and `gh auth login` should already be done)
- System deps for Python sidecar: `ffmpeg` (system or `imageio-ffmpeg` pip), `cmake` + `dlib` build deps for `face_recognition` on Linux: `sudo apt install cmake build-essential libopenblas-dev liblapack-dev libx11-dev libgtk-3-dev`

## Agent dispatch plan

Run **Agent 1 first (sequential)** — everything else depends on the scaffold existing. Then run **Agents 2, 3, 4, 5 in parallel**.

---

### AGENT 1 — Scaffold (run alone, first)

Scaffold a new public open-source project called **Pickr** — a photo & video curation tool. Stack is locked: Tauri 2 + React 18 + TS + Vite + Tailwind CSS v4 (via `@tailwindcss/vite`) + shadcn/ui + dnd-kit + zustand + lucide-react + react-photo-view. MIT license.

Steps:
1. Verify Rust, Node 20+, gh CLI present. Install if missing.
2. `mkdir -p ~/dev/pickr` (or wherever your code lives), `cd` in.
3. Bootstrap Tauri 2: `npm create tauri-app@latest pickr -- --template react-ts --manager npm`.
4. Add Tailwind v4 via `@tailwindcss/vite` plugin; add `@import "tailwindcss";` to the main CSS.
5. Init shadcn/ui (`npx shadcn@latest init`, neutral colors, CSS variables) and add components: `button, dialog, dropdown-menu, card, badge, tooltip, slider, input, tabs, toggle, separator, scroll-area, sonner`.
6. Install deps: `npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities lucide-react react-photo-view zustand`.
7. Replace default `App.tsx` with a centered shadcn Card: title "Pickr — curate the best from a folder of photos and videos", subtitle "WIP scaffold", and a single Button that fires a `sonner` toast.
8. Create `LICENSE` (MIT, 2026 contributors), `README.md` (project pitch + v1/v2 scope from this brief + WIP warning), `CLAUDE.md` (terse notes for future sessions: stack, layout, run commands, lessons), `.gitignore` (Tauri + Node), `docs/ARCHITECTURE.md` (stub for other agents to fill).
9. `npm run dev` to confirm Vite compiles. Try `npm run tauri build` if Rust+system deps allow; document any prereqs hit.
10. `git init`, commit with `Initial scaffold (Tauri + React + TS + Tailwind v4 + shadcn/ui)`, footer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
11. `gh repo create pickr --public --source=. --push --description "Drag-to-reorder photo/video curation tool with AI helpers (sharpness, dedup, face recognition). Tauri + React. MIT."`

**Do not implement any features.** Return: GH URL, local path, dev-server working?, install issues. Under 300 words.

---

### AGENT 2 — Python sidecar (run after Agent 1, parallel with 3/4/5)

You're working in the `pickr/` repo. Build the **Python sidecar** under `sidecar/` that the Tauri Rust backend will invoke as a subprocess.

Stack: Python 3.10+, `pillow + pillow-heif` (HEIC), `opencv-python` (face detection + Laplacian), `imagehash` (pHash dedup), `face_recognition` (dlib-based, for embeddings + matching), `imageio-ffmpeg` (bundled ffmpeg for video work).

CLI design — `pickr-sidecar <command> [args] [--json-stdin]`:

- `scan <folder>` → emit a manifest of all media files in the folder (non-recursive). For each item: `{path, kind: image|video, w, h, duration_sec?, sharpness, face_count, phash, thumb_path}`. Generates thumbnails into `<folder>/.pickr/thumbs/` (320px long edge). For HEIC, decode via pillow-heif. For videos, extract a representative frame (40% into the duration) via ffmpeg. Caches per-file: skip work if thumb + manifest entry already exists and source mtime unchanged.
- `dedup <manifest.json>` → group items by perceptual hash similarity (Hamming distance ≤ 8 = same group). Add `dup_group` field to each entry.
- `face_detect <path>` → return list of `{x, y, w, h, embedding_b64}` for each face in the image. For videos, sample mid-frame.
- `face_match <embedding_b64> <manifest.json>` → return list of paths whose detected faces match this embedding (cosine sim > 0.6).

Output format: one JSON object per line on stdout, with progress events: `{type: "progress", done: N, total: M, current: "filename"}` and a final `{type: "result", data: {...}}`.

Stream progress incrementally so the UI can show a progress bar.

Setup: `pyproject.toml` with deps + a `pickr-sidecar` console script entry point. `README.md` in `sidecar/` explaining how to install + invoke standalone.

Write tests for the core analysis functions (sharpness scoring with a known sharp + known blurry image; pHash returning identical hash for the same image, different for a different one). Use pytest.

Commit when working, push. Update `docs/ARCHITECTURE.md` with the sidecar's CLI contract so the Rust agent and UI agent can integrate.

---

### AGENT 3 — Tauri Rust commands (run after Agent 1, parallel with 2/4/5)

Wire up Tauri commands in `src-tauri/src/commands.rs`. All commands are async. Register in `lib.rs` via `tauri::generate_handler!`.

Commands:
- `pick_folder() -> Result<String, String>` — opens native folder dialog, returns selected path.
- `scan_folder(path: String) -> Result<Manifest, String>` — spawns Python sidecar `pickr-sidecar scan <path>`, streams progress via Tauri events (`emit("scan-progress", ...)`), returns the final manifest. Look up the sidecar binary by checking these in order: `$PICKR_SIDECAR_PATH`, `which pickr-sidecar`, `./sidecar/.venv/bin/pickr-sidecar`. Report a friendly error if not found.
- `face_detect(path: String) -> Result<Vec<FaceBox>, String>` — sidecar call.
- `face_match(embedding: String, manifest_path: String) -> Result<Vec<String>, String>` — sidecar call.
- `export_renamed(items: Vec<ExportItem>, dest_folder: String) -> Result<ExportSummary, String>` — copies each item with `NN_` prefix to dest folder. `ExportItem = {src_path, order_index, include}` — skip if include=false.
- `save_project(folder: String, project: ProjectJson) -> Result<(), String>` — writes `<folder>/.pickr.json` atomically (write tmp then rename).
- `load_project(folder: String) -> Result<Option<ProjectJson>, String>` — reads `<folder>/.pickr.json` if exists.
- `open_in_explorer(path: String) -> Result<(), String>` — reveals a file in OS file manager.

Use `serde` for all DTOs. Mirror these types in `src/lib/types.ts` (TypeScript) so the UI agent has them.

Coordinate with the UI agent on the exact event/payload shapes; commit your types first.

---

### AGENT 4 — Core UI: grid + drag-reorder + lightbox (run after Agent 1, parallel with 2/3/5)

Build the main UI in `src/`. Stack already installed: shadcn/ui, dnd-kit, zustand, react-photo-view, lucide-react.

Components to build:

1. **`TopBar`** — left: app name + current folder path (truncated, click to open in OS file manager). Center: search box (filter by filename). Right: "Open Folder" button (calls `pick_folder` + `scan_folder`), "Export" button (opens ExportDialog).

2. **`SortableGrid`** — uses dnd-kit `DndContext` + `SortableContext` (rectSwappingStrategy) to show all manifest items as a responsive grid. Each `Thumbnail` is draggable. Order persisted to zustand store.

3. **`Thumbnail`** — square card with image preview (use `convertFileSrc(thumb_path)`), play icon overlay if video, include/skip toggle (eye icon top-right, dim when skipped), badge row at bottom (sharpness color-coded green/amber/red, face count "👤 3", duplicate group badge "📑 +2 similar"). Hover shows file name tooltip. Click opens lightbox.

4. **`Lightbox`** — fullscreen overlay. Image: react-photo-view zoom/pan. Video: HTML5 `<video controls>` autoplay, no autoloop. Keyboard nav: left/right between items, Space = toggle include, F = open face-tag modal, Esc = close.

5. **`ExportDialog`** — shadcn Dialog. Lets user pick destination folder, optional prefix length (default 2-digit `01_`), checkbox "copy" vs "move", shows summary "Export 32 of 48 items to /path/...". Confirm → calls `export_renamed`. Toast on success.

6. **`Sidebar`** (collapsible right panel) — placeholder for Agent 5 to populate with filter chips + face identity list.

State (zustand, `useProjectStore`):
- `folder: string | null`
- `items: ManifestItem[]` (manifest from sidecar)
- `order: string[]` (paths in user's chosen order)
- `included: Record<string, boolean>` (default true)
- `lightboxIndex: number | null`

UX polish:
- Smooth drag animation (dnd-kit handles).
- Optimistic include/skip toggle.
- "Sticky" top bar.
- Dark mode toggle in top bar (CSS class on html).
- When dragging, show a faint "drop indicator".
- Loading state during initial scan (progress bar fed from Tauri scan-progress event).

Don't implement face-tagging (Agent 5). Don't implement AI badges' *interactivity* — just render them from the manifest fields.

---

### AGENT 5 — Filters, face recognition, persistence (run after Agent 1, parallel with 2/3/4)

Add the AI-flavored features layered on top of Agents 3 + 4's work.

1. **`FilterChips`** in the sidebar:
   - Toggle chips: "Sharp only" (sharpness ≥ 7), "Has people" (face_count ≥ 1), "Hide duplicates" (collapse each `dup_group` to one item), "Skipped only".
   - "Person:" chips populated from labeled identities (see below) — click to filter to only photos containing that face.
   - Filter logic lives in a zustand store `useFiltersStore`; the grid reads filtered+ordered list.

2. **`FaceTagModal`** (opens from Lightbox 'F' key or thumbnail context menu):
   - Calls `face_detect(path)` via Tauri.
   - Overlays bounding boxes on the image.
   - User clicks a box → input field appears → user types name → embedding + name saved to `useIdentitiesStore`.
   - After labeling, "Find matches" button calls `face_match` and toasts "found in 17 other files; filter applied".

3. **`useIdentitiesStore`** (zustand):
   - `identities: { name, embedding_b64, color, files: string[] }[]`
   - Adds a colored dot to thumbnails of files containing each tagged person.

4. **Persistence:**
   - On any meaningful state change (order, included, identities, filters), debounce-save to `<folder>/.pickr.json` via `save_project`.
   - On folder open, call `load_project` first; merge with fresh manifest (handle files added/removed since last session).
   - Show a small "Saved 2s ago" indicator in the top bar.

5. **Duplicate stack UX:** when "Hide duplicates" off, mark dup-group members with a small chain icon + shared color border so users can see them as a set. When on, only the highest-sharpness member of each group is shown; tooltip says "+3 similar hidden".

Update `CLAUDE.md` with notes on the identity store + project file schema. Add a docs/USAGE.md walking through the typical user journey.

---

## Notes for the orchestrating Claude

- Spawn Agent 1 first; wait for its summary (and the gh URL) before fanning out.
- Then dispatch Agents 2, 3, 4, 5 **in parallel** (single message with 4 tool calls).
- Once they're all back, do an integration pass yourself: run `npm run tauri dev`, click through the happy path, fix integration mismatches (most likely: type mismatches between Rust DTOs and TS types, sidecar path detection on Linux, event names not matching).
- Then commit a final `v0.1` release tag and update README with screenshots.
- The original Tzophia photo project lives at `C:\Users\aaron\OneDrive\Desktop\TzophiaIntroPictures\` on the user's laptop — not on the dev server. Use synthetic test fixtures (a small folder of public-domain photos + a video clip) for testing on the server.

---

That's the whole brief. The user is closing their laptop — when they come back, they'll point you at the dev-server Pickr repo with screenshots of where things stand. Build clean, ship a working v0.1, and we'll iterate on face blurring + aesthetic scoring in v2.
