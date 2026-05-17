export interface QuoteResult {
  symbol: string
  shortName?: string
  regularMarketPrice?: number
  currency?: string
  regularMarketChangePercent?: number
  marketState?: string
}

export interface HistoryPoint {
  time: number
  value: number
}

export interface HistoryResult {
  symbol: string
  points: HistoryPoint[]
}

export async function fetchStockQuote(symbol: string): Promise<QuoteResult> {
  const res = await fetch(
    `/api/research/quote?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}`,
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? "Quote request failed")
  }
  return res.json()
}

export async function fetchStockHistory(
  symbol: string,
  range: "1mo" | "3mo" | "6mo" | "1y" = "3mo",
): Promise<HistoryResult> {
  const res = await fetch(
    `/api/research/history?symbol=${encodeURIComponent(symbol.trim().toUpperCase())}&range=${range}`,
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? "History request failed")
  }
  return res.json()
}

export function formatQuoteNote(q: QuoteResult): string {
  const price =
    q.regularMarketPrice != null
      ? `${q.regularMarketPrice.toFixed(2)} ${q.currency ?? ""}`.trim()
      : "—"
  const chg =
    q.regularMarketChangePercent != null
      ? `${q.regularMarketChangePercent >= 0 ? "+" : ""}${q.regularMarketChangePercent.toFixed(2)}%`
      : ""
  return [
    `## ${q.symbol}${q.shortName ? ` · ${q.shortName}` : ""}`,
    `**Price:** ${price}${chg ? ` (${chg})` : ""}`,
    q.marketState ? `Market: ${q.marketState}` : "",
    "",
    "_Source: Yahoo Finance via nodepad research API_",
  ]
    .filter(Boolean)
    .join("\n")
}
