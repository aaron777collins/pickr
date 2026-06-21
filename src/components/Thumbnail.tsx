import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye,
  EyeOff,
  PlayCircle,
  Users,
  Layers,
  Star,
  Image as ImageIcon,
} from "lucide-react";
import type { ManifestItem } from "@/lib/types";
import { useProjectStore } from "@/stores/projectStore";
import { assetUrl, cn } from "@/lib/utils";
import { getDupGroupInfo } from "@/features/filters/dupHelpers";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function sharpnessClasses(score: number): string {
  if (score >= 7) return "bg-emerald-500/85 text-white";
  if (score >= 4) return "bg-amber-500/85 text-black";
  return "bg-red-500/85 text-white";
}

interface ThumbnailProps {
  item: ManifestItem;
  index: number;
}

export function Thumbnail({ item, index }: ThumbnailProps) {
  const included = useProjectStore((s) => s.included[item.path] ?? true);
  const lightboxIndex = useProjectStore((s) => s.lightboxIndex);
  const toggleInclude = useProjectStore((s) => s.toggleInclude);
  const setLightboxIndex = useProjectStore((s) => s.setLightboxIndex);
  const allItems = useProjectStore((s) => s.items);

  const dup = getDupGroupInfo(item, allItems);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.path });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  const isActive = lightboxIndex === index;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            ref={setNodeRef}
            style={{
              ...style,
              ...(dup ? { borderLeft: `3px solid ${dup.groupColor}` } : {}),
            }}
            {...attributes}
            {...listeners}
            onClick={() => setLightboxIndex(index)}
            className={cn(
              "group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted shadow-sm transition-shadow hover:shadow-lg",
              isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              !included && "opacity-40 ring-2 ring-red-500/60",
              isDragging && "z-10"
            )}
          />
        }
      >
        {item.thumb_path ? (
          <img
            src={assetUrl(item.thumb_path)}
            alt={item.filename}
            draggable={false}
            loading="lazy"
            className="h-full w-full object-cover select-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}

        {item.kind === "video" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <PlayCircle className="h-12 w-12 text-white/90 drop-shadow-lg" />
          </div>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleInclude(item.path);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={included ? "Skip item" : "Include item"}
          className="absolute right-1.5 top-1.5 z-10 rounded-md bg-black/55 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/75 group-hover:opacity-100 data-[on=true]:opacity-100"
          data-on={!included}
        >
          {included ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5">
          <Badge
            className={cn(
              "border-none px-1.5 py-0 text-[10px] font-semibold tabular-nums",
              sharpnessClasses(item.sharpness)
            )}
          >
            {item.sharpness.toFixed(1)}
          </Badge>
          {item.face_count > 0 && (
            <Badge className="border-none bg-black/55 px-1.5 py-0 text-[10px] text-white">
              <Users className="mr-0.5 h-2.5 w-2.5" />
              {item.face_count}
            </Badge>
          )}
          {dup && (
            <Badge
              className="border-none px-1.5 py-0 text-[10px] text-white"
              style={{ backgroundColor: `${dup.groupColor}cc` }}
            >
              {dup.isBestInGroup ? (
                <Star className="mr-0.5 h-2.5 w-2.5 fill-current" />
              ) : (
                <Layers className="mr-0.5 h-2.5 w-2.5" />
              )}
              {dup.groupSize}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{item.filename}</TooltipContent>
    </Tooltip>
  );
}
