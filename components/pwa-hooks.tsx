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

    const onControllerChange = () => {
      // Hook point for showing "App updated" toasts.
    }

    const onNetworkState = () => {
      // Hook point for online/offline status UI.
      void navigator.onLine
    }

    const onVisibility = () => {
      // Hook point for refresh/sync triggers when app regains focus.
      void document.visibilityState
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onAppInstalled)
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)
    window.addEventListener("online", onNetworkState)
    window.addEventListener("offline", onNetworkState)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onAppInstalled)
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
      window.removeEventListener("online", onNetworkState)
      window.removeEventListener("offline", onNetworkState)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return null
}
