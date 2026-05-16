import type { LLMGenerateInput, LLMGenerateOutput, LLMMessage } from "./provider"

interface CacheEntry {
  key: string
  createdAt: number
  output: LLMGenerateOutput
}

const CACHE_TTL_MS = 60_000
const MAX_ENTRIES = 200
const cache = new Map<string, CacheEntry>()

function normalizeContent(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9<>{}:/._\-\s]/g, "")
    .trim()
}

function normalizeMessages(messages: LLMMessage[]): string {
  return messages
    .map(m => `${m.role}:${normalizeContent(m.content)}`)
    .join("\n")
}

function buildKey(input: LLMGenerateInput, model: string, provider: string): string {
  return [
    provider,
    model,
    input.task,
    normalizeMessages(input.messages),
    normalizeContent(input.context?.activeChunk ?? ""),
  ].join("|")
}

function pruneExpired(now: number): void {
  for (const [key, entry] of cache.entries()) {
    if (now - entry.createdAt > CACHE_TTL_MS) cache.delete(key)
  }
  if (cache.size <= MAX_ENTRIES) return

  const sorted = [...cache.values()].sort((a, b) => a.createdAt - b.createdAt)
  const extra = cache.size - MAX_ENTRIES
  for (let i = 0; i < extra; i += 1) {
    cache.delete(sorted[i].key)
  }
}

export function getCachedLLMResult(input: LLMGenerateInput, model: string, provider: string): LLMGenerateOutput | null {
  const now = Date.now()
  pruneExpired(now)

  const key = buildKey(input, model, provider)
  const entry = cache.get(key)
  if (!entry) return null
  if (now - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.output
}

export function setCachedLLMResult(input: LLMGenerateInput, model: string, provider: string, output: LLMGenerateOutput): void {
  const key = buildKey(input, model, provider)
  cache.set(key, { key, createdAt: Date.now(), output })
}
