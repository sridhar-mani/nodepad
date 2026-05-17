import { NextResponse } from "next/server"
import YahooFinance from "yahoo-finance2"

const yahooFinance = new YahooFinance()

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol")?.trim().toUpperCase()
  if (!symbol || symbol.length > 12) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 })
  }

  try {
    const rows = await yahooFinance.quote(symbol)
    const q = Array.isArray(rows) ? rows[0] : rows
    if (!q) {
      return NextResponse.json({ error: "No quote found" }, { status: 404 })
    }

    return NextResponse.json({
      symbol: q.symbol ?? symbol,
      shortName: q.shortName ?? q.longName,
      regularMarketPrice: q.regularMarketPrice,
      currency: q.currency,
      regularMarketChangePercent: q.regularMarketChangePercent,
      marketState: q.marketState,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Quote failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
