# Architecture

## Directory Tree

```
pickr/
  src/                    # React frontend
    components/
      ui/                 # shadcn/ui primitives
      MediaGrid.tsx       # thumbnail grid (planned)
      Lightbox.tsx        # full-size preview (planned)
      Toolbar.tsx         # top bar actions (planned)
    stores/
      useSessionStore.ts  # Zustand store (planned)
    lib/
      utils.ts            # cn() helper
    App.tsx               # root component
    main.tsx              # entry point
    index.css             # Tailwind + shadcn theme
  src-tauri/              # Rust backend
    src/
      lib.rs              # Tauri setup + commands
      main.rs             # entry point
    capabilities/         # Tauri v2 permissions
    tauri.conf.json       # app config
    Cargo.toml
  sidecar/                # Python AI CLI
    pickr_sidecar/        # package
      __main__.py         # CLI dispatcher (pickr-sidecar entry point)
      protocol.py         # NDJSON stdout / stderr logging
      scan.py             # scan_folder -> manifest (+ mtime cache)
      thumbs.py           # HEIC decode, video frames, thumbnails
      ai.py               # sharpness, pHash, Haar face count
      recognize.py        # face_recognition wrapper (optional)
      dedup.py            # pHash union-find grouping
    tests/                # pytest (test_ai, test_scan)
    pyproject.toml
  docs/
    ARCHITECTURE.md       # this file
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
  "sharpness": 7,            // 1-10, Laplacian variance bucketed
  "face_count": 2,
  "phash": "abc123hex" | null,
  "thumb_path": "/abs/.pickr/thumbs/photo_thumb.jpg" | null,
  "faces": [ { "x":0,"y":0,"w":0,"h":0,"embedding_b64":"..." } ]
}
```

`faces` is populated only when `face_recognition` is installed; otherwise it is
`[]` and `face_count` comes from an OpenCV Haar cascade. Videos use a frame at
40% of duration for analysis and thumbnailing.

**`dedup <manifest_json_path>`** — Reads a manifest JSON (a bare array, or
`{"data":[...]}`), groups items whose pHashes are within Hamming distance ≤ 8,
and adds `dup_group` (int) to each member. Items with no near duplicate get
`dup_group: null`. Emits `{"type":"result","data":[...updated manifest...]}`.

**`face_detect <image_or_video_path>`** — Detects faces in an image (or a
video's representative frame). Emits
`{"type":"result","data":[{"x","y","w","h","embedding_b64"}]}`. Empty array if
`face_recognition` is unavailable. Embeddings are base64 of a 128-d float64 vector.

**`face_match <embedding_b64> <manifest_json_path>`** — Compares the embedding
against every manifest item's `faces[].embedding_b64`; emits
`{"type":"result","data":["/abs/path1","/abs/path2"]}` for items whose cosine
similarity exceeds 0.6.

### Degradation

`face_recognition` (dlib) is an optional extra. When absent, `scan` still runs,
`face_detect`/`face_match` return empty, and `face_count` falls back to Haar.
Missing ffmpeg disables video thumbnails (logged to stderr, file still listed).
Unreadable/corrupt files are logged to stderr and skipped without failing the scan.

## Tauri Commands

_To be defined._ Rust commands exposed to the frontend:

- `open_folder` -- native folder dialog, return list of media files
- `read_thumbnail` -- generate and cache thumbnail
- `export_files` -- copy/rename files to output folder
- `run_sidecar` -- invoke Python CLI subprocess
- `save_session` / `load_session` -- persist session JSON

## UI Components

_To be defined._ Key planned components:

- `MediaGrid` -- virtualized thumbnail grid with drag-and-drop
- `Lightbox` -- full-screen preview with zoom/pan
- `Toolbar` -- folder picker, export, filter controls
- `AIBadges` -- sharpness, duplicate, face indicators
- `FaceGallery` -- grouped face thumbnails
