import type { TextBlock } from "@/components/tile-card"
import { findKnowledgeMatches, type KnowledgeDocument } from "@/lib/knowledge-base"

export interface KbRef {
  docId: string
  chunkId?: string
}

export interface KnowledgeGraphLink {
  blockId: string
  kbNodeId: string
  inferred: boolean
}

export interface KnowledgeGapSuggestion {
  blockId: string
  blockPreview: string
  docId: string
  docTitle: string
  snippet: string
  score: number
}

export function parseKbUrl(url: string): KbRef | null {
  if (!url.startsWith("kb://")) return null
  const rest = url.slice("kb://".length)
  const hash = rest.indexOf("#")
  if (hash === -1) return { docId: rest }
  return { docId: rest.slice(0, hash), chunkId: rest.slice(hash + 1) || undefined }
}

export function kbDocNodeId(docId: string): string {
  return `kb-doc-${docId}`
}

/** Edges from notes to knowledge documents (stored sources + live lexical matches). */
export function buildKnowledgeGraphLinks(
  blocks: TextBlock[],
  documents: KnowledgeDocument[],
): KnowledgeGraphLink[] {
  if (documents.length === 0) return []

  const links: KnowledgeGraphLink[] = []
  const seen = new Set<string>()

  const push = (blockId: string, docId: string, inferred: boolean) => {
    const kbNodeId = kbDocNodeId(docId)
    const key = `${blockId}→${kbNodeId}:${inferred ? "i" : "s"}`
    if (seen.has(key)) return
    seen.add(key)
    links.push({ blockId, kbNodeId, inferred })
  }

  for (const block of blocks) {
    for (const source of block.sources ?? []) {
      const ref = parseKbUrl(source.url)
      if (ref?.docId) push(block.id, ref.docId, false)
    }

    const matches = findKnowledgeMatches(block.text, documents, 2)
    for (const match of matches) {
      if (match.score < 0.08) continue
      const alreadyStored = (block.sources ?? []).some((s) => {
        const ref = parseKbUrl(s.url)
        return ref?.docId === match.docId
      })
      if (alreadyStored) continue
      push(block.id, match.docId, true)
    }
  }

  return links
}

/** Notes that likely relate to KB material but lack stored kb:// citations. */
export function findKnowledgeGapSuggestions(
  blocks: TextBlock[],
  documents: KnowledgeDocument[],
  limit = 5,
): KnowledgeGapSuggestion[] {
  if (documents.length === 0) return []

  const out: KnowledgeGapSuggestion[] = []
  const usedBlocks = new Set<string>()

  for (const block of blocks) {
    if (block.isEnriching || !block.text.trim()) continue
    const hasKbSource = (block.sources ?? []).some((s) => s.url.startsWith("kb://"))
    if (hasKbSource) continue

    const matches = findKnowledgeMatches(block.text, documents, 1)
    const top = matches[0]
    if (!top || top.score < 0.12) continue
    if (usedBlocks.has(block.id)) continue

    usedBlocks.add(block.id)
    out.push({
      blockId: block.id,
      blockPreview: block.text.slice(0, 80),
      docId: top.docId,
      docTitle: top.docTitle,
      snippet: top.snippet.slice(0, 160),
      score: top.score,
    })
    if (out.length >= limit) break
  }

  return out.sort((a, b) => b.score - a.score)
}
