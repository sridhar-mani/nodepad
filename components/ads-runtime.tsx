"use client"

import { useEffect } from "react"
import { useAdsDisplayMode } from "@/lib/ads-display-mode"
import { isPropellerEnabled } from "@/lib/ads-config"
import { BrowserAnchorAd } from "@/components/browser-anchor-ad"

interface AdsRuntimeProps {
  /** Suppress anchor while overlays (command palette, etc.) are open */
  anchorSuppressed?: boolean
}

/**
 * Mode-aware ad chrome: anchor for browser, native units via AdSlot elsewhere.
 * Optional Propeller in-page push loads only in standalone when configured.
 */
export function AdsRuntime({ anchorSuppressed }: AdsRuntimeProps) {
  const mode = useAdsDisplayMode()

  useEffect(() => {
    if (mode !== "standalone" || !isPropellerEnabled()) return
    const zone = process.env.NEXT_PUBLIC_PROPELLERADS_ZONE_ID?.trim()
    if (!zone) return

    // Network-specific SDK — load only when publisher configures a zone id.
    const id = "propeller-push-sdk"
    if (document.getElementById(id)) return

    const script = document.createElement("script")
    script.id = id
    script.async = true
    script.src = `https://cdn.propellerads.com/push/${zone}/sdk.js`
    script.dataset.zone = zone
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [mode])

  return <BrowserAnchorAd suppressed={anchorSuppressed} />
}
