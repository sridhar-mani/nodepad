"use client"

import { useState, useEffect, useCallback } from "react"

export interface AIModel {
  id: string
  label: string
  shortLabel: string
  description: string
  supportsGrounding: boolean
  /** For OpenAI models: the search-preview variant to use when grounding is enabled */
  groundingModelId?: string
}

export type ModelTask = "tagging" | "summarize" | "reasoning" | "coding" | "synthesis"

export interface ModelPreset {
  id: string
  label: string
  description: string
  task: ModelTask
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: "preset-fast-capture",
    label: "Fast Capture",
    description: "Quick tagging and lightweight note enrichment",
    task: "tagging",
  },
  {
    id: "preset-summary",
    label: "Summary Focus",
    description: "Compress long notes and context efficiently",
    task: "summarize",
  },
  {
    id: "preset-deep-reasoning",
    label: "Deep Reasoning",
    description: "Higher quality synthesis and critical analysis",
    task: "reasoning",
  },
  {
    id: "preset-coding",
    label: "Coding Assistant",
    description: "Code and structured output oriented model picks",
    task: "coding",
  },
]

export type AIProvider = "openrouter" | "openai" | "anthropic" | "nvidia" | "zai" | "gemini" | "ollama"

export interface AIProviderPreset {
  id: AIProvider
  label: string
  baseUrl: string
  keyUrl: string
  keyPlaceholder: string
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/settings/keys",
    keyPlaceholder: "sk-or-v1-...",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    keyUrl: "https://build.nvidia.com/",
    keyPlaceholder: "nvapi-...",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza...",
  },
  {
    id: "zai",
    label: "Z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    keyUrl: "https://z.ai/manage-apikey/apikey-list",
    keyPlaceholder: "Your Z.ai API key",
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    keyUrl: "",
    keyPlaceholder: "Optional",
  },
]

export function getPreset(provider: AIProvider): AIProviderPreset {
  return AI_PROVIDER_PRESETS.find(p => p.id === provider) || AI_PROVIDER_PRESETS[0]
}

export const AI_MODELS: AIModel[] = [
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    shortLabel: "Claude",
    description: "Best reasoning & annotation quality",
    supportsGrounding: false,
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    shortLabel: "GPT-4o",
    description: "Strong structured output, broad knowledge",
    supportsGrounding: true,
  },
  {
    id: "google/gemini-2.5-pro-preview-03-25",
    label: "Gemini 2.5 Pro",
    shortLabel: "Gemini",
    description: "Long-context, web grounding available",
    supportsGrounding: true,
  },
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek V3",
    shortLabel: "DeepSeek",
    description: "Cost-efficient frontier model",
    supportsGrounding: false,
  },
  {
    id: "mistralai/mistral-small-3.2-24b-instruct",
    label: "Mistral Small 3.2",
    shortLabel: "Mistral",
    description: "Fast, excellent structured outputs",
    supportsGrounding: false,
  },
  // ── Free tier (no credits required, ~200 req/day limit) ─────────────────
  {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    label: "Nemotron 30B · Free",
    shortLabel: "Nemotron",
    description: "Free · no credits · ~200 req/day · Nvidia-hosted",
    supportsGrounding: false,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    label: "Nemotron 120B · Free",
    shortLabel: "Nemotron",
    description: "Free · no credits · ~200 req/day · Nvidia-hosted · MoE",
    supportsGrounding: false,
  },
]

export const OPENAI_MODELS: AIModel[] = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    shortLabel: "GPT-4o",
    description: "Strong structured output, broad knowledge",
    supportsGrounding: true,
    groundingModelId: "gpt-4o-search-preview",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    shortLabel: "GPT-4o Mini",
    description: "Fast and capable, web grounding available",
    supportsGrounding: true,
    groundingModelId: "gpt-4o-mini-search-preview",
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    shortLabel: "GPT-4.1",
    description: "Latest GPT-4, improved instruction following",
    supportsGrounding: false,
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 Mini",
    shortLabel: "GPT-4.1 Mini",
    description: "Fast and capable, good balance",
    supportsGrounding: false,
  },
  {
    id: "o4-mini",
    label: "o4-mini",
    shortLabel: "o4-mini",
    description: "Fast reasoning model",
    supportsGrounding: false,
  },
]

export const ZAI_MODELS: AIModel[] = [
  {
    id: "glm-4.5",
    label: "GLM-4.5",
    shortLabel: "GLM-4.5",
    description: "Fast, cost-efficient Z.ai model",
    supportsGrounding: false,
  },
  {
    id: "glm-4.7",
    label: "GLM-4.7",
    shortLabel: "GLM-4.7",
    description: "Strong reasoning, 200K context",
    supportsGrounding: false,
  },
  {
    id: "glm-5",
    label: "GLM-5",
    shortLabel: "GLM-5",
    description: "Z.ai flagship model",
    supportsGrounding: false,
  },
  {
    id: "glm-5-turbo",
    label: "GLM-5 Turbo",
    shortLabel: "GLM-5 Turbo",
    description: "Fast, capable, community tested",
    supportsGrounding: false,
  },
]

export const ANTHROPIC_MODELS: AIModel[] = [
  {
    id: "claude-3-7-sonnet-latest",
    label: "Claude 3.7 Sonnet",
    shortLabel: "Claude 3.7",
    description: "Strong reasoning and coding quality",
    supportsGrounding: false,
  },
  {
    id: "claude-3-5-haiku-latest",
    label: "Claude 3.5 Haiku",
    shortLabel: "Haiku",
    description: "Fast low-latency model",
    supportsGrounding: false,
  },
]

export const NVIDIA_MODELS: AIModel[] = [
  {
    id: "meta/llama-3.1-70b-instruct",
    label: "Llama 3.1 70B Instruct",
    shortLabel: "Llama 70B",
    description: "High-quality synthesis and reasoning",
    supportsGrounding: false,
  },
  {
    id: "meta/llama-3.1-8b-instruct",
    label: "Llama 3.1 8B Instruct",
    shortLabel: "Llama 8B",
    description: "Fast tagging and classification",
    supportsGrounding: false,
  },
  {
    id: "meta/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B Instruct",
    shortLabel: "Llama 3.3",
    description: "High-quality long synthesis and instruction following",
    supportsGrounding: false,
  },
  {
    id: "mistralai/mistral-nemo-12b-instruct",
    label: "Mistral NeMo 12B Instruct",
    shortLabel: "NeMo 12B",
    description: "Fast, lower-cost note annotation and summaries",
    supportsGrounding: false,
  },
]

export const GEMINI_MODELS: AIModel[] = [
  // ── Gemini 3.1 Family (Preview - Latest, April 2026) ──────────────────────
  {
    id: "gemini-3.1-pro",
    label: "Gemini 3.1 Pro (Preview)",
    shortLabel: "3.1 Pro",
    description: "Most advanced reasoning · complex multimodal tasks · 2M context",
    supportsGrounding: false,
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite (Preview)",
    shortLabel: "3.1 Lite",
    description: "Most cost-efficient · massive scale · ultra-low latency",
    supportsGrounding: false,
  },

  // ── Gemini 3 Family (Preview - Frontier Performance) ───────────────────────
  {
    id: "gemini-3-flash",
    label: "Gemini 3 Flash (Preview)",
    shortLabel: "3 Flash",
    description: "Frontier-class performance · high-speed · low-latency tasks",
    supportsGrounding: false,
  },

  // ── Gemini 2.5 Family (Stable - High-Capability) ──────────────────────────
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    shortLabel: "2.5 Pro",
    description: "High-capability reasoning & coding · 1M context",
    supportsGrounding: false,
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    shortLabel: "2.5 Flash",
    description: "Balanced performance · high-volume, fast-response · 1M context",
    supportsGrounding: false,
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    shortLabel: "2.5 Lite",
    description: "Speed-optimized · high-throughput applications · 100K context",
    supportsGrounding: false,
  },

  // ── Gemini 2.0 Family (Stable - Performance-Oriented) ──────────────────────
  {
    id: "gemini-2.0-pro",
    label: "Gemini 2.0 Pro",
    shortLabel: "2.0 Pro",
    description: "High-quality reasoning · complex tasks · 1M context",
    supportsGrounding: false,
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    shortLabel: "2.0 Flash",
    description: "Optimized for speed · streaming support · 1M context",
    supportsGrounding: false,
  },
  {
    id: "gemini-2.0-flash-lite",
    label: "Gemini 2.0 Flash-Lite",
    shortLabel: "2.0 Lite",
    description: "Minimal latency · structured output · 100K context",
    supportsGrounding: false,
  },
  {
    id: "gemini-2.0-flash-exp-0805",
    label: "Gemini 2.0 Flash Experimental",
    shortLabel: "2.0 Exp",
    description: "Experimental improvements · higher accuracy · 1M context",
    supportsGrounding: false,
  },
  {
    id: "gemini-2.0-pro-exp-0801",
    label: "Gemini 2.0 Pro Experimental",
    shortLabel: "2.0 Pro Exp",
    description: "Early-access pro model · cutting-edge features · 1M context",
    supportsGrounding: false,
  },

  // ── Gemini 1.5 Family (Stable - Extended Context) ───────────────────────────
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    shortLabel: "1.5 Pro",
    description: "Large context window · complex document analysis · 2M context",
    supportsGrounding: false,
  },
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    shortLabel: "1.5 Flash",
    description: "Fast reasoning · balanced quality/speed · 1M context",
    supportsGrounding: false,
  },
  {
    id: "gemini-1.5-flash-8b",
    label: "Gemini 1.5 Flash 8B",
    shortLabel: "1.5 Flash 8B",
    description: "Ultra-fast inference · cost-efficient · 1M context",
    supportsGrounding: false,
  },
]

// Keep empty so UI falls back to a text input; local Ollama model names depend
// on what each user has pulled (e.g., llama3.2, qwen2.5, mistral).
export const OLLAMA_MODELS: AIModel[] = []

export function getModelsForProvider(provider: AIProvider): AIModel[] {
  if (provider === "openai") return OPENAI_MODELS
  if (provider === "anthropic") return ANTHROPIC_MODELS
  if (provider === "nvidia") return NVIDIA_MODELS
  if (provider === "zai") return ZAI_MODELS
  if (provider === "gemini") return GEMINI_MODELS
  if (provider === "ollama") return OLLAMA_MODELS
  return AI_MODELS // openrouter + safe fallback for any stale localStorage value
}

function scoreModelForTask(task: ModelTask, model: AIModel): number {
  const text = `${model.id} ${model.label} ${model.description}`.toLowerCase()

  if (task === "tagging") {
    let score = 0
    if (text.includes("mini") || text.includes("8b") || text.includes("haiku") || text.includes("nemo")) score += 3
    if (text.includes("fast") || text.includes("lite")) score += 2
    if (text.includes("70b") || text.includes("pro")) score -= 1
    return score
  }

  if (task === "summarize") {
    let score = 0
    if (text.includes("mistral") || text.includes("gpt-4o") || text.includes("flash")) score += 2
    if (text.includes("fast") || text.includes("small") || text.includes("mini")) score += 1
    return score
  }

  if (task === "reasoning") {
    let score = 0
    if (text.includes("70b") || text.includes("pro") || text.includes("sonnet") || text.includes("reason")) score += 3
    if (text.includes("mini") || text.includes("8b") || text.includes("haiku")) score -= 1
    return score
  }

  if (task === "coding") {
    let score = 0
    if (text.includes("coder") || text.includes("code") || text.includes("qwen") || text.includes("gpt-4.1")) score += 3
    if (text.includes("mini") || text.includes("lite")) score -= 1
    return score
  }

  let score = 0
  if (text.includes("70b") || text.includes("pro")) score += 2
  if (text.includes("mini") || text.includes("8b") || text.includes("haiku")) score -= 1
  return score
}

export function getSuggestedModelsForTask(
  provider: AIProvider,
  task: ModelTask,
  models?: AIModel[],
): AIModel[] {
  const pool = (models && models.length > 0) ? models : getModelsForProvider(provider)
  return [...pool]
    .sort((a, b) => scoreModelForTask(task, b) - scoreModelForTask(task, a))
    .slice(0, 6)
}

export const DEFAULT_MODEL_ID = "openai/gpt-4o"
export const DEFAULT_PROVIDER: AIProvider = "openrouter"
const DEFAULT_OLLAMA_MODEL_ID = "llama3.2"
const DEFAULT_OPENAI_MODEL_ID = "gpt-4o"
const DEFAULT_ZAI_MODEL_ID = "glm-4.5"
const DEFAULT_GEMINI_MODEL_ID = "gemini-2.5-pro"

export interface AISettings {
  apiKey: string
  modelId: string
  webGrounding: boolean
  provider: AIProvider
  customBaseUrl: string
  /** Per-provider key store so switching back to a provider restores its key */
  providerKeys?: Partial<Record<AIProvider, string>>
}

const STORAGE_KEY = "nodepad-ai-settings"

function loadSettings(): AISettings {
  if (typeof window === "undefined") {
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "", ...JSON.parse(raw) }
  } catch {
    return { apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false, provider: DEFAULT_PROVIDER, customBaseUrl: "" }
  }
}

export interface AIConfig {
  apiKey: string
  modelId: string
  supportsGrounding: boolean
  provider: AIProvider
  customBaseUrl: string
}

export function getDefaultModelForProvider(provider: AIProvider): string {
  if (provider === "ollama") return DEFAULT_OLLAMA_MODEL_ID
  if (provider === "openai") return OPENAI_MODELS[0]?.id ?? DEFAULT_OPENAI_MODEL_ID
  if (provider === "zai") return ZAI_MODELS[0]?.id ?? DEFAULT_ZAI_MODEL_ID
  if (provider === "gemini") return GEMINI_MODELS[0]?.id ?? DEFAULT_GEMINI_MODEL_ID
  return AI_MODELS[0]?.id ?? DEFAULT_MODEL_ID
}

export function loadAIConfig(): AIConfig | null {
  const s = loadSettings()
  const needsApiKey = s.provider !== "ollama"
  if (needsApiKey && !s.apiKey) return null
  const models = getModelsForProvider(s.provider)
  const model = models.find(m => m.id === s.modelId)
  // Use the matched model's id if found; otherwise fall back to the first model
  // for this provider.  This handles the case where localStorage still holds an
  // OpenRouter-prefixed id (e.g. "openai/gpt-4o") after switching to OpenAI —
  // that string won't match any entry in OPENAI_MODELS so we fall back to "gpt-4o".
  let modelId = model?.id ?? models[0]?.id ?? s.modelId ?? getDefaultModelForProvider(s.provider)
  if (s.provider === "ollama") {
    // Prevent stale provider-specific IDs like "openai/gpt-4o" when switching
    // to local Ollama where models are user-defined.
    if (!modelId || modelId.includes("/")) modelId = DEFAULT_OLLAMA_MODEL_ID
  }
  // Z.ai does not support grounding; only openrouter and openai do
  const supportsGrounding =
    (s.provider === "openrouter" || s.provider === "openai") &&
    s.webGrounding &&
    (model?.supportsGrounding ?? false)
  return { apiKey: s.apiKey, modelId, supportsGrounding, provider: s.provider, customBaseUrl: s.customBaseUrl }
}

export function getBaseUrl(config: AIConfig): string {
  const custom = config.customBaseUrl?.trim()
  let base = custom || getPreset(config.provider).baseUrl

  // Accept shorthand local inputs like "11434" or "localhost:11434".
  if (/^\d{2,5}$/.test(base)) base = `http://localhost:${base}`
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(base)) base = `http://${base}`

  // Ollama OpenAI-compatible endpoint lives under /v1.
  if (config.provider === "ollama") {
    base = base.replace(/\/+$/, "")
    if (!/\/v1$/i.test(base)) base = `${base}/v1`
  }

  return base
}

function normalizeBaseUrl(provider: AIProvider, customBaseUrl: string): string {
  const custom = customBaseUrl.trim()
  let base = custom || getPreset(provider).baseUrl

  if (/^\d{2,5}$/.test(base)) base = `http://localhost:${base}`
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(base)) base = `http://${base}`

  if (provider === "ollama") {
    base = base.replace(/\/+$/, "")
    if (!/\/v1$/i.test(base)) base = `${base}/v1`
  }

  return base
}

export async function fetchProviderModelsFromRegistry(
  provider: AIProvider,
  apiKey: string,
  customBaseUrl = "",
): Promise<AIModel[]> {
  const trimmedKey = apiKey.trim()
  if (provider !== "ollama" && !trimmedKey) return []

  const baseUrl = normalizeBaseUrl(provider, customBaseUrl)
  const headers = getProviderHeaders({
    provider,
    apiKey: trimmedKey,
    modelId: "",
    supportsGrounding: false,
    customBaseUrl,
  })

  // Anthropic has a different API shape and no stable /models list in this app.
  if (provider === "anthropic") return []

  try {
    const res = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers,
    })
    if (!res.ok) return []

    const json = await res.json() as {
      data?: Array<{ id?: string; name?: string; description?: string; owned_by?: string }>
    }
    const models = (json.data ?? [])
      .map((m) => {
        const id = (m.id ?? "").trim()
        if (!id) return null
        const label = (m.name ?? id).trim()
        const shortLabel = label.split("/").pop() ?? label
        const descParts = [m.description, m.owned_by].filter(Boolean)
        return {
          id,
          label,
          shortLabel,
          description: descParts.join(" · ") || "Live from provider registry",
          supportsGrounding: false,
        } as AIModel
      })
      .filter((m): m is AIModel => m !== null)

    return models.slice(0, 120)
  } catch {
    return []
  }
}

export function getProviderHeaders(config: AIConfig): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" }

  if (config.provider !== "ollama" || config.apiKey) {
    base["Authorization"] = `Bearer ${config.apiKey}`
  }

  if (config.provider === "gemini" && config.apiKey) {
    // Gemini's OpenAI-compatible endpoint accepts API keys via this header too.
    base["x-goog-api-key"] = config.apiKey
  }

  if (config.provider === "openrouter") {
    base["HTTP-Referer"] = "https://nodepad.space"
    base["X-Title"] = "nodepad"
  }
  return base
}

/** @deprecated Use loadAIConfig() for direct browser → provider calls.
 *  Kept for any remaining server-route usage during transition. */
export function getAIHeaders(): Record<string, string> {
  const config = loadAIConfig()
  if (!config) return {}
  const models = getModelsForProvider(config.provider)
  const model = models.find(m => m.id === config.modelId) || AI_MODELS.find(m => m.id === DEFAULT_MODEL_ID)!
  return {
    "x-or-key": config.apiKey,
    "x-or-model": config.modelId,
    "x-or-supports-grounding": model.supportsGrounding ? "true" : "false",
  }
}

export function useAISettings() {
  // Always start with the SSR-safe default so server and client render identically.
  // Load the real localStorage value after mount to avoid hydration mismatches
  // caused by settings.apiKey toggling conditional DOM blocks (API key banner,
  // modelLabel prop, etc.) between the server render and client hydration.
  const [settings, setSettings] = useState<AISettings>({
    apiKey: "", modelId: DEFAULT_MODEL_ID, webGrounding: false,
    provider: DEFAULT_PROVIDER, customBaseUrl: "",
  })
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    setIsHydrated(true)
  }, [])

  const updateSettings = useCallback((patch: Partial<AISettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const models = getModelsForProvider(settings.provider)

  const resolvedModelId = (() => {
    const model = models.find(m => m.id === settings.modelId) || models[0]
    if (!model) return settings.modelId || getDefaultModelForProvider(settings.provider)
    if (settings.provider === "openrouter" && settings.webGrounding && model.supportsGrounding) {
      return `${model.id}:online`
    }
    return model.id
  })()

  const currentModel: AIModel = models.find(m => m.id === settings.modelId) || models[0] || {
    id: settings.modelId || getDefaultModelForProvider(settings.provider),
    label: settings.modelId || getDefaultModelForProvider(settings.provider),
    shortLabel: (settings.modelId || getDefaultModelForProvider(settings.provider)).split("/").pop() || settings.modelId,
    description: "Custom model",
    supportsGrounding: false,
  }

  return { settings, updateSettings, resolvedModelId, currentModel, models, isHydrated }
}
