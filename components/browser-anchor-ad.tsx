"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { useAdsDisplayMode } from "@/lib/ads-display-mode"
import {
  areAdsHiddenByUser,
  getAdPlacementConfig,
  getAdSenseClientId,
  isAnchorAdHiddenByUser,
  setAnchorAdHiddenByUser,
} from "@/lib/ads-config"

interface BrowserAnchorAdProps {
  /** Hide while command palette / modal chrome is open */
  suppressed?: boolean
}

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

/**
 * Sticky bottom anchor unit — web/browser mode only.
 * Never shown in installed standalone PWA (protects retention).
 */
export function BrowserAnchorAd({ suppressed }: BrowserAnchorAdProps) {
  const mode = useAdsDisplayMode()
  const clientId = getAdSenseClientId()
  const config = getAdPlacementConfig("anchor", "browser")
  const pushed = useRef(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    const sync = () =>
      setHidden(areAdsHiddenByUser() || isAnchorAdHiddenByUser())
    sync()
    window.addEventListener("nodepad-ads-pref-changed", sync)
    return () => window.removeEventListener("nodepad-ads-pref-changed", sync)
  }, [])

  useEffect(() => {
    if (mode !== "browser" || !clientId || !config || hidden || suppressed || pushed.current) {
      return
    }
    const t = window.setTimeout(() => {
      try {
        ;(window.adsbygoogle = window.adsbygoogle || []).push({})
        pushed.current = true
      } catch {
        /* blocked */
      }
    }, 200)
    return () => clearTimeout(t)
  }, [mode, clientId, config, hidden, suppressed])

  useEffect(() => {
    const active = mode === "browser" && !hidden && !suppressed && Boolean(config)
    document.body.classList.toggle("ads-anchor-active", active)
    return () => document.body.classList.remove("ads-anchor-active")
  }, [mode, hidden, suppressed, config])

  if (mode !== "browser" || !clientId || !config || hidden || suppressed) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[45] border-t border-border/50 bg-card/95 backdrop-blur-md pb-[max(0px,env(safe-area-inset-bottom))] lg:hidden"
      role="complementary"
      aria-label="Sponsored anchor"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-2 py-1">
        <span className="font-mono text-[7px] uppercase tracking-widest text-muted-foreground/40 shrink-0 hidden sm:inline">
          Ad
        </span>
        <div className="flex-1 min-w-0 flex justify-center" style={{ maxHeight: 90 }}>
          <ins
            className="adsbygoogle block w-full"
            style={{ display: "block", maxHeight: 90 }}
            data-ad-client={clientId}
            data-ad-slot={config.slot}
            data-ad-format="horizontal"
            data-full-width-responsive="true"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setAnchorAdHiddenByUser(true)
            setHidden(true)
            window.dispatchEvent(new Event("nodepad-ads-pref-changed"))
          }}
          className="touch-target shrink-0 p-2 text-muted-foreground/50 hover:text-foreground"
          aria-label="Dismiss anchor ad"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
