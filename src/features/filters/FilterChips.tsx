import { CircleOff, EyeOff, Layers, ScanFace, Sparkles, Users } from "lucide-react";
import { useFiltersStore } from "@/stores/filtersStore";
import { useIdentitiesStore } from "@/stores/identitiesStore";
import { cn } from "@/lib/utils";

interface ChipProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function Chip({ active, onClick, icon, label }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Renders inside the Sidebar shell (Agent 4). Self-contained: reads/writes the
 * filters + identities stores directly, so it can be dropped anywhere.
 */
export function FilterChips() {
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

  const identities = useIdentitiesStore((s) => s.identities);

  const anyActive =
    sharpOnly || hasPeople || hideDuplicates || skippedOnly || !!personFilter || showFaces;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Filters</h3>
          {anyActive && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip
            active={sharpOnly}
            onClick={toggleSharpOnly}
            icon={<Sparkles className="size-3.5" />}
            label="Sharp"
          />
          <Chip
            active={hasPeople}
            onClick={toggleHasPeople}
            icon={<Users className="size-3.5" />}
            label="Has faces"
          />
          <Chip
            active={hideDuplicates}
            onClick={toggleHideDuplicates}
            icon={<Layers className="size-3.5" />}
            label="Hide dupes"
          />
          <Chip
            active={skippedOnly}
            onClick={toggleSkippedOnly}
            icon={<EyeOff className="size-3.5" />}
            label="Skipped"
          />
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
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <h3 className="mb-2 text-sm font-semibold">People</h3>
        {identities.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tag faces in the lightbox (press F) to find people across your
            photos.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {identities.map((identity) => {
              const active = personFilter === identity.name;
              return (
                <button
                  key={identity.name}
                  type="button"
                  onClick={() => setPersonFilter(identity.name)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "border-primary bg-accent"
                      : "border-transparent hover:bg-accent"
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: identity.color }}
                    />
                    <span className="truncate">{identity.name}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {identity.files.length} photos
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
