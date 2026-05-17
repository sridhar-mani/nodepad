"use client"

import { useEffect, useState } from "react"
import {
  areAdsHiddenByUser,
  isAdsEnabled,
  setAdsHiddenByUser,
  setAnchorAdHiddenByUser,
} from "@/lib/ads-config"
import { useAdsDisplayMode } from "@/lib/ads-display-mode"

/** Small settings row: hide sponsored content (stored locally). */
export function AdsPrefsRow() {
  const [hidden, setHidden] = useState(true)
  const enabled = isAdsEnabled()
  const displayMode = useAdsDisplayMode()

  useEffect(() => {
    setHidden(areAdsHiddenByUser())
  }, [])

  if (!enabled) return null

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-2.5 py-2">
      <div>
        <span className="font-mono text-[10px] text-foreground block">Sponsored content</span>
        <span className="font-mono text-[8px] text-muted-foreground leading-relaxed">
          {displayMode === "standalone"
            ? "Native units in app surfaces (no pop-ups)"
            : "Web anchors + help & empty canvas units"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          const next = !hidden
          setHidden(next)
          setAdsHiddenByUser(next)
          if (next) setAnchorAdHiddenByUser(true)
          window.dispatchEvent(new Event("nodepad-ads-pref-changed"))
        }}
        className={`relative h-5 w-9 rounded-full transition-colors ${!hidden ? "bg-primary" : "bg-muted"}`}
        aria-pressed={!hidden}
        title={hidden ? "Show sponsored content" : "Hide sponsored content"}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${!hidden ? "left-5" : "left-0.5"}`}
        />
      </button>
    </div>
  )
}
