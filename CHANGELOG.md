# Changelog

## v0.3.0

### New Features
- **Smart filters** -- Sharp only, Has faces, Hide duplicates, Skipped only, and per-person filtering
- **Face recognition** -- detect faces, tag with names, find the same person across all photos
- **Duplicate detection** -- pHash-based near-duplicate grouping with best-in-group highlighting and colored badges
- **Project persistence** -- auto-save/load of order, include/skip choices, and face tags to `.pickr/project.json`
- **Search** -- real-time filename search filtering
- **Person filtering** -- tagged people appear as colored chips in the sidebar
- **Save indicator** -- live save status badge in the top bar
- **Batch operations** -- Include All / Skip All for visible items

### Improvements
- Robust Rust progress parsing for sidecar output
- Fixed nullable types for phash and thumb_path across the full stack
- Face coordinates use absolute pixels (not normalized)
- Project merge on re-open: surviving paths keep saved state, new files appended, missing files dropped
- Debounced auto-save (2s after last change) with suppression during load

### Infrastructure
- GitHub Actions release workflow -- builds for Windows, macOS (Intel + Apple Silicon), and Linux
- One-liner setup script (`setup.sh`) for Linux/macOS dev environments

## v0.1.0

- Initial release
- Folder scanning with AI analysis (sharpness, face count, pHash)
- Thumbnail grid with drag-and-drop reorder
- Fullscreen lightbox for photos and videos
- Include/skip toggle per item
- Export with sequential renaming
- Python sidecar CLI (scan, dedup, face_detect, face_match)
- Dark mode
- Keyboard shortcuts
