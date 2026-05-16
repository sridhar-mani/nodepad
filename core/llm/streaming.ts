import type { LLMGenerateInput } from "./provider"
import { generate } from "@/core/llm/router"

export async function* streamText(input: LLMGenerateInput): AsyncGenerator<string, void, void> {
  // Centralized streaming fallback: until provider-native stream adapters are
  // wired, generate once and yield a single chunk.
  const output = await generate(input)
  yield output.text
}
