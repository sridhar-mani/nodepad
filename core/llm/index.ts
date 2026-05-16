"use client"

import type { LLMGenerateInput, LLMGenerateOutput } from "./provider"
import { generate } from "./router"
import { streamText } from "./streaming"

export const llm = {
  generate: (input: LLMGenerateInput): Promise<LLMGenerateOutput> => generate(input),
  streamText: (input: LLMGenerateInput): AsyncGenerator<string, void, void> => streamText(input),
}

export * from "./provider"
