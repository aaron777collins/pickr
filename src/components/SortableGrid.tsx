import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useProjectStore } from "@/stores/projectStore";
import { Thumbnail } from "./Thumbnail";
import { useVisibleItems } from "@/lib/useOrderedItems";

export function SortableGrid() {
  const moveItem = useProjectStore((s) => s.moveItem);
  const searchQuery = useProjectStore((s) => s.searchQuery);
  const filtered = useVisibleItems();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      moveItem(String(active.id), String(over.id));
    }
  }

  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        {searchQuery
          ? `No items match "${searchQuery}"`
          : "No media found in this folder."}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={filtered.map((i) => i.path)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((item, index) => (
            <Thumbnail key={item.path} item={item} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
