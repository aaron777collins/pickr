# Pickr — Usage Guide

Pickr helps you curate the best photos and videos from a folder: reorder them,
keep or skip each one, find the sharp shots, group people by face, and export a
clean, renamed set.

## Typical workflow

1. **Open Pickr.** The app launches to an empty start screen.

2. **Open a folder.** Click **Open Folder** and pick a directory of photos and
   videos. Pickr scans it (images and common video formats).

3. **Wait for scanning.** A progress bar shows how many files have been
   analyzed. During the scan Pickr measures sharpness, detects faces, and finds
   near-duplicates.

4. **Browse the grid.** Thumbnails appear in a grid. **Drag a thumbnail** to
   reorder — this order is what gets used on export.

5. **Open the lightbox.** Click any thumbnail to view it fullscreen. Use the
   arrow keys to move between items.

6. **Include or skip.** Toggle include/skip on items you don't want to export.
   Skipped items stay in the project (you can bring them back) but are excluded
   from the export.

7. **Filter to the best.** Use the sidebar filters:
   - **Sharp** — only sharp shots (sharpness ≥ 7).
   - **Has faces** — only items containing at least one detected face.
   - **Hide dupes** — collapse each duplicate group to its sharpest member.
   - **Skipped** — show only the items you've skipped.
   Filters combine with AND logic.

8. **Tag faces.** In the lightbox, press **F** to open the face tagger. Pickr
   draws a box around each detected face. Click a box, type a name, and press
   Enter. Re-using an existing name adds this photo to that person.

9. **Find matches.** After naming a face, click **Find &lt;name&gt;**. Pickr
   searches the whole folder for that person and reports how many other files
   they appear in, then auto-filters the grid to that person. Tagged people show
   up as colored chips under **People** in the sidebar — click one to filter.

10. **Export.** Click **Export**, choose a destination folder, and confirm.
    Pickr copies the included items in your chosen order, renamed sequentially.

11. **Close.** Your order, include/skip choices, and face tags **auto-save** to
    a `.pickr/` folder inside the source directory. Re-open the same folder
    later and everything comes back — even if you've since added or removed
    files (new files are appended; missing files are dropped).

## Keyboard shortcuts

Press `?` at any time to see the full shortcut list.

| Key       | Context   | Action                          |
|-----------|-----------|----------------------------------|
| `?`       | Global    | Show keyboard shortcuts          |
| `D`       | Global    | Toggle dark mode                 |
| Click     | Grid      | Open lightbox                    |
| Drag      | Grid      | Reorder thumbnails               |
| `Esc`     | Lightbox  | Close lightbox                   |
| `←` `→`   | Lightbox  | Previous / next item             |
| `Space`   | Lightbox  | Toggle include / skip            |
| `F`       | Lightbox  | Tag faces                        |

## Batch operations

Use the **Include All** / **Skip All** buttons in the stats bar to batch-toggle
all currently visible items. When filters are active, these only affect the
filtered set.

## Where your work is stored

Everything is saved under `<your folder>/.pickr/`:
- `manifest.json` — the scan results (sharpness, faces, duplicates).
- `project.json` — your order, include/skip choices, and named people.
- `thumbs/` — generated thumbnails.
- `cache.json` — mtime cache for fast re-scans.

These travel with the folder, so the same curation appears on any machine that
opens it.
