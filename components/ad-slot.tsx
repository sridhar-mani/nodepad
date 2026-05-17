"use client"

import { useEffect, useRef, useState } from "react"
import { useAdsDisplayMode } from "@/lib/ads-display-mode"
import {
  areAdsHiddenByUser,
  getAdPlacementConfig,
  getAdSenseClientId,
  type AdPlacement,
} from "@/lib/ads-config"
import { cn } from "@/lib/utils"

interface AdSlotProps {
  placement: AdPlacement
  className?: string
  onDismiss?: () => void
  /** Override detected display mode (testing) */
  mode?: "browser" | "standalone"
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

export function AdSlot({ placement, className = "", onDismiss, mode: modeOverride }: AdSlotProps) {
  const detectedMode = useAdsDisplayMode()
  const mode = modeOverride ?? detectedMode
  const clientId = getAdSenseClientId()
  const config = getAdPlacementConfig(placement, mode)
  const pushed = useRef(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const sync = () => setHidden(areAdsHiddenByUser())
    sync()
    window.addEventListener("nodepad-ads-pref-changed", sync)
    return () => window.removeEventListener("nodepad-ads-pref-changed", sync)
  }, [])

  useEffect(() => {
    pushed.current = false
  }, [placement, mode, config?.slot])

  useEffect(() => {
    if (!clientId || !config || hidden || pushed.current) return
    const t = window.setTimeout(() => {
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        pushed.current = true
      } catch {
        /* ad blocker or script not ready */
      }
    }, 120)
    return () => clearTimeout(t)
  }, [clientId, config, hidden])

  if (!clientId || !config || hidden) return null

  const maxH = config.maxHeight ?? 90
  const isNative = config.variant === "native-card"

  return (
    <aside
      className={cn(
        "relative overflow-hidden",
        isNative
          ? "rounded-md border border-border/60 bg-card/90 shadow-sm"
          : "rounded-sm border border-border/40 bg-muted/20",
        className,
      )}
      aria-label="Sponsored"
      data-ad-mode={mode}
      data-ad-placement={placement}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/30">
        <span className="font-mono text-[7px] uppercase tracking-[0.2em] text-muted-foreground/50">
          {isNative ? "Sponsored · fits your workspace" : "Sponsored"}
        </span>
        {onDismiss && (
          <button
            type="button"
            onClick={() => {
              onDismiss()
              setHidden(true)
            }}
            className="font-mono text-[7px] text-muted-foreground/45 hover:text-muted-foreground transition-colors touch-target"
          >
            Hide
          </button>
        )}
      </div>
      <div
        className="flex items-center justify-center min-h-[50px] px-2 py-1"
        style={{ maxHeight: maxH }}
      >
        <ins
          className="adsbygoogle block w-full"
          style={{ display: "block", maxHeight: maxH }}
          data-ad-client={clientId}
          data-ad-slot={config.slot}
          data-ad-format={config.format}
          data-ad-layout-key={config.layoutKey}
          data-full-width-responsive={
            config.format === "auto" || config.format === "fluid" ? "true" : undefined
          }
        />
      </div>
    </aside>
  )
}

/** @deprecated Use AdSlot */
export const GoogleAd = AdSlot
