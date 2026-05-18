"use client"

import { useEffect, useState } from "react"
import Script from "next/script"
import { areAdsHiddenByUser, getAdSenseClientId } from "@/lib/ads-config"

/**
 * Loads AdSense once when configured. Placement is handled by Auto ads in AdSense —
 * no manual ad units in the app. Ad requests are not cached by the service worker.
 */
export function AdsScript() {
  const clientId = getAdSenseClientId()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const sync = () => setAllowed(!areAdsHiddenByUser())
    sync()
    window.addEventListener("nodepad-ads-pref-changed", sync)
    return () => window.removeEventListener("nodepad-ads-pref-changed", sync)
  }, [])

  if (!clientId || !allowed) return null

  return (
    <Script
      id="adsense-loader"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}
