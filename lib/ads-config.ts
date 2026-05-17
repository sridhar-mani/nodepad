/** Google AdSense + optional networks — configure via .env.local */

import type { AdsDisplayMode } from "@/lib/ads-display-mode"

export type AdPlacement = "about" | "empty" | "feed" | "anchor"

export type AdUnitVariant = "inline" | "native-card" | "anchor"

export interface AdPlacementConfig {
  slot: string
  format: "auto" | "horizontal" | "rectangle" | "fluid"
  variant: AdUnitVariant
  maxHeight?: number
  /** AdSense in-feed / in-article layout key when using fluid native units */
  layoutKey?: string
}

function env(key: string): string | undefined {
  const v = process.env[key]?.trim()
  return v || undefined
}

export function getAdSenseClientId(): string | undefined {
  return env("NEXT_PUBLIC_ADSENSE_CLIENT_ID")
}

export function getPropellerZoneId(): string | undefined {
  return env("NEXT_PUBLIC_PROPELLERADS_ZONE_ID")
}

export function isAdsEnabled(): boolean {
  return Boolean(getAdSenseClientId())
}

export function isPropellerEnabled(): boolean {
  return Boolean(getPropellerZoneId())
}

const SLOT_ENV: Record<AdPlacement, { browser?: string; standalone?: string; shared?: string }> = {
  about: {
    shared: "NEXT_PUBLIC_ADSENSE_SLOT_ABOUT",
    standalone: "NEXT_PUBLIC_ADSENSE_SLOT_ABOUT_NATIVE",
  },
  empty: {
    shared: "NEXT_PUBLIC_ADSENSE_SLOT_EMPTY",
    standalone: "NEXT_PUBLIC_ADSENSE_SLOT_EMPTY_NATIVE",
  },
  feed: {
    standalone: "NEXT_PUBLIC_ADSENSE_SLOT_FEED",
    shared: "NEXT_PUBLIC_ADSENSE_SLOT_FEED",
  },
  anchor: {
    browser: "NEXT_PUBLIC_ADSENSE_SLOT_ANCHOR",
  },
}

function resolveSlot(placement: AdPlacement, mode: AdsDisplayMode): string | undefined {
  const keys = SLOT_ENV[placement]
  if (mode === "standalone" && keys.standalone) {
    const v = env(keys.standalone)
    if (v) return v
  }
  if (mode === "browser" && keys.browser) {
    const v = env(keys.browser)
    if (v) return v
  }
  if (keys.shared) return env(keys.shared)
  return undefined
}

/**
 * Placement matrix:
 * - browser: anchor (sticky), horizontal empty, auto about; optional feed
 * - standalone: native in-feed only — no anchor / pop-ups
 */
export function getAdPlacementConfig(
  placement: AdPlacement,
  mode: AdsDisplayMode,
): AdPlacementConfig | null {
  const client = getAdSenseClientId()
  if (!client) return null

  if (placement === "anchor" && mode !== "browser") return null

  const slot = resolveSlot(placement, mode)
  if (!slot) return null

  if (placement === "anchor") {
    return { slot, format: "horizontal", variant: "anchor", maxHeight: 90 }
  }

  if (placement === "about") {
    if (mode === "standalone") {
      return {
        slot,
        format: "fluid",
        variant: "native-card",
        maxHeight: 140,
        layoutKey: env("NEXT_PUBLIC_ADSENSE_LAYOUT_ABOUT") ?? "-fb+5w+4e-db+86",
      }
    }
    return { slot, format: "auto", variant: "inline", maxHeight: 120 }
  }

  if (placement === "empty") {
    if (mode === "standalone") {
      return {
        slot,
        format: "fluid",
        variant: "native-card",
        maxHeight: 100,
        layoutKey: env("NEXT_PUBLIC_ADSENSE_LAYOUT_EMPTY") ?? "-fb+5w+4e-db+86",
      }
    }
    return { slot, format: "horizontal", variant: "inline", maxHeight: 72 }
  }

  // feed — native in-feed (primarily installed app / dashboard surfaces)
  return {
    slot,
    format: "fluid",
    variant: "native-card",
    maxHeight: 120,
    layoutKey: env("NEXT_PUBLIC_ADSENSE_LAYOUT_FEED") ?? "-fb+5w+4e-db+86",
  }
}

export const ADS_DISMISS_KEY = "nodepad-ads-hidden"
export const ADS_ANCHOR_DISMISS_KEY = "nodepad-ads-anchor-hidden"

export function areAdsHiddenByUser(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(ADS_DISMISS_KEY) === "1"
  } catch {
    return false
  }
}

export function isAnchorAdHiddenByUser(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(ADS_ANCHOR_DISMISS_KEY) === "1"
  } catch {
    return false
  }
}

export function setAdsHiddenByUser(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(ADS_DISMISS_KEY, "1")
    else localStorage.removeItem(ADS_DISMISS_KEY)
  } catch {
    /* ignore */
  }
}

export function setAnchorAdHiddenByUser(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(ADS_ANCHOR_DISMISS_KEY, "1")
    else localStorage.removeItem(ADS_ANCHOR_DISMISS_KEY)
  } catch {
    /* ignore */
  }
}
