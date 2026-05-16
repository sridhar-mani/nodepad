import type { LLMGenerateOutput, LLMGenerateInput } from "./provider"

interface LLMEvent {
  timestamp: number
  task: string
  provider: string
  model: string
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
}

const EVENT_LIMIT = 200
const events: LLMEvent[] = []

export function recordLLMEvent(input: LLMGenerateInput, output: LLMGenerateOutput): void {
  events.push({
    timestamp: Date.now(),
    task: input.task,
    provider: output.provider,
    model: output.model,
    latencyMs: output.latencyMs,
    inputTokens: output.usage?.inputTokens,
    outputTokens: output.usage?.outputTokens,
  })

  if (events.length > EVENT_LIMIT) events.shift()
}

export function getLLMEvents(): LLMEvent[] {
  return [...events]
}
