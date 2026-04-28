"use client"

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import type { AIConfig } from "./ai-settings"

/**
 * Native Gemini integration using @google/generative-ai
 * Provides better structured output support, streaming, and native safety filters.
 *
 * Fallback behavior: if Gemini native fails, consumers should fall back to
 * the OpenAI-compatible endpoint.
 */

export interface GeminiNativeError {
  code: string
  message: string
  fallbackReason: string
}

export function isGeminiNativeAvailable(config: AIConfig): boolean {
  return config.provider === "gemini" && !!config.apiKey
}

/**
 * Convert Gemini model ID to full model name for the API
 * e.g. "gemini-2.5-pro" → "models/gemini-2.5-pro"
 */
function getFullModelName(modelId: string): string {
  if (modelId.startsWith("models/")) return modelId
  return `models/${modelId}`
}

/**
 * Call Gemini API natively using the official SDK
 * Returns structured JSON response matching the enrichment schema
 */
export async function callGeminiNative(
  config: AIConfig,
  systemPrompt: string,
  userMessage: string,
  responseSchema?: Record<string, unknown>,
): Promise<string> {
  if (!config.apiKey) {
    throw new Error("Gemini API key not configured")
  }

  const client = new GoogleGenerativeAI(config.apiKey)
  const model = client.getGenerativeModel({
    model: getFullModelName(config.modelId || "gemini-2.5-pro"),
    systemInstruction: systemPrompt,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  })

  // Prepare generation config with structured output if schema provided
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    maxOutputTokens: 1200,
  }

  // If a response schema is provided, use Gemini's JSON schema mode
  if (responseSchema) {
    generationConfig.responseMimeType = "application/json"
    generationConfig.responseSchema = responseSchema
  }

  try {
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: generationConfig as Parameters<
        typeof model.generateContent
      >[0]["generationConfig"],
    })

    const text = response.content.parts
      .map(part => {
        if ("text" in part) return part.text
        return ""
      })
      .join("")

    if (!text) {
      throw new Error("Empty response from Gemini API")
    }

    return text
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new GeminiSDKError(message, "Gemini SDK call failed — switching to OpenAI-compatible endpoint", error)
  }
}

/**
 * Attempt Gemini native call and return fallback error if it fails
 * This allows consumers to catch and decide whether to retry or fallback
 */
export async function tryGeminiNative(
  config: AIConfig,
  systemPrompt: string,
  userMessage: string,
  responseSchema?: Record<string, unknown>,
): Promise<{ success: true; response: string } | { success: false; error: GeminiSDKError }> {
  try {
    const response = await callGeminiNative(config, systemPrompt, userMessage, responseSchema)
    return { success: true, response }
  } catch (error) {
    if (error instanceof GeminiSDKError) {
      return { success: false, error }
    }
    return {
      success: false,
      error: new GeminiSDKError("Unknown error", "Unexpected error in Gemini call", error),
    }
  }
}

// ── Error handling ────────────────────────────────────────────────────────────

export class GeminiSDKError extends Error {
  public readonly fallbackReason: string
  public readonly originalError: unknown

  constructor(message: string, fallbackReason: string, originalError?: unknown) {
    super(message)
    this.name = "GeminiSDKError"
    this.fallbackReason = fallbackReason
    this.originalError = originalError
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      fallbackReason: this.fallbackReason,
    }
  }
}

/**
 * Helper: Check if error indicates a recoverable/fallback-worthy failure
 * (API key, rate limit, temporary service issue vs. schema/content errors)
 */
export function shouldFallbackToOpenAI(error: unknown): boolean {
  if (!(error instanceof GeminiSDKError)) return false
  const msg = error.message.toLowerCase()
  // Fallback for auth, rate limit, temporary service issues
  return (
    msg.includes("unauthenticated") ||
    msg.includes("invalid api key") ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("unavailable") ||
    msg.includes("service") ||
    msg.includes("timeout")
  )
}
