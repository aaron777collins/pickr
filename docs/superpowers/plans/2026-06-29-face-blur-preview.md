# Face Blur Preview & In-App Face Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Show Faces" and "Blur Untagged" toggles that overlay face boxes on thumbnails and lightbox, let users click to tag/untag faces, preview blur in-app via CSS, and default the export dialog blur toggle when blur preview is active.

**Architecture:** Face boxes already exist in `.pickr/manifest.json` but are stripped before reaching the frontend. We add `faces` to the Rust `ManifestItem` struct and TS type so boxes are available in the store. Two new filter-store booleans (`showFaces`, `blurUntagged`) drive a new `FaceOverlay` component that renders CSS-positioned boxes over thumbnails and lightbox images. Clicking a face in the lightbox opens a popover for tagging/untagging. CSS `backdrop-filter: blur()` handles the in-app blur preview — actual pixel blurring only happens at export.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS v4, Tauri 2 (Rust), lucide-react icons

## Global Constraints

- Path alias: `@/` maps to `src/`
- shadcn components use Base UI (`@base-ui/react`), not Radix
- Face coordinates from sidecar are absolute pixels
- Tailwind CSS v4 (no `tailwind.config.js` — use CSS-based config)
- Existing patterns: Zustand stores in `src/stores/`, features in `src/features/`, shadcn primitives in `src/components/ui/`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src-tauri/src/commands.rs` | Add `faces: Vec<FaceBox>` to `ManifestItem`, remove stripping in `scan_folder` |
| Modify | `src/lib/types.ts` | Add `faces: FaceBox[]` to `ManifestItem` |
| Modify | `src/stores/filtersStore.ts` | Add `showFaces`, `blurUntagged` state + toggles |
| Modify | `src/stores/identitiesStore.ts` | Add `removeFileFromIdentity` action |
| Create | `src/components/FaceOverlay.tsx` | Renders face boxes + blur overlays over an image container |
| Modify | `src/components/Thumbnail.tsx` | Wrap image in relative container, render `FaceOverlay` when `showFaces` on |
| Modify | `src/components/Lightbox.tsx` | Render `FaceOverlay` with click handler, add face popover for tag/untag |
| Modify | `src/features/face-tag/FaceTagModal.tsx` | Add optional `preselectedFace` prop to skip detection |
| Modify | `src/features/filters/FilterChips.tsx` | Add Show Faces + Blur Untagged chips |
| Modify | `src/components/ExportDialog.tsx` | Default `blurFaces` to true when `blurUntagged` is active |

---

### Task 1: Add `faces` field to ManifestItem (Rust + TypeScript)

**Files:**
- Modify: `src-tauri/src/commands.rs:14-28` (ManifestItem struct)
- Modify: `src-tauri/src/commands.rs:344-350` (ScanResultItem)
- Modify: `src-tauri/src/commands.rs:429` (scan_folder return)
- Modify: `src/lib/types.ts:1-14` (ManifestItem interface)

**Interfaces:**
- Consumes: Existing `FaceBox` struct/type (already defined in both Rust and TS)
- Produces: `ManifestItem.faces: FaceBox[]` — used by Task 4 (FaceOverlay) and Task 6 (Lightbox)

- [ ] **Step 1: Add `faces` to Rust ManifestItem**

In `src-tauri/src/commands.rs`, add the field to `ManifestItem`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestItem {
    pub path: String,
    pub filename: String,
    pub kind: String,
    pub w: u32,
    pub h: u32,
    pub duration_sec: Option<f64>,
    pub sharpness: u32,
    pub face_count: u32,
    pub phash: Option<String>,
    pub thumb_path: Option<String>,
    pub dup_group: Option<u32>,
    pub preview_path: Option<String>,
    #[serde(default)]
    pub faces: Vec<FaceBox>,
}
```

- [ ] **Step 2: Remove face stripping in scan_folder**

The `ScanResultItem` wrapper and its face-stripping return are no longer needed. But `ScanResultItem` is also used by `run_dedup` and `save_manifest`, which rely on `#[serde(flatten)]` to preserve extra sidecar JSON fields. Since `faces` is now on `ManifestItem`, change `ScanResultItem.faces` to be empty and update the return:

In `scan_folder`, change line 429 from:
```rust
Ok(items.into_iter().map(|i| i.base).collect())
```
to:
```rust
Ok(items.into_iter().map(|i| i.base).collect())
```

Actually, since `ManifestItem` now has `faces` via `#[serde(default)]` and `ScanResultItem` uses `#[serde(flatten)]`, the faces from sidecar JSON will deserialize into `ManifestItem.faces` directly. Remove the separate `faces` field from `ScanResultItem`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScanResultItem {
    #[serde(flatten)]
    base: ManifestItem,
}
```

The `scan_folder` return (`items.into_iter().map(|i| i.base).collect()`) already works — `base` now includes faces.

- [ ] **Step 3: Add `faces` to TypeScript ManifestItem**

In `src/lib/types.ts`:

```typescript
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
```

- [ ] **Step 4: Build and verify**

Run: `cd /home/ubuntu/repos/pickr && npm run build 2>&1 | tail -5`

Expected: Build succeeds. The `faces` field is additive so no existing code breaks.

Also verify Rust compiles: `cd /home/ubuntu/repos/pickr/src-tauri && cargo check 2>&1 | tail -5`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs src/lib/types.ts
git commit -m "feat: include face boxes in ManifestItem passed to frontend"
```

---

### Task 2: Add `showFaces` / `blurUntagged` state and `removeFileFromIdentity` action

**Files:**
- Modify: `src/stores/filtersStore.ts:4-16` (FiltersState interface), `src/stores/filtersStore.ts:21-42` (store creation)
- Modify: `src/stores/identitiesStore.ts:17-25` (IdentitiesState interface), `src/stores/identitiesStore.ts:31-77` (store)

**Interfaces:**
- Consumes: Nothing new
- Produces:
  - `useFiltersStore` new fields: `showFaces: boolean`, `blurUntagged: boolean`, `toggleShowFaces(): void`, `toggleBlurUntagged(): void`
  - `useIdentitiesStore` new action: `removeFileFromIdentity(name: string, filePath: string): void`

- [ ] **Step 1: Add state to filtersStore**

In `src/stores/filtersStore.ts`, update the interface and store:

```typescript
export interface FiltersState {
  sharpOnly: boolean;
  hasPeople: boolean;
  hideDuplicates: boolean;
  skippedOnly: boolean;
  personFilter: string | null;
  showFaces: boolean;
  blurUntagged: boolean;

  toggleSharpOnly: () => void;
  toggleHasPeople: () => void;
  toggleHideDuplicates: () => void;
  toggleSkippedOnly: () => void;
  setPersonFilter: (name: string | null) => void;
  toggleShowFaces: () => void;
  toggleBlurUntagged: () => void;
  clearAll: () => void;
}
```

In the store creation, add default values and toggles:

```typescript
showFaces: false,
blurUntagged: false,

toggleShowFaces: () =>
  set((s) => ({
    showFaces: !s.showFaces,
    blurUntagged: !s.showFaces ? s.blurUntagged : false,
  })),
toggleBlurUntagged: () =>
  set((s) => ({ blurUntagged: s.showFaces ? !s.blurUntagged : false })),
```

Update `clearAll` to also reset the new fields:

```typescript
clearAll: () =>
  set({
    sharpOnly: false,
    hasPeople: false,
    hideDuplicates: false,
    skippedOnly: false,
    personFilter: null,
    showFaces: false,
    blurUntagged: false,
  }),
```

Note: `toggleShowFaces` turns off `blurUntagged` when faces are hidden. `toggleBlurUntagged` only works when `showFaces` is on.

- [ ] **Step 2: Add `removeFileFromIdentity` to identitiesStore**

In `src/stores/identitiesStore.ts`, add to the interface:

```typescript
removeFileFromIdentity: (name: string, filePath: string) => void;
```

Add implementation after `addFilesToIdentity`:

```typescript
removeFileFromIdentity: (name, filePath) =>
  set((s) => {
    const updated = s.identities
      .map((i) =>
        i.name === name
          ? { ...i, files: i.files.filter((f) => f !== filePath) }
          : i
      )
      .filter((i) => i.files.length > 0);
    return { identities: updated };
  }),
```

This removes the file from the identity and auto-deletes the identity if it has no files left.

- [ ] **Step 3: Build to verify**

Run: `cd /home/ubuntu/repos/pickr && npm run build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/stores/filtersStore.ts src/stores/identitiesStore.ts
git commit -m "feat: add showFaces/blurUntagged state and removeFileFromIdentity action"
```

---

### Task 3: Add Show Faces & Blur Untagged chips to FilterChips

**Files:**
- Modify: `src/features/filters/FilterChips.tsx`

**Interfaces:**
- Consumes: `useFiltersStore` — `showFaces`, `blurUntagged`, `toggleShowFaces`, `toggleBlurUntagged` (from Task 2)
- Produces: UI chips in the sidebar for toggling face overlays

- [ ] **Step 1: Add chips to FilterChips**

In `src/features/filters/FilterChips.tsx`, add imports and chips:

Add `ScanFace, Blur` to the lucide-react import (use `CircleOff` since `Blur` doesn't exist in lucide):

```typescript
import { CircleOff, EyeOff, Layers, ScanFace, Sparkles, Users } from "lucide-react";
```

Destructure the new state from the store (add to the existing destructuring):

```typescript
const {
  sharpOnly,
  hasPeople,
  hideDuplicates,
  skippedOnly,
  personFilter,
  showFaces,
  blurUntagged,
  toggleSharpOnly,
  toggleHasPeople,
  toggleHideDuplicates,
  toggleSkippedOnly,
  setPersonFilter,
  toggleShowFaces,
  toggleBlurUntagged,
  clearAll,
} = useFiltersStore();
```

Update `anyActive` to include the new state:

```typescript
const anyActive =
  sharpOnly || hasPeople || hideDuplicates || skippedOnly || !!personFilter || showFaces;
```

Add new chips after the "Skipped" chip inside the flex-wrap div:

```tsx
<Chip
  active={showFaces}
  onClick={toggleShowFaces}
  icon={<ScanFace className="size-3.5" />}
  label="Show faces"
/>
{showFaces && (
  <Chip
    active={blurUntagged}
    onClick={toggleBlurUntagged}
    icon={<CircleOff className="size-3.5" />}
    label="Blur untagged"
  />
)}
```

- [ ] **Step 2: Build to verify**

Run: `cd /home/ubuntu/repos/pickr && npm run build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/features/filters/FilterChips.tsx
git commit -m "feat: add Show Faces and Blur Untagged filter chips"
```

---

### Task 4: Create FaceOverlay component

**Files:**
- Create: `src/components/FaceOverlay.tsx`

**Interfaces:**
- Consumes:
  - `FaceBox` type from `@/lib/types`
  - `Identity` type from `@/lib/types`
  - `useIdentitiesStore` — `identities` array
  - `useFiltersStore` — `blurUntagged` boolean
- Produces: `<FaceOverlay faces={FaceBox[]} imageW={number} imageH={number} onFaceClick?: (index: number) => void />` — renders positioned face boxes over an image; used by Task 5 (Thumbnail) and Task 6 (Lightbox)

- [ ] **Step 1: Create the FaceOverlay component**

Create `src/components/FaceOverlay.tsx`:

```tsx
import { useFiltersStore } from "@/stores/filtersStore";
import { useIdentitiesStore } from "@/stores/identitiesStore";
import { cosineMatch } from "@/lib/faceUtils";
import type { FaceBox } from "@/lib/types";

interface FaceOverlayProps {
  faces: FaceBox[];
  imageW: number;
  imageH: number;
  onFaceClick?: (index: number) => void;
}

export function FaceOverlay({ faces, imageW, imageH, onFaceClick }: FaceOverlayProps) {
  const blurUntagged = useFiltersStore((s) => s.blurUntagged);
  const identities = useIdentitiesStore((s) => s.identities);

  if (imageW === 0 || imageH === 0 || faces.length === 0) return null;

  return (
    <>
      {faces.map((face, i) => {
        const match = identities.find((id) =>
          cosineMatch(face.embedding_b64, id.embedding_b64)
        );
        const color = match?.color ?? "#9ca3af";
        const left = (face.x / imageW) * 100;
        const top = (face.y / imageH) * 100;
        const width = (face.w / imageW) * 100;
        const height = (face.h / imageH) * 100;

        return (
          <div key={i}>
            <div
              onClick={(e) => {
                e.stopPropagation();
                onFaceClick?.(i);
              }}
              className="absolute z-10 cursor-pointer transition-shadow hover:shadow-[0_0_0_3px_rgba(255,255,255,0.4)]"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                border: `2px solid ${color}`,
              }}
            >
              {match && (
                <span
                  className="absolute -top-5 left-0 whitespace-nowrap rounded px-1 py-0.5 text-[9px] font-medium leading-none text-white"
                  style={{ backgroundColor: color }}
                >
                  {match.name}
                </span>
              )}
            </div>
            {blurUntagged && !match && (
              <div
                className="pointer-events-none absolute z-[9]"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Create face matching utility**

Create `src/lib/faceUtils.ts`:

```typescript
const MATCH_THRESHOLD = 0.6;

function decodeEmbedding(b64: string): Float64Array {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Float64Array(bytes.buffer);
}

function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function cosineMatch(embA: string, embB: string): boolean {
  return cosineSimilarity(decodeEmbedding(embA), decodeEmbedding(embB)) > MATCH_THRESHOLD;
}
```

- [ ] **Step 3: Build to verify**

Run: `cd /home/ubuntu/repos/pickr && npm run build 2>&1 | tail -5`

Expected: Build succeeds (FaceOverlay is not yet rendered anywhere, but should compile).

- [ ] **Step 4: Commit**

```bash
git add src/components/FaceOverlay.tsx src/lib/faceUtils.ts
git commit -m "feat: create FaceOverlay component and cosine matching utility"
```

---

### Task 5: Render FaceOverlay on Thumbnails

**Files:**
- Modify: `src/components/Thumbnail.tsx`

**Interfaces:**
- Consumes:
  - `FaceOverlay` from `@/components/FaceOverlay` (Task 4)
  - `useFiltersStore` — `showFaces` (Task 2)
  - `ManifestItem.faces` (Task 1)
- Produces: Face boxes rendered on grid thumbnails when `showFaces` is on

- [ ] **Step 1: Add FaceOverlay to Thumbnail**

In `src/components/Thumbnail.tsx`, add imports:

```typescript
import { useFiltersStore } from "@/stores/filtersStore";
import { FaceOverlay } from "@/components/FaceOverlay";
```

Inside the `Thumbnail` component, read `showFaces`:

```typescript
const showFaces = useFiltersStore((s) => s.showFaces);
```

Add the overlay after the thumbnail image (after the `{item.thumb_path ? ... }` block, before the video PlayCircle overlay). Place it right after the img tag's closing or the placeholder div:

```tsx
{showFaces && item.faces.length > 0 && (
  <FaceOverlay
    faces={item.faces}
    imageW={item.w}
    imageH={item.h}
  />
)}
```

The `Thumbnail` already has `className="... relative ..."` on the container and `overflow-hidden`, so absolutely-positioned overlays will be clipped correctly.

- [ ] **Step 2: Build to verify**

Run: `cd /home/ubuntu/repos/pickr && npm run build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/Thumbnail.tsx
git commit -m "feat: render face overlays on thumbnails when Show Faces is on"
```

---

### Task 6: Render FaceOverlay in Lightbox with tag/untag popover

**Files:**
- Modify: `src/components/Lightbox.tsx`

**Interfaces:**
- Consumes:
  - `FaceOverlay` from `@/components/FaceOverlay` (Task 4)
  - `useFiltersStore` — `showFaces` (Task 2)
  - `useIdentitiesStore` — `identities`, `removeFileFromIdentity` (Task 2)
  - `cosineMatch` from `@/lib/faceUtils` (Task 4)
  - `ManifestItem.faces` (Task 1)
  - `FaceTagModal` with `preselectedFace` prop (Task 7)
- Produces: Face boxes on lightbox image, click-to-tag/untag popover

- [ ] **Step 1: Add face overlay + popover state to Lightbox**

In `src/components/Lightbox.tsx`, add imports:

```typescript
import { useFiltersStore } from "@/stores/filtersStore";
import { useIdentitiesStore } from "@/stores/identitiesStore";
import { FaceOverlay } from "@/components/FaceOverlay";
import { cosineMatch } from "@/lib/faceUtils";
import type { FaceBox } from "@/lib/types";
```

Add state for the face popover inside the `Lightbox` component:

```typescript
const showFaces = useFiltersStore((s) => s.showFaces);
const identities = useIdentitiesStore((s) => s.identities);
const removeFileFromIdentity = useIdentitiesStore((s) => s.removeFileFromIdentity);
const [activeFaceIndex, setActiveFaceIndex] = useState<number | null>(null);
```

Reset `activeFaceIndex` when item changes — add to the existing reset effect:

```typescript
useEffect(() => {
  setTagging(false);
  setActiveFaceIndex(null);
}, [item?.path, open]);
```

- [ ] **Step 2: Wrap image in relative container and add overlay**

Replace the `<img>` tag for images (lines 131-138) with a relative container that includes the overlay. Use `inline-flex` so the wrapper matches the rendered image size (needed for accurate percentage-based overlay positioning):

```tsx
{item.kind === "video" ? (
  <video
    key={item.path}
    src={assetUrl(item.path)}
    controls
    autoPlay
    className="max-h-[80vh] max-w-full rounded-md"
  />
) : (
  <div className="relative inline-flex">
    <img
      key={item.path}
      src={assetUrl(item.preview_path ?? item.path)}
      alt={item.filename}
      className="max-h-[80vh] max-w-full"
    />
    {showFaces && item.faces.length > 0 && (
      <FaceOverlay
        faces={item.faces}
        imageW={item.w}
        imageH={item.h}
        onFaceClick={(i) =>
          setActiveFaceIndex(activeFaceIndex === i ? null : i)
        }
      />
    )}
    {activeFaceIndex !== null && showFaces && item.faces[activeFaceIndex] && (() => {
      const face = item.faces[activeFaceIndex];
      const match = identities.find((id) =>
        cosineMatch(face.embedding_b64, id.embedding_b64)
      );
      const left = (face.x / item.w) * 100;
      const top = ((face.y + face.h) / item.h) * 100;
      return (
        <div
          className="absolute z-20 rounded-lg border bg-popover p-2 shadow-lg"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            minWidth: 140,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {match ? (
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: match.color }}
                />
                {match.name}
              </span>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => {
                  removeFileFromIdentity(match.name, item.path);
                  setActiveFaceIndex(null);
                }}
              >
                Untag
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs hover:bg-accent"
              onClick={() => {
                setTagging(true);
                setActiveFaceIndex(null);
              }}
            >
              Tag this face…
            </button>
          )}
        </div>
      );
    })()}
  </div>
)}
```

- [ ] **Step 3: Pass preselectedFace to FaceTagModal**

Update the FaceTagModal rendering at the bottom of Lightbox to pass the active face when available:

```tsx
{tagging && (
  <div onClick={(e) => e.stopPropagation()}>
    <FaceTagModal
      imagePath={item.path}
      previewPath={item.preview_path}
      preselectedFace={
        activeFaceIndex !== null && item.faces[activeFaceIndex]
          ? item.faces[activeFaceIndex]
          : undefined
      }
      onClose={() => setTagging(false)}
    />
  </div>
)}
```

- [ ] **Step 4: Build to verify**

Run: `cd /home/ubuntu/repos/pickr && npm run build 2>&1 | tail -5`

Expected: Build succeeds (FaceTagModal `preselectedFace` prop is added in Task 7, but since it's optional and `undefined` is passed when not present, this works even if Task 7 isn't done yet — TS will flag it though). If this task runs before Task 7, the build will fail on the `preselectedFace` prop. In that case, omit it temporarily and add it after Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/components/Lightbox.tsx
git commit -m "feat: add face overlay and tag/untag popover to lightbox"
```

---

### Task 7: Enhance FaceTagModal with `preselectedFace` prop

**Files:**
- Modify: `src/features/face-tag/FaceTagModal.tsx:19-23` (props), `src/features/face-tag/FaceTagModal.tsx:55-85` (detection effect)

**Interfaces:**
- Consumes:
  - `FaceBox` type from `@/lib/types`
  - `cosineMatch` from `@/lib/faceUtils` (Task 4)
- Produces: `FaceTagModalProps.preselectedFace?: FaceBox` — when provided, skips detection and shows only that face pre-selected for tagging

- [ ] **Step 1: Add preselectedFace prop**

In `src/features/face-tag/FaceTagModal.tsx`, update the props interface:

```typescript
interface FaceTagModalProps {
  imagePath: string;
  previewPath?: string | null;
  preselectedFace?: FaceBox;
  onClose: () => void;
}
```

Update the destructuring:

```typescript
export function FaceTagModal({ imagePath, previewPath, preselectedFace, onClose }: FaceTagModalProps) {
```

- [ ] **Step 2: Modify detection effect to use preselectedFace**

Replace the `useEffect` block (lines 55-85) with logic that skips detection when a face is preselected:

```typescript
useEffect(() => {
  let cancelled = false;
  setLoading(true);
  setError(null);
  setFaces([]);
  setActiveIndex(null);

  if (preselectedFace) {
    const owner = identities.find((id) => id.files.includes(imagePath));
    setFaces([{ box: preselectedFace, name: owner?.name ?? null }]);
    setActiveIndex(0);
    setNameInput(owner?.name ?? "");
    setLoading(false);
    return;
  }

  faceDetect(imagePath)
    .then((boxes) => {
      if (cancelled) return;
      setFaces(
        boxes.map((box) => {
          const owner = identities.find((id) => id.files.includes(imagePath));
          return { box, name: owner?.name ?? null };
        })
      );
    })
    .catch((e) => {
      if (!cancelled) setError(String(e));
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

  return () => {
    cancelled = true;
  };
  // identities intentionally excluded: detection should not re-run on tag.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [imagePath, preselectedFace]);
```

When `preselectedFace` is provided, it sets that single face as the only entry, auto-selects it (index 0), and pre-fills the name input — no sidecar call needed.

- [ ] **Step 3: Build to verify**

Run: `cd /home/ubuntu/repos/pickr && npm run build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/features/face-tag/FaceTagModal.tsx
git commit -m "feat: add preselectedFace prop to FaceTagModal for click-to-tag"
```

---

### Task 8: Default export blur toggle when blurUntagged is active

**Files:**
- Modify: `src/components/ExportDialog.tsx:35`

**Interfaces:**
- Consumes: `useFiltersStore` — `blurUntagged` (Task 2)
- Produces: ExportDialog opens with blur toggle pre-checked when in-app blur preview is active

- [ ] **Step 1: Read blurUntagged and use as default**

In `src/components/ExportDialog.tsx`, add the import for `useFiltersStore`:

```typescript
import { useFiltersStore } from "@/stores/filtersStore";
```

Inside the component, read the state:

```typescript
const blurUntagged = useFiltersStore((s) => s.blurUntagged);
```

Change the `blurFaces` initial state from `false` to use `blurUntagged`:

```typescript
const [blurFaces, setBlurFaces] = useState(blurUntagged);
```

This makes the export dialog default to blur mode when the in-app blur preview is active, providing a seamless flow.

- [ ] **Step 2: Build to verify**

Run: `cd /home/ubuntu/repos/pickr && npm run build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/ExportDialog.tsx
git commit -m "feat: default export blur toggle when in-app blur preview is active"
```

---

### Task 9: Visual verification and final commit

**Files:**
- None new

**Interfaces:**
- Consumes: All prior tasks
- Produces: Verified working feature, version bump, pushed to remote

- [ ] **Step 1: Start dev server and verify**

Run: `cd /home/ubuntu/repos/pickr && npm run dev`

Test checklist:
1. Open a folder with scanned images (faces already detected)
2. In sidebar, click "Show faces" chip → face boxes appear on thumbnails
3. Click "Blur untagged" chip → untagged faces show blur overlay
4. Open lightbox → face boxes visible on full image
5. Click a face box → popover appears (Tag/Untag options)
6. Tag a face via popover → face gets identity color and name label
7. Click tagged face → "Untag" button appears in popover
8. Untag → face reverts to gray/untagged
9. Open export dialog → blur toggle is pre-checked when blur preview is active
10. Export with blur → verify blurred output

- [ ] **Step 2: Bump version and commit**

Update version to 0.9.0 in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.

```bash
git add -A
git commit -m "v0.9.0: in-app face blur preview with tag/untag and face overlays"
git tag v0.9.0
git push origin main --tags
```
