/** Google AdSense Auto ads — client id via .env.local */

function env(key: string): string | undefined {
  const v = process.env[key]?.trim()
  return v || undefined
}

export function getAdSenseClientId(): string | undefined {
  return env("NEXT_PUBLIC_ADSENSE_CLIENT_ID")
}

export function isAdsEnabled(): boolean {
  return Boolean(getAdSenseClientId())
}

export const ADS_DISMISS_KEY = "nodepad-ads-hidden"

export function areAdsHiddenByUser(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(ADS_DISMISS_KEY) === "1"
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
