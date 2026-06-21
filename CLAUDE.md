# CLAUDE.md -- Pickr

## Stack
- Tauri 2 (Rust shell) + React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui (New York style, neutral palette)
- Zustand for state, dnd-kit for drag-and-drop
- Python sidecar for AI (sharpness, dedup, face recognition)

## Directory Layout
```
src/              # React frontend
src/components/   # UI components
src/components/ui/# shadcn primitives
src/lib/          # utilities
src-tauri/        # Rust backend (Tauri commands)
sidecar/          # Python CLI (not yet created)
docs/             # Architecture docs
```

## Run Commands
```bash
npm run dev          # Vite dev server (http://localhost:1420)
npm run tauri dev    # Full desktop app (first run compiles Rust)
npm run build        # Production build (frontend)
```

## Key Decisions
- Path alias: `@/` maps to `src/`
- shadcn components in `src/components/ui/`
- Tauri 2 capability-based permissions in `src-tauri/capabilities/`
- Python sidecar communicates via JSON over stdin/stdout
