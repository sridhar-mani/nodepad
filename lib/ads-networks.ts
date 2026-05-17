/** Hostname fragments — service worker must never cache these (network-only). */
export const AD_NETWORK_HOST_FRAGMENTS = [
  "googleads",
  "googlesyndication",
  "doubleclick",
  "adservice.google",
  "google.com",
  "gstatic.com",
  "adsterra",
  "propellerads",
  "propellerclick",
  "infolinks",
  "taboola",
  "outbrain",
] as const

export function isAdNetworkRequest(url: URL | string): boolean {
  const u = typeof url === "string" ? new URL(url) : url
  const host = u.hostname.toLowerCase()
  const path = u.pathname.toLowerCase()
  return AD_NETWORK_HOST_FRAGMENTS.some(
    (frag) => host.includes(frag) || (frag === "google.com" && path.includes("/pagead")),
  )
}
