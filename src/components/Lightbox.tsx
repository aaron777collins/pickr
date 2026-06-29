import { useEffect, useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, X, Eye, EyeOff, ScanFace } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useFiltersStore } from "@/stores/filtersStore";
import { useIdentitiesStore } from "@/stores/identitiesStore";
import { useVisibleItems } from "@/lib/useOrderedItems";
import { assetUrl, cn } from "@/lib/utils";
import { cosineMatch } from "@/lib/faceUtils";
import { Button } from "@/components/ui/button";
import { FaceOverlay } from "@/components/FaceOverlay";
import { FaceTagModal } from "@/features/face-tag/FaceTagModal";

export function Lightbox() {
  const items = useVisibleItems();
  const [tagging, setTagging] = useState(false);
  const [activeFaceIndex, setActiveFaceIndex] = useState<number | null>(null);
  const showFaces = useFiltersStore((s) => s.showFaces);
  const identities = useIdentitiesStore((s) => s.identities);
  const removeFileFromIdentity = useIdentitiesStore((s) => s.removeFileFromIdentity);
  const lightboxIndex = useProjectStore((s) => s.lightboxIndex);
  const setLightboxIndex = useProjectStore((s) => s.setLightboxIndex);
  const toggleInclude = useProjectStore((s) => s.toggleInclude);
  const included = useProjectStore((s) =>
    lightboxIndex !== null && items[lightboxIndex]
      ? s.included[items[lightboxIndex].path] ?? true
      : true
  );

  const open = lightboxIndex !== null && lightboxIndex < items.length;
  const item = open ? items[lightboxIndex] : null;

  const close = useCallback(
    () => setLightboxIndex(null),
    [setLightboxIndex]
  );

  const go = useCallback(
    (delta: number) => {
      if (lightboxIndex === null) return;
      const next = lightboxIndex + delta;
      if (next >= 0 && next < items.length) setLightboxIndex(next);
    },
    [lightboxIndex, items.length, setLightboxIndex]
  );

  useEffect(() => {
    if (!open || tagging) return;
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          close();
          break;
        case "ArrowLeft":
          go(-1);
          break;
        case "ArrowRight":
          go(1);
          break;
        case " ":
          e.preventDefault();
          if (item) toggleInclude(item.path);
          break;
        case "f":
        case "F":
          e.preventDefault();
          if (item && item.kind === "image") setTagging(true);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, tagging, close, go, item, toggleInclude]);

  // Reset the tagging modal whenever the lightbox closes or the item changes.
  useEffect(() => {
    setTagging(false);
    setActiveFaceIndex(null);
  }, [item?.path, open]);

  if (!open || !item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={() => {
        if (!tagging) close();
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={close}
        className="absolute right-4 top-4 z-10 text-white hover:bg-white/15 hover:text-white"
        aria-label="Close"
      >
        <X className="h-6 w-6" />
      </Button>

      {lightboxIndex! > 0 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/15 hover:text-white"
          aria-label="Previous"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}
      {lightboxIndex! < items.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/15 hover:text-white"
          aria-label="Next"
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      <div
        className="flex flex-1 items-center justify-center overflow-hidden p-12"
        onClick={(e) => e.stopPropagation()}
      >
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
      </div>

      <div
        className="flex items-center justify-between gap-4 border-t border-white/10 bg-black/60 px-6 py-3 text-sm text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{item.filename}</span>
          <span className="text-xs text-white/60 tabular-nums">
            {item.w}×{item.h}
            {item.duration_sec !== null &&
              ` · ${item.duration_sec.toFixed(1)}s`}
            {` · sharp ${item.sharpness.toFixed(1)}`}
            {` · ${lightboxIndex! + 1}/${items.length}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {item.kind === "image" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTagging(true)}
              className="border-white/20 bg-transparent text-white hover:bg-white/15 hover:text-white"
            >
              <ScanFace className="mr-1.5 h-4 w-4" /> Tag People
              <kbd className="ml-1.5 rounded bg-white/15 px-1 text-[10px]">F</kbd>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleInclude(item.path)}
            className={cn(
              "border-white/20 bg-transparent text-white hover:bg-white/15 hover:text-white",
              !included && "border-red-500/60 text-red-300"
            )}
          >
            {included ? (
              <>
                <Eye className="mr-1.5 h-4 w-4" /> Included
              </>
            ) : (
              <>
                <EyeOff className="mr-1.5 h-4 w-4" /> Skipped
              </>
            )}
          </Button>
        </div>
      </div>

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
    </div>
  );
}
