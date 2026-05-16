import type { LLMProviderAdapter, LLMProviderRequest, LLMProviderResponse } from "@/core/llm/provider"

function parseOpenAIText(payload: Record<string, unknown>): string {
  const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined
  return choices?.[0]?.message?.content ?? ""
}

export const openAIProvider: LLMProviderAdapter = {
  id: "openai",
  async generate(request: LLMProviderRequest): Promise<LLMProviderResponse> {
    const response = await fetch(`${request.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
        ...(request.responseFormat ? { response_format: request.responseFormat } : {}),
        ...(request.providerRequestExtras ?? {}),
      }),
    })

    if (!response.ok) {
      let msg = `LLM request failed (${response.status})`
      try {
        const body = await response.json()
        msg = (body?.error?.message as string | undefined) ?? msg
      } catch {
        // Keep fallback message.
      }
      throw new Error(msg)
    }

    const payload = await response.json() as Record<string, unknown>
    const text = parseOpenAIText(payload)
    if (!text) throw new Error("No content in provider response")

    const usage = payload.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined

    return {
      text,
      raw: payload,
      usage: usage
        ? {
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
          }
        : undefined,
    }
  },
}
