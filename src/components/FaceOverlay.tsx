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
