import { FolderOpen } from "lucide-react";
import { useOpenFolder } from "@/lib/folderContext";
import { Button } from "@/components/ui/button";

export function EmptyState() {
  const openFolder = useOpenFolder();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
        <FolderOpen className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="font-heading text-xl font-semibold">
          Open a folder to get started
        </h2>
        <p className="text-sm text-muted-foreground">
          Pickr scans the folder, scores each photo and video, and helps you
          curate the best.
        </p>
      </div>
      <Button size="lg" onClick={openFolder}>
        <FolderOpen className="h-4 w-4" />
        Open Folder
      </Button>
    </div>
  );
}
