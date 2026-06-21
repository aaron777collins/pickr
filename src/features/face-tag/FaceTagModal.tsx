import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { faceDetect, faceMatch } from "@/lib/commands";
import { assetUrl } from "@/lib/utils";
import type { FaceBox } from "@/lib/types";
import { useIdentitiesStore } from "@/stores/identitiesStore";
import { useFiltersStore } from "@/stores/filtersStore";
import { useProjectStore } from "@/stores/projectStore";

interface FaceTagModalProps {
  imagePath: string;
  onClose: () => void;
}

interface TaggedFace {
  box: FaceBox;
  name: string | null;
}

/**
 * Triggered by pressing F in the Lightbox (Agent 4). The lightbox renders this
 * with the current image's path and an onClose handler.
 *
 * Workflow: detect faces -> overlay clickable boxes -> label -> find matches
 * across the manifest -> auto-apply the person filter.
 */
export function FaceTagModal({ imagePath, onClose }: FaceTagModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [faces, setFaces] = useState<TaggedFace[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [matching, setMatching] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  const identities = useIdentitiesStore((s) => s.identities);
  const addIdentity = useIdentitiesStore((s) => s.addIdentity);
  const getIdentityColor = useIdentitiesStore((s) => s.getIdentityColor);
  const addFilesToIdentity = useIdentitiesStore((s) => s.addFilesToIdentity);
  const setPersonFilter = useFiltersStore((s) => s.setPersonFilter);
  const folder = useProjectStore((s) => s.folder);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFaces([]);
    setActiveIndex(null);

    faceDetect(imagePath)
      .then((boxes) => {
        if (cancelled) return;
        // Pre-fill names for faces already linked to this file.
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
  }, [imagePath]);

  const onImgLoad = useCallback(() => {
    const el = imgRef.current;
    if (el) setImgSize({ w: el.clientWidth, h: el.clientHeight });
  }, []);

  useEffect(() => {
    function onResize() {
      const el = imgRef.current;
      if (el) setImgSize({ w: el.clientWidth, h: el.clientHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Detection coords are absolute pixels in the natural image; scale them to
  // the rendered (object-contain) size.
  const scaleBox = (box: FaceBox) => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }
    const scaleX = imgSize.w / img.naturalWidth;
    const scaleY = imgSize.h / img.naturalHeight;
    return {
      left: box.x * scaleX,
      top: box.y * scaleY,
      width: box.w * scaleX,
      height: box.h * scaleY,
    };
  };

  function commitName(index: number) {
    const name = nameInput.trim();
    if (!name) return;
    const face = faces[index];
    addIdentity(name, face.box.embedding_b64, [imagePath]);
    setFaces((prev) =>
      prev.map((f, i) => (i === index ? { ...f, name } : f))
    );
    setActiveIndex(null);
    setNameInput("");
  }

  async function findMatches(index: number) {
    const face = faces[index];
    if (!face.name) return;
    if (!folder) {
      toast.error("No folder open");
      return;
    }
    setMatching(true);
    try {
      const manifestPath = `${folder}/.pickr/manifest.json`;
      const matches = await faceMatch(face.box.embedding_b64, manifestPath);
      const unique = Array.from(new Set([imagePath, ...matches]));
      addFilesToIdentity(face.name, unique);
      setPersonFilter(face.name);
      toast.success(
        `Found ${face.name} in ${matches.length} other ${
          matches.length === 1 ? "file" : "files"
        }`
      );
    } catch (e) {
      toast.error(`Match failed: ${String(e)}`);
    } finally {
      setMatching(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tag faces</DialogTitle>
        </DialogHeader>

        <div className="relative flex max-h-[70vh] items-center justify-center overflow-hidden rounded-md bg-muted">
          {loading && (
            <div className="flex flex-col items-center gap-2 p-12 text-sm text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              Detecting faces…
            </div>
          )}

          {error && (
            <div className="p-12 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="relative">
              <img
                ref={imgRef}
                src={assetUrl(imagePath)}
                alt="Tagging target"
                onLoad={onImgLoad}
                className="block max-h-[70vh] max-w-full object-contain"
              />
              {imgSize.w > 0 &&
                faces.map((face, i) => {
                  const pos = scaleBox(face.box);
                  const color = face.name
                    ? getIdentityColor(face.name)
                    : "#ffffff";
                  return (
                    <button
                      type="button"
                      key={i}
                      onClick={() => {
                        setActiveIndex(i);
                        setNameInput(face.name ?? "");
                      }}
                      className="group absolute cursor-pointer transition-shadow hover:shadow-[0_0_0_3px_rgba(255,255,255,0.4)]"
                      style={{
                        left: pos.left,
                        top: pos.top,
                        width: pos.width,
                        height: pos.height,
                        border: `2px solid ${color}`,
                        boxShadow:
                          activeIndex === i
                            ? `0 0 0 3px ${color}66`
                            : undefined,
                      }}
                    >
                      {face.name && (
                        <span
                          className="absolute -top-6 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: color }}
                        >
                          {face.name}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {!loading && !error && faces.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No faces detected in this image.
          </p>
        )}

        {activeIndex !== null && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">
                Name this face
              </label>
              <Input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName(activeIndex);
                  if (e.key === "Escape") setActiveIndex(null);
                }}
                placeholder="e.g. Alex"
                list="pickr-identity-names"
              />
              <datalist id="pickr-identity-names">
                {identities.map((id) => (
                  <option key={id.name} value={id.name} />
                ))}
              </datalist>
            </div>
            <Button onClick={() => commitName(activeIndex)}>Save</Button>
          </div>
        )}

        {faces.some((f) => f.name) && (
          <div className="flex flex-wrap gap-2">
            {faces
              .map((f, i) => ({ f, i }))
              .filter(({ f }) => f.name)
              .map(({ f, i }) => (
                <Button
                  key={i}
                  variant="secondary"
                  size="sm"
                  disabled={matching}
                  onClick={() => findMatches(i)}
                >
                  {matching ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Search className="size-3.5" />
                  )}
                  Find {f.name}
                </Button>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
