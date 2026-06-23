import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutRowProps {
  keys: string[];
  description: string;
}

function ShortcutRow({ keys, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted-foreground text-sm">{description}</span>
      <div className="flex shrink-0 gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground ring-1 ring-foreground/10"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}

interface ShortcutGroup {
  label: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: "General",
    shortcuts: [
      { keys: ["?"], description: "Show this help" },
      { keys: ["Ctrl", "E"], description: "Export selected photos" },
      { keys: ["D"], description: "Toggle dark mode" },
    ],
  },
  {
    label: "Grid",
    shortcuts: [
      { keys: ["Click"], description: "Open photo in lightbox" },
    ],
  },
  {
    label: "Lightbox",
    shortcuts: [
      { keys: ["Esc"], description: "Close lightbox" },
      { keys: ["←"], description: "Previous photo" },
      { keys: ["→"], description: "Next photo" },
      { keys: ["Space"], description: "Toggle include / skip" },
      { keys: ["F"], description: "Tag faces" },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="divide-y divide-border/50">
                {group.shortcuts.map((s) => (
                  <ShortcutRow key={s.description} keys={s.keys} description={s.description} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
