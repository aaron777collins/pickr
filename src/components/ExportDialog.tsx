import { useState } from "react";
import { FolderOpen, Download, Loader2, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { pickFolder, exportRenamed, blurExport } from "@/lib/commands";
import { useProjectStore } from "@/stores/projectStore";
import { useIdentitiesStore } from "@/stores/identitiesStore";
import { useOrderedItems } from "@/lib/useOrderedItems";
import { truncatePath } from "@/lib/utils";
import type { ExportItem, BlurExportItem, BlurExportConfig } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const ordered = useOrderedItems();
  const included = useProjectStore((s) => s.included);
  const identities = useIdentitiesStore((s) => s.identities);
  const [dest, setDest] = useState<string | null>(null);
  const [digits, setDigits] = useState(2);
  const [busy, setBusy] = useState(false);
  const [blurFaces, setBlurFaces] = useState(false);
  const [progressText, setProgressText] = useState("");

  const includedCount = ordered.filter(
    (i) => included[i.path] ?? true
  ).length;
  const total = ordered.length;

  async function pickDest() {
    try {
      const folder = await pickFolder();
      if (folder) setDest(folder);
    } catch (err) {
      toast.error(`Could not pick folder: ${String(err)}`);
    }
  }

  async function doExport() {
    if (!dest) {
      toast.error("Choose a destination folder first");
      return;
    }
    setBusy(true);
    setProgressText("");

    try {
      if (blurFaces) {
        const unlisten = await listen<{
          done: number;
          total: number;
          current: string;
        }>("blur-progress", (event) =>
          setProgressText(event.payload.current)
        );

        const pad = ordered.length >= 100 ? 3 : digits;
        const sep = dest.includes("\\") ? "\\" : "/";
        const blurItems: BlurExportItem[] = ordered
          .filter((item) => included[item.path] ?? true)
          .map((item, index) => ({
            src: item.path,
            dest: `${dest}${sep}${String(index + 1).padStart(pad, "0")}_${item.filename}`,
            kind: item.kind,
          }));

        const config: BlurExportConfig = {
          keep_embeddings: identities.map((id) => id.embedding_b64),
          items: blurItems,
        };

        const summary = await blurExport(config);
        unlisten();
        toast.success(
          `Exported ${summary.exported_count} files with face blurring`
        );
      } else {
        const items: ExportItem[] = ordered.map((item, index) => ({
          src_path: item.path,
          order_index: index,
          include: included[item.path] ?? true,
        }));
        const summary = await exportRenamed(items, dest);
        toast.success(
          `Exported ${summary.exported_count} files to ${summary.dest_folder}`
        );
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`);
    } finally {
      setBusy(false);
      setProgressText("");
    }
  }

  const example = `${"1".padStart(digits, "0")}_filename.jpg`;

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
          <DialogDescription>
            Copy included items into a folder, renamed with a numeric prefix in
            your chosen order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Destination
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={pickDest}>
                <FolderOpen className="h-4 w-4" />
                Choose…
              </Button>
              <span
                className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                title={dest ?? ""}
              >
                {dest ? truncatePath(dest, 3) : "No folder selected"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Prefix digits
            </span>
            <select
              value={digits}
              onChange={(e) => setDigits(Number(e.target.value))}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
            >
              <option value={2}>2 (01)</option>
              <option value={3}>3 (001)</option>
              <option value={4}>4 (0001)</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              <Label
                htmlFor="blur-toggle"
                className="text-xs font-medium text-muted-foreground"
              >
                Blur unidentified faces
              </Label>
            </div>
            <Switch
              id="blur-toggle"
              checked={blurFaces}
              onCheckedChange={setBlurFaces}
            />
          </div>

          {blurFaces && identities.length === 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
              No identities tagged yet — all faces will be blurred. Tag people
              first (press F in lightbox) to keep their faces visible.
            </div>
          )}

          {busy && progressText && (
            <div className="text-xs text-muted-foreground animate-pulse">
              {progressText}
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <div>
              Exporting{" "}
              <span className="font-medium text-foreground">
                {includedCount}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{total}</span>{" "}
              items.
              {blurFaces && " Faces of unidentified people will be blurred."}
            </div>
            <div className="mt-1 font-mono">e.g. {example}</div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={doExport}
            disabled={!dest || busy || includedCount === 0}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {blurFaces ? "Export with Blur" : `Export ${includedCount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
