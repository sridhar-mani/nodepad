import type { LLMProviderAdapter, LLMProviderRequest, LLMProviderResponse, LLMMessage } from "@/core/llm/provider"

const ANTHROPIC_VERSION = "2023-06-01"

function toAnthropicMessages(messages: LLMMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }))
}

function extractSystem(messages: LLMMessage[]): string | undefined {
  const systems = messages.filter(m => m.role === "system").map(m => m.content.trim()).filter(Boolean)
  if (systems.length === 0) return undefined
  return systems.join("\n\n")
}

export const anthropicProvider: LLMProviderAdapter = {
  id: "anthropic",
  async generate(request: LLMProviderRequest): Promise<LLMProviderResponse> {
    const response = await fetch(`${request.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": request.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: request.model,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
        system: extractSystem(request.messages),
        messages: toAnthropicMessages(request.messages),
      }),
    })

    if (!response.ok) {
      let msg = `Anthropic request failed (${response.status})`
      try {
        const body = await response.json()
        msg = (body?.error?.message as string | undefined) ?? msg
      } catch {
        // Keep fallback message.
      }
      throw new Error(msg)
    }

    const payload = await response.json() as Record<string, unknown>
    const content = payload.content as Array<{ type?: string; text?: string }> | undefined
    const text = content?.find(c => c.type === "text")?.text ?? ""
    if (!text) throw new Error("No content in Anthropic response")

    const usage = payload.usage as { input_tokens?: number; output_tokens?: number } | undefined

    return {
      text,
      raw: payload,
      usage: usage
        ? {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
          }
        : undefined,
    }
  },
}
