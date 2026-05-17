"use client"

import Script from "next/script"
import { getAdSenseClientId } from "@/lib/ads-config"

/**
 * Loads AdSense once when configured.
 * Web + installed modes both use AdSense (display / native / anchor slots differ by mode).
 * Ad requests are never cached by the service worker — see public/sw.js.
 */
export function AdsScript() {
  const clientId = getAdSenseClientId()
  if (!clientId) return null

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
