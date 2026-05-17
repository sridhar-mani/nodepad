"use client"

import { useEffect, useRef } from "react"
import type { HistoryPoint } from "@/lib/research/finance-client"

interface FinanceChartProps {
  symbol: string
  points: HistoryPoint[]
  height?: number
}

export function FinanceChart({ symbol, points, height = 220 }: FinanceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || points.length === 0) return

    let disposed = false
    let chart: import("lightweight-charts").IChartApi | null = null

    void (async () => {
      const { createChart, ColorType, LineSeries } = await import("lightweight-charts")
      if (disposed || !containerRef.current) return

      chart = createChart(containerRef.current, {
        height,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "hsl(var(--muted-foreground))",
        },
        grid: {
          vertLines: { color: "hsl(var(--border) / 0.4)" },
          horzLines: { color: "hsl(var(--border) / 0.4)" },
        },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
      })

      const series = chart.addSeries(LineSeries, {
        color: "hsl(var(--primary))",
        lineWidth: 2,
      })

      series.setData(
        points.map((p) => ({
          time: p.time as import("lightweight-charts").UTCTimestamp,
          value: p.value,
        })),
      )

      chart.timeScale().fitContent()
    })()

    return () => {
      disposed = true
      chart?.remove()
    }
  }, [points, height])

  if (points.length === 0) {
    return (
      <p className="font-mono text-[10px] text-muted-foreground py-4 text-center">
        No chart data for {symbol}
      </p>
    )
  }

  return <div ref={containerRef} className="w-full rounded-md overflow-hidden" />
}
