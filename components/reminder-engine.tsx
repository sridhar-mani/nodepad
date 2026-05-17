"use client"

import { useEffect } from "react"
import type { TextBlock } from "@/components/tile-card"
import { collectDueReminders } from "@/lib/scheduling"
import { fireDueReminder, getNotificationSupport, loadNotificationPrefs } from "@/lib/notifications"
import { usePerformanceProfile } from "@/lib/use-performance-profile"

interface ReminderEngineProps {
  projects: Array<{ id: string; name: string; blocks: TextBlock[] }>
}

export function ReminderEngine({ projects }: ReminderEngineProps) {
  const perf = usePerformanceProfile()

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return
      const prefs = loadNotificationPrefs()
      if (!prefs.enabled || getNotificationSupport() !== "granted") return
      const due = collectDueReminders(projects)
      due.forEach((r) => {
        void fireDueReminder(r)
      })
    }

    tick()
    const id = window.setInterval(tick, perf.reminderIntervalMs)
    const onVis = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [projects, perf.reminderIntervalMs])

  return null
}
