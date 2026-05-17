export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type InstallWindow = Window & {
  __nodepadInstallPrompt?: BeforeInstallPromptEvent
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | undefined {
  if (typeof window === "undefined") return undefined
  return (window as InstallWindow).__nodepadInstallPrompt
}

export function isAppInstalled(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function canShowInstallUi(): boolean {
  if (typeof window === "undefined") return false
  if (isAppInstalled()) return false
  if (getDeferredInstallPrompt()) return true
  if (isIosDevice()) return true
  return false
}

export async function triggerInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = getDeferredInstallPrompt()
  if (!event) return "unavailable"
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === "accepted") {
    ;(window as InstallWindow).__nodepadInstallPrompt = undefined
    return "accepted"
  }
  return "dismissed"
}
