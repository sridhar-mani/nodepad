import type { LLMConstraints, LLMMessage } from "./provider"

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function messageTokens(message: LLMMessage): number {
  return estimateTokens(message.content) + 6
}

export function dedupeMessages(messages: LLMMessage[]): LLMMessage[] {
  const deduped: LLMMessage[] = []
  for (const message of messages) {
    const last = deduped[deduped.length - 1]
    if (last && last.role === message.role && last.content === message.content) continue
    deduped.push(message)
  }
  return deduped
}

export function trimMessages(messages: LLMMessage[], maxTurns = 8): LLMMessage[] {
  const systemMessages = messages.filter(m => m.role === "system")
  const nonSystem = messages.filter(m => m.role !== "system")
  const tail = nonSystem.slice(-maxTurns)
  return [...systemMessages, ...tail]
}

export function enforceInputBudget(messages: LLMMessage[], constraints: LLMConstraints): LLMMessage[] {
  const withTrim = trimMessages(dedupeMessages(messages), 8)
  let total = withTrim.reduce((sum, m) => sum + messageTokens(m), 0)
  if (total <= constraints.maxInputTokens) return withTrim

  const system = withTrim.filter(m => m.role === "system")
  const mutable = withTrim.filter(m => m.role !== "system")

  while (mutable.length > 1 && total > constraints.maxInputTokens) {
    mutable.shift()
    total = [...system, ...mutable].reduce((sum, m) => sum + messageTokens(m), 0)
  }

  return [...system, ...mutable]
}

export function compressTextBlock(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input
  const head = input.slice(0, Math.max(0, maxChars - 24)).trim()
  return `${head}\n...[compressed]`
}
