"use client"

import { buildContextEnvelope } from "./context"
import { dedupeMessages, enforceInputBudget } from "./compression"
import {
  DEFAULT_LLM_CONSTRAINTS,
  type LLMConstraints,
  type LLMGenerateInput,
  type LLMGenerateOutput,
  type LLMProviderAdapter,
  type LLMProviderId,
  type LLMProviderRequest,
} from "./provider"
import { recordLLMEvent } from "./telemetry"
import { getCachedLLMResult, setCachedLLMResult } from "./cache"
import { loadAIConfig, getBaseUrl } from "@/lib/ai-settings"
import { openAIProvider } from "@/providers/openai"
import { openRouterProvider } from "@/providers/openrouter"
import { anthropicProvider } from "@/providers/anthropic"
import { nvidiaProvider } from "@/providers/nvidia"

function mergeConstraints(input?: Partial<LLMConstraints>): LLMConstraints {
  return {
    ...DEFAULT_LLM_CONSTRAINTS,
    ...(input ?? {}),
  }
}

function mapSettingsProviderToGateway(provider: string): LLMProviderId {
  if (provider === "openrouter") return "openrouter"
  if (provider === "anthropic") return "anthropic"
  if (provider === "nvidia") return "nvidia"
  return "openai"
}

function defaultTemperature(task: LLMGenerateInput["task"]): number {
  if (task === "tagging") return 0
  if (task === "summarize") return 0.2
  if (task === "reasoning") return 0.2
  if (task === "coding") return 0.1
  if (task === "synthesis") return 0.6
  return 0.2
}

function pickTaskModel(task: LLMGenerateInput["task"], provider: LLMProviderId, fallbackModel: string): string {
  if (fallbackModel && fallbackModel.trim()) return fallbackModel

  const mapByProvider: Record<LLMProviderId, Partial<Record<LLMGenerateInput["task"], string>>> = {
    openai: {
      tagging: "gpt-4o-mini",
      summarize: "gpt-4o-mini",
      reasoning: "gpt-4o",
      coding: "gpt-4o",
      synthesis: "gpt-4o",
    },
    openrouter: {
      tagging: "meta-llama/llama-3.1-8b-instruct",
      summarize: "mistralai/mistral-small-3.2-24b-instruct",
      reasoning: "deepseek/deepseek-chat",
      coding: "qwen/qwen-2.5-coder-32b-instruct",
      synthesis: "meta-llama/llama-3.1-70b-instruct",
    },
    anthropic: {
      summarize: "claude-3-5-haiku-latest",
      reasoning: "claude-3-7-sonnet-latest",
      coding: "claude-3-7-sonnet-latest",
      synthesis: "claude-3-5-sonnet-latest",
    },
    nvidia: {
      tagging: "meta/llama-3.1-8b-instruct",
      summarize: "mistralai/mistral-nemo-12b-instruct",
      reasoning: "meta/llama-3.1-70b-instruct",
      coding: "meta/llama-3.3-70b-instruct",
      synthesis: "meta/llama-3.1-70b-instruct",
    },
  }

  return mapByProvider[provider][task] ?? fallbackModel
}

function getProviderAdapter(provider: LLMProviderId): LLMProviderAdapter {
  if (provider === "openrouter") return openRouterProvider
  if (provider === "anthropic") return anthropicProvider
  if (provider === "nvidia") return nvidiaProvider
  return openAIProvider
}

function resolveProviderBaseUrl(provider: LLMProviderId, settingsBaseUrl: string): string {
  if (provider === "anthropic") return settingsBaseUrl || "https://api.anthropic.com/v1"
  if (provider === "nvidia") return settingsBaseUrl || "https://integrate.api.nvidia.com/v1"
  return settingsBaseUrl
}

function buildMessageList(input: LLMGenerateInput, constraints: LLMConstraints) {
  const envelope = buildContextEnvelope(input.context, constraints)
  const withContext = envelope
    ? [...input.messages, { role: "system" as const, content: envelope }]
    : [...input.messages]

  return enforceInputBudget(dedupeMessages(withContext), constraints)
}

export async function generate(input: LLMGenerateInput): Promise<LLMGenerateOutput> {
  const config = loadAIConfig()
  if (!config) throw new Error("No API key configured")

  const constraints = mergeConstraints(input.constraints)
  const providerId = input.provider ?? mapSettingsProviderToGateway(config.provider)
  const model = input.model ?? pickTaskModel(input.task, providerId, config.modelId)

  const cached = getCachedLLMResult(input, model, providerId)
  if (cached) return { ...cached, latencyMs: 0 }

  const request: LLMProviderRequest = {
    providerId,
    baseUrl: resolveProviderBaseUrl(providerId, getBaseUrl(config)),
    apiKey: config.apiKey,
    model,
    messages: buildMessageList(input, constraints),
    temperature: input.temperature ?? defaultTemperature(input.task),
    maxOutputTokens: input.constraints?.maxOutputTokens ?? constraints.maxOutputTokens,
    responseFormat: input.responseFormat,
    providerRequestExtras: input.providerRequestExtras,
  }

  const provider = getProviderAdapter(providerId)
  const startedAt = Date.now()
  const response = await provider.generate(request)

  const output: LLMGenerateOutput = {
    text: response.text,
    provider: providerId,
    model,
    latencyMs: Date.now() - startedAt,
    usage: response.usage,
    raw: response.raw,
  }

  recordLLMEvent(input, output)
  setCachedLLMResult(input, model, providerId, output)
  return output
}
