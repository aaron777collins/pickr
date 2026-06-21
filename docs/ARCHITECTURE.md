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
  sidecar/                # Python AI CLI (planned)
    cli.py
    requirements.txt
  docs/
    ARCHITECTURE.md       # this file
```

## Sidecar CLI Contract

_To be defined._ The Python sidecar will accept JSON commands on stdin and emit JSON results on stdout. Commands will include:

- `analyze_sharpness` -- Laplacian variance per image
- `find_duplicates` -- perceptual hash comparison
- `detect_faces` -- face bounding boxes + embeddings
- `recognize_faces` -- cluster faces by identity

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
