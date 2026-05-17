import { NextResponse } from "next/server"
import YahooFinance from "yahoo-finance2"

const yahooFinance = new YahooFinance()

const RANGE_DAYS: Record<string, number> = {
  "1mo": 31,
  "3mo": 92,
  "6mo": 183,
  "1y": 365,
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol")?.trim().toUpperCase()
  const range = searchParams.get("range") ?? "3mo"
  if (!symbol || symbol.length > 12) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 })
  }

  const days = RANGE_DAYS[range] ?? RANGE_DAYS["3mo"]
  const period1 = new Date()
  period1.setDate(period1.getDate() - days)

  try {
    const rows = await yahooFinance.historical(symbol, {
      period1,
      interval: "1d",
    })

    const points = (rows ?? [])
      .map((row) => ({
        time: Math.floor(new Date(row.date).getTime() / 1000),
        value: row.close ?? row.adjClose ?? 0,
      }))
      .filter((p) => p.value > 0)

    return NextResponse.json({ symbol, points })
  } catch (e) {
    const message = e instanceof Error ? e.message : "History failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
