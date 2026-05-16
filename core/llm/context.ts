import { compressTextBlock } from "./compression"
import type { LLMConstraints, LLMContextInput } from "./provider"

function section(tag: string, value: string): string {
  if (!value.trim()) return ""
  return `<${tag}>${value}</${tag}>`
}

export function buildContextEnvelope(context: LLMContextInput | undefined, constraints: LLMConstraints): string {
  if (!context) return ""

  const visible = (context.visibleNodes ?? []).slice(-8).map(v => compressTextBlock(v, 260)).join("\n")
  const retrieved = (context.retrievedChunks ?? [])
    .slice(0, constraints.maxRetrievedChunks)
    .map(v => compressTextBlock(v, 320))
    .join("\n")

  const decisions = (context.decisions ?? []).slice(-8).join(" | ")
  const facts = (context.facts ?? []).slice(-12).join(" | ")
  const pending = (context.pendingTasks ?? []).slice(-8).join(" | ")

  const raw = [
    section("active_chunk", compressTextBlock(context.activeChunk ?? "", 500)),
    section("visible_nodes", visible),
    section("retrieved", retrieved),
    section("working_memory", compressTextBlock(context.workingMemory ?? "", 500)),
    section("decisions", decisions),
    section("facts", facts),
    section("pending_tasks", pending),
  ].filter(Boolean).join("\n")

  if (!raw.trim()) return ""
  return `<context>\n${raw}\n</context>`
}
