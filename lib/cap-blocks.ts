import type { TextBlock } from "@/components/tile-card"

/** Keep the most recent notes plus pinned items under a node budget (graph / scans). */
export function capBlocksForDisplay(blocks: TextBlock[], max: number): TextBlock[] {
  if (max <= 0 || blocks.length <= max) return blocks
  const pinned = blocks.filter((b) => b.isPinned)
  const unpinned = blocks.filter((b) => !b.isPinned)
  const room = Math.max(0, max - pinned.length)
  const recent = unpinned.slice(-room)
  const merged = [...recent, ...pinned]
  const seen = new Set<string>()
  return merged.filter((b) => {
    if (seen.has(b.id)) return false
    seen.add(b.id)
    return true
  }).slice(0, max)
}
