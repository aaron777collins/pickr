import type { ManifestItem } from "@/lib/types";

const DUP_COLORS = [
  "#f43f5e",
  "#0ea5e9",
  "#84cc16",
  "#a855f7",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#6366f1",
];

export function dupGroupColor(groupId: number): string {
  return DUP_COLORS[Math.abs(groupId) % DUP_COLORS.length];
}

export interface DupGroupInfo {
  isInGroup: boolean;
  groupSize: number;
  isBestInGroup: boolean;
  groupColor: string;
}

/**
 * Returns duplicate-group metadata for a thumbnail, or null if the item is not
 * part of any group. The Thumbnail component (Agent 4) uses this to draw the
 * chain icon, shared left border, and stacked-layers badge.
 */
export function getDupGroupInfo(
  item: ManifestItem,
  allItems: ManifestItem[]
): DupGroupInfo | null {
  if (item.dup_group === null) return null;

  const members = allItems.filter((i) => i.dup_group === item.dup_group);
  if (members.length <= 1) return null;

  let best = members[0];
  for (const m of members) {
    if (m.sharpness > best.sharpness) best = m;
  }

  return {
    isInGroup: true,
    groupSize: members.length,
    isBestInGroup: best.path === item.path,
    groupColor: dupGroupColor(item.dup_group),
  };
}
