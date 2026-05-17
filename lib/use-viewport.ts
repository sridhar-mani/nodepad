"use client"

import { useEffect, useState } from "react"

/** Tailwind-aligned breakpoints: mobile <640, tablet 640–1023, desktop ≥1024 */
export type ViewportTier = "mobile" | "tablet" | "desktop"

export interface ViewportState {
  tier: ViewportTier
  width: number
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  /** Phone or tablet — overlay drawers, bottom chrome */
  isCompact: boolean
}

function tierFromWidth(width: number): ViewportTier {
  if (width < 640) return "mobile"
  if (width < 1024) return "tablet"
  return "desktop"
}

function stateFromWidth(width: number): ViewportState {
  const tier = tierFromWidth(width)
  return {
    tier,
    width,
    isMobile: tier === "mobile",
    isTablet: tier === "tablet",
    isDesktop: tier === "desktop",
    isCompact: tier !== "desktop",
  }
}

export function useViewport(): ViewportState {
  const [state, setState] = useState<ViewportState>(() =>
    typeof window !== "undefined" ? stateFromWidth(window.innerWidth) : stateFromWidth(1280),
  )

  useEffect(() => {
    const update = () => setState(stateFromWidth(window.innerWidth))
    update()
    window.addEventListener("resize", update, { passive: true })
    return () => window.removeEventListener("resize", update)
  }, [])

  return state
}
