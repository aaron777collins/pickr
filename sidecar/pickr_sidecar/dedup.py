"""Perceptual-hash deduplication over a manifest.

Groups items whose pHashes are within a Hamming distance threshold using a
union-find, then assigns each group a stable integer id. Items with no near
duplicate get ``dup_group = None``.
"""

from __future__ import annotations

from .ai import hamming_distance

DEFAULT_THRESHOLD = 8


def assign_dup_groups(manifest: list[dict], threshold: int = DEFAULT_THRESHOLD) -> list[dict]:
    """Return the manifest with a ``dup_group`` field added to each item."""
    n = len(manifest)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    hashes = [item.get("phash") for item in manifest]
    for i in range(n):
        if not hashes[i]:
            continue
        for j in range(i + 1, n):
            if not hashes[j]:
                continue
            try:
                if hamming_distance(hashes[i], hashes[j]) <= threshold:
                    union(i, j)
            except Exception:
                continue

    # Cluster members by root; only clusters with >1 member are real dup groups.
    members: dict[int, list[int]] = {}
    for i in range(n):
        if not hashes[i]:
            continue
        members.setdefault(find(i), []).append(i)

    group_id_for_root: dict[int, int] = {}
    next_id = 0
    for root, idxs in members.items():
        if len(idxs) > 1:
            group_id_for_root[root] = next_id
            next_id += 1

    for i, item in enumerate(manifest):
        if not hashes[i]:
            item["dup_group"] = None
            continue
        root = find(i)
        item["dup_group"] = group_id_for_root.get(root)

    return manifest
