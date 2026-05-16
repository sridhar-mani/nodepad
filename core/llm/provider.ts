export type LLMRole = "system" | "user" | "assistant"

export interface LLMMessage {
  role: LLMRole
  content: string
}

export type LLMTask =
  | "tagging"
  | "summarize"
  | "reasoning"
  | "coding"
  | "synthesis"
  | "embedding"

export interface LLMContextInput {
  latestTurns?: LLMMessage[]
  visibleNodes?: string[]
  activeChunk?: string
  retrievedChunks?: string[]
  workingMemory?: string
  decisions?: string[]
  facts?: string[]
  pendingTasks?: string[]
}

export interface LLMConstraints {
  maxInputTokens: number
  maxOutputTokens: number
  maxRetrievedChunks: number
  maxToolCalls: number
}

export const DEFAULT_LLM_CONSTRAINTS: LLMConstraints = {
  maxInputTokens: 12_000,
  maxOutputTokens: 1_200,
  maxRetrievedChunks: 4,
  maxToolCalls: 2,
}

export type LLMProviderId = "openai" | "openrouter" | "anthropic" | "nvidia"

export interface LLMGenerateInput {
  task: LLMTask
  messages: LLMMessage[]
  context?: LLMContextInput
  constraints?: Partial<LLMConstraints>
  temperature?: number
  model?: string
  provider?: LLMProviderId
  responseFormat?: Record<string, unknown>
  providerRequestExtras?: Record<string, unknown>
}

export interface LLMProviderRequest {
  providerId: LLMProviderId
  baseUrl: string
  apiKey: string
  model: string
  messages: LLMMessage[]
  temperature: number
  maxOutputTokens: number
  responseFormat?: Record<string, unknown>
  providerRequestExtras?: Record<string, unknown>
}

export interface LLMProviderResponse {
  text: string
  raw?: unknown
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
}

export interface LLMProviderAdapter {
  id: LLMProviderId
  generate: (request: LLMProviderRequest) => Promise<LLMProviderResponse>
}

export interface LLMGenerateOutput {
  text: string
  provider: LLMProviderId
  model: string
  latencyMs: number
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
  raw?: unknown
}
