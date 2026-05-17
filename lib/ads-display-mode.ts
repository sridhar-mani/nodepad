"use client"

import { useEffect, useState } from "react"

/** Browser tab vs installed PWA (standalone / iOS home screen). */
export type AdsDisplayMode = "browser" | "standalone"

export function getAdsDisplayMode(): AdsDisplayMode {
  if (typeof window === "undefined") return "browser"

  const isStandaloneMedia = window.matchMedia("(display-mode: standalone)").matches
  const isFullscreenApp = window.matchMedia("(display-mode: fullscreen)").matches
  const isMinimalUi = window.matchMedia("(display-mode: minimal-ui)").matches
  const isIosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  )

  if (isIosStandalone || isStandaloneMedia || isFullscreenApp || isMinimalUi) {
    return "standalone"
  }
  return "browser"
}

export function useAdsDisplayMode(): AdsDisplayMode {
  const [mode, setMode] = useState<AdsDisplayMode>("browser")

  useEffect(() => {
    const update = () => setMode(getAdsDisplayMode())
    update()

    const queries = ["(display-mode: standalone)", "(display-mode: fullscreen)", "(display-mode: minimal-ui)"]
    const listeners: Array<() => void> = []
    for (const q of queries) {
      const mq = window.matchMedia(q)
      const fn = () => update()
      mq.addEventListener("change", fn)
      listeners.push(() => mq.removeEventListener("change", fn))
    }

    return () => listeners.forEach((off) => off())
  }, [])

  return mode
}
