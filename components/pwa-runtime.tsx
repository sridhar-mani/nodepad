"use client"

import { useEffect } from "react"
import type { TextBlock } from "@/components/tile-card"
import { updateAppBadge } from "@/lib/pwa/badge"
import { drainShareQueue, sharePayloadToNoteText } from "@/lib/pwa/share"
import { writeWorkspaceToOpfs } from "@/lib/pwa/opfs"
import { pushWorkspaceToEdge, registerBackgroundSync } from "@/lib/pwa/edge-sync"
import { collectDueReminders } from "@/lib/scheduling"

interface PwaRuntimeProps {
  projects: Array<{ id: string; name: string; blocks: TextBlock[] }>
  isLoaded: boolean
  onShortcut?: (action: string) => void
  onShareNote?: (text: string) => void
}

export function PwaRuntime({ projects, isLoaded, onShortcut, onShareNote }: PwaRuntimeProps) {
  useEffect(() => {
    if (!isLoaded) return
    const params = new URLSearchParams(window.location.search)
    const shortcut = params.get("shortcut")
    const view = params.get("view")
    if (shortcut && onShortcut) onShortcut(shortcut)
    if (view && onShortcut) onShortcut(`view-${view}`)
    if (shortcut || view) {
      const url = new URL(window.location.href)
      url.searchParams.delete("shortcut")
      url.searchParams.delete("view")
      url.searchParams.delete("from")
      window.history.replaceState({}, "", url.pathname + url.hash)
    }
  }, [isLoaded, onShortcut])

  useEffect(() => {
    if (!isLoaded || !onShareNote) return
    const queued = drainShareQueue()
    for (const payload of queued) {
      const text = sharePayloadToNoteText(payload)
      if (text) onShareNote(text)
    }
    const onQueue = () => {
      for (const payload of drainShareQueue()) {
        const text = sharePayloadToNoteText(payload)
        if (text) onShareNote(text)
      }
    }
    window.addEventListener("nodepad-share-queue", onQueue)
    return () => window.removeEventListener("nodepad-share-queue", onQueue)
  }, [isLoaded, onShareNote])

  useEffect(() => {
    if (!isLoaded) return
    const pendingTasks = projects.reduce((n, p) => {
      return (
        n +
        p.blocks.filter((b) => b.contentType === "task" && !b.isEnriching).length +
        collectDueReminders([p]).length
      )
    }, 0)
    void updateAppBadge(pendingTasks)
  }, [projects, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    const snapshot = { projects, ts: Date.now() }
    void writeWorkspaceToOpfs(snapshot)
    void pushWorkspaceToEdge(snapshot)
    void registerBackgroundSync()
  }, [projects, isLoaded])

  return null
}
