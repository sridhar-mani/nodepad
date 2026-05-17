"use client"

import { useEffect } from "react"
import type { TextBlock } from "@/components/tile-card"
import { collectDueReminders } from "@/lib/scheduling"
import { fireDueReminder, getNotificationSupport, loadNotificationPrefs } from "@/lib/notifications"

interface ReminderEngineProps {
  projects: Array<{ id: string; name: string; blocks: TextBlock[] }>
}

export function ReminderEngine({ projects }: ReminderEngineProps) {
  useEffect(() => {
    const tick = () => {
      const prefs = loadNotificationPrefs()
      if (!prefs.enabled || getNotificationSupport() !== "granted") return
      const due = collectDueReminders(projects)
      due.forEach((r) => {
        void fireDueReminder(r)
      })
    }

    tick()
    const id = window.setInterval(tick, 30_000)
    const onVis = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [projects])

  return null
}
