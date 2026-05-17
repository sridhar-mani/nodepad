export interface OfflineSummaryResult {
  summary: string
  engine: "summarizer" | "webnn" | "truncate"
}

type SummarizerCtor = new (options?: { type?: string; length?: string }) => {
  summarize: (text: string) => Promise<string>
  destroy?: () => void
}

export async function summarizeOnDevice(text: string): Promise<OfflineSummaryResult | null> {
  const trimmed = text.trim()
  if (!trimmed) return null

  const Summarizer = (globalThis as { Summarizer?: SummarizerCtor }).Summarizer
  if (Summarizer) {
    try {
      const summarizer = new Summarizer({ type: "key-points", length: "short" })
      const summary = await summarizer.summarize(trimmed.slice(0, 12_000))
      summarizer.destroy?.()
      return { summary, engine: "summarizer" }
    } catch {
      /* fall through */
    }
  }

  if ("ml" in navigator) {
    try {
      const context = await (navigator as Navigator & { ml: { createContext: () => Promise<unknown> } }).ml.createContext()
      if (context) {
        const sentences = trimmed.split(/[.!?]+/).filter(Boolean)
        const summary = sentences.slice(0, 3).join(". ").trim() + (sentences.length > 3 ? "…" : "")
        return { summary: summary || trimmed.slice(0, 200), engine: "webnn" }
      }
    } catch {
      /* fall through */
    }
  }

  const words = trimmed.split(/\s+/)
  if (words.length <= 40) return { summary: trimmed, engine: "truncate" }
  return {
    summary: words.slice(0, 35).join(" ") + "…",
    engine: "truncate",
  }
}

export async function isWebGpuAvailable(): Promise<boolean> {
  if (!("gpu" in navigator)) return false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    return Boolean(adapter)
  } catch {
    return false
  }
}
