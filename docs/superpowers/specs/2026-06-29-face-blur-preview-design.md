# Face Blur Preview & In-App Face Management

**Date:** 2026-06-29
**Status:** Approved

## Summary

Add a "Show Faces" mode that overlays detected face boxes on thumbnails and lightbox images. Users can tag/untag faces directly by clicking face boxes, toggle a blur preview for non-tagged faces, and export blurred copies. All non-destructive until export.

## Requirements

1. **Show Faces toggle** in top bar — overlays face bounding boxes on grid thumbnails and lightbox
2. **Blur Untagged toggle** in top bar — blurs non-tagged faces as an in-app preview (CSS-only, no file modification)
3. **Click-to-tag** — clicking a face box in lightbox opens a popover to tag or untag that face
4. **Untag support** — remove a face's identity tag (removes file from identity's files list)
5. **Export integration** — when blur preview is active, export dialog defaults blur toggle to on
6. **Easy to use** — minimal clicks, visual feedback, no modal-heavy workflows

## Architecture

### State

Add to `filtersStore.ts`:

```typescript
showFaces: boolean    // toggle face box overlays
blurUntagged: boolean // toggle blur preview for untagged faces
```

Actions: `toggleShowFaces()`, `toggleBlurUntagged()`.

### Identity Store Changes

Add to `identitiesStore.ts`:

```typescript
removeFileFromIdentity(name: string, filePath: string): void
```

Removes a file path from an identity's files list. If the identity has no files remaining, removes the identity entirely.

### UI Components

#### TopBar additions

Two new toggle buttons after existing controls:

1. **Show Faces** — Eye icon, toggles `showFaces`
2. **Blur Untagged** — EyeOff icon, toggles `blurUntagged`. Disabled unless `showFaces` is on.

#### Thumbnail face overlay (`FaceOverlay.tsx`)

New component rendered inside each `Thumbnail` when `showFaces` is true:

- Positioned absolutely within the thumbnail container
- For each face in `item.faces[]`:
  - Draw a colored border box using CSS (position calculated as percentage of image dimensions)
  - Tagged faces: identity color + small name label
  - Untagged faces: neutral gray border
- When `blurUntagged` is on:
  - Untagged face regions get a `backdrop-filter: blur(20px)` overlay div

Face coordinates from the manifest are absolute pixels. Convert to percentages:
- `left: (face.x / imageWidth) * 100%`
- `top: (face.y / imageHeight) * 100%`
- `width: (face.w / imageWidth) * 100%`
- `height: (face.h / imageHeight) * 100%`

Image natural dimensions are needed. For thumbnails, use the thumbnail's natural size. For lightbox, use the full image dimensions.

#### Lightbox face overlay

Same `FaceOverlay` component, but with click interaction:

- Clicking a face box opens a small popover anchored to the box
- Popover contents:
  - If tagged: shows identity name, "Untag" button
  - If untagged: "Tag as..." button that opens FaceTagModal scoped to that face's embedding
  - The FaceTagModal already supports tagging — pass the specific face data

#### FaceTagModal enhancement

Currently opens with `imagePath` and detects all faces. Add an optional prop:

```typescript
preselectedFace?: { x: number; y: number; w: number; h: number; embedding_b64: string }
```

When provided, skip detection and show only that face pre-selected for tagging.

### Data Flow

```
Scan manifest → item.faces[] (already populated)
       ↓
  showFaces toggle ON
       ↓
  FaceOverlay renders CSS boxes using face coordinates
       ↓
  User clicks face → popover → tag/untag
       ↓
  identitiesStore updated → persistence auto-saves
       ↓
  blurUntagged toggle ON → CSS blur on untagged face divs
       ↓
  Export → existing blur_export sidecar (actual pixel blur)
```

### Export Dialog Integration

In `ExportDialog.tsx`:
- Read `blurUntagged` from filters store
- If `blurUntagged` is true when dialog opens, default `blurFaces` state to `true`

## What's NOT Included

- No face gallery sidebar panel
- No per-thumbnail individual blur toggle (bulk only via top bar)
- No original file modification (blurred files only created at export)
- No real-time sidecar blur calls for preview (CSS blur only)

## Testing

- Unit: `removeFileFromIdentity` store action
- Unit: FaceOverlay coordinate calculation (percentage positioning)
- Visual: face boxes align correctly on thumbnails and lightbox at various image sizes
- Visual: blur preview renders correctly on untagged faces
- Integration: tag → untag → re-tag flow works end-to-end
- Integration: export with blur produces correct output
