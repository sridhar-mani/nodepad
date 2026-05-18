"use client"

import { useEffect, useState } from "react"
import { areAdsHiddenByUser, isAdsEnabled, setAdsHiddenByUser } from "@/lib/ads-config"

/** Settings toggle — when off, the AdSense script is not loaded (Auto ads disabled). */
export function AdsPrefsRow() {
  const [hidden, setHidden] = useState(true)
  const enabled = isAdsEnabled()

  useEffect(() => {
    setHidden(areAdsHiddenByUser())
  }, [])

  if (!enabled) return null

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-2.5 py-2">
      <div>
        <span className="font-mono text-[10px] text-foreground block">Google Auto ads</span>
        <span className="font-mono text-[8px] text-muted-foreground leading-relaxed">
          Placements managed in AdSense · reload after toggling
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          const next = !hidden
          setHidden(next)
          setAdsHiddenByUser(next)
          window.dispatchEvent(new Event("nodepad-ads-pref-changed"))
        }}
        className={`relative h-5 w-9 rounded-full transition-colors ${!hidden ? "bg-primary" : "bg-muted"}`}
        aria-pressed={!hidden}
        title={hidden ? "Enable ads" : "Disable ads"}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${!hidden ? "left-5" : "left-0.5"}`}
        />
      </button>
    </div>
  )
}
