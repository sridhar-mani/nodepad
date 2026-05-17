"use client"

import { useEffect } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

export function PWAHooks() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker.register("/sw.js").catch(() => {})

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      const installEvent = event as BeforeInstallPromptEvent
      ;(window as Window & { __nodepadInstallPrompt?: BeforeInstallPromptEvent }).__nodepadInstallPrompt = installEvent
    }

    const onAppInstalled = () => {
      ;(window as Window & { __nodepadInstallPrompt?: BeforeInstallPromptEvent }).__nodepadInstallPrompt = undefined
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onAppInstalled)
    }
  }, [])

  return null
}
