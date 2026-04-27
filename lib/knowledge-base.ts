export interface KnowledgeChunk {
  id: string
  docId: string
  docTitle: string
  text: string
}

export interface KnowledgeDocument {
  id: string
  title: string
  fileName: string
  mimeType: string
  createdAt: number
  updatedAt: number
  rawText: string
  chunks: KnowledgeChunk[]
}

export interface KnowledgeMatch {
  docId: string
  docTitle: string
  chunkId: string
  snippet: string
  score: number
}

const CHUNK_SIZE = 800
const CHUNK_OVERLAP = 120

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function cleanText(text: string): string {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim()
}

function splitIntoChunks(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (!text) return []
  const normalized = cleanText(text)
  if (!normalized) return []

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length)
    const raw = normalized.slice(start, end)
    const chunk = raw.trim()
    if (chunk.length > 0) chunks.push(chunk)
    if (end >= normalized.length) break
    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}

function tokenize(input: string): string[] {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized) return []
  return normalized.split(" ").filter(Boolean)
}

function lexicalScore(query: string, text: string): number {
  const qTokens = tokenize(query)
  if (qTokens.length === 0) return 0

  const tTokens = tokenize(text)
  if (tTokens.length === 0) return 0
  const tSet = new Set(tTokens)

  let hits = 0
  for (const token of qTokens) {
    if (tSet.has(token)) hits += 1
  }

  // Weight by hit ratio, then softly reward denser overlaps.
  const ratio = hits / qTokens.length
  const density = hits / Math.min(tTokens.length, 200)
  return ratio * 0.85 + density * 0.15
}

export async function buildKnowledgeDocumentFromFile(file: File): Promise<KnowledgeDocument> {
  const text = await file.text()
  const rawText = cleanText(text)
  const docId = makeId("kbdoc")

  const chunks = splitIntoChunks(rawText).map((chunkText, idx) => ({
    id: `${docId}-chunk-${idx + 1}`,
    docId,
    docTitle: file.name,
    text: chunkText,
  }))

  return {
    id: docId,
    title: file.name,
    fileName: file.name,
    mimeType: file.type || "text/plain",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rawText,
    chunks,
  }
}

export function findKnowledgeMatches(
  noteText: string,
  documents: KnowledgeDocument[],
  limit = 4,
): KnowledgeMatch[] {
  if (!noteText.trim() || documents.length === 0) return []

  const scored: KnowledgeMatch[] = []
  for (const doc of documents) {
    for (const chunk of doc.chunks) {
      const score = lexicalScore(noteText, chunk.text)
      if (score <= 0) continue
      scored.push({
        docId: doc.id,
        docTitle: doc.title,
        chunkId: chunk.id,
        snippet: chunk.text.slice(0, 300),
        score,
      })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function mergeKnowledgeDocs(
  current: KnowledgeDocument[],
  incoming: KnowledgeDocument[],
): KnowledgeDocument[] {
  const byName = new Map<string, KnowledgeDocument>()
  for (const doc of current) byName.set(doc.fileName.toLowerCase(), doc)
  for (const doc of incoming) byName.set(doc.fileName.toLowerCase(), doc)
  return Array.from(byName.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function isLikelyTextFile(file: File): boolean {
  const name = file.name.toLowerCase()
  if (file.type.startsWith("text/")) return true
  return (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".csv") ||
    name.endsWith(".json") ||
    name.endsWith(".yaml") ||
    name.endsWith(".yml")
  )
}

export function toKnowledgeSource(match: KnowledgeMatch): { url: string; title: string; siteName: string } {
  return {
    url: `kb://${match.docId}#${match.chunkId}`,
    title: match.docTitle,
    siteName: "Knowledge Base",
  }
}
