"use client"

import { markReminderFired, type DueReminder } from "@/lib/scheduling"

export type NotificationPermissionState = NotificationPermission | "unsupported"

export function getNotificationSupport(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (getNotificationSupport() === "unsupported") return "unsupported"
  const result = await Notification.requestPermission()
  return result
}

async function showViaServiceWorker(title: string, body: string, tag: string, url: string) {
  if (!("serviceWorker" in navigator)) return false
  const reg = await navigator.serviceWorker.ready
  await reg.showNotification(title, {
    body,
    tag,
    icon: "/nodepad.jpg",
    badge: "/icon.svg",
    data: { url },
    requireInteraction: false,
  })
  return true
}

export async function showLocalNotification(
  title: string,
  body: string,
  options?: { tag?: string; url?: string },
): Promise<boolean> {
  if (getNotificationSupport() !== "granted") return false

  const tag = options?.tag ?? `nodepad-${Date.now()}`
  const url = options?.url ?? "/"

  try {
    const viaSw = await showViaServiceWorker(title, body, tag, url)
    if (viaSw) return true
  } catch {
    /* fall through */
  }

  try {
    new Notification(title, { body, tag, icon: "/nodepad.jpg" })
    return true
  } catch {
    return false
  }
}

export async function fireDueReminder(reminder: DueReminder): Promise<void> {
  const title =
    reminder.kind === "timer"
      ? "Timer finished"
      : reminder.kind === "reminder"
        ? "Reminder"
        : "Due now"
  const body = `${reminder.projectName}: ${reminder.label}`
  const ok = await showLocalNotification(title, body, {
    tag: reminder.id,
    url: `/?project=${reminder.projectId}&block=${reminder.blockId}`,
  })
  if (ok) markReminderFired(reminder.id)
}

export function loadNotificationPrefs(): { enabled: boolean; remindBeforeMin: number } {
  try {
    const raw = localStorage.getItem("nodepad-notification-prefs")
    if (!raw) return { enabled: true, remindBeforeMin: 15 }
    return JSON.parse(raw) as { enabled: boolean; remindBeforeMin: number }
  } catch {
    return { enabled: true, remindBeforeMin: 15 }
  }
}

export function saveNotificationPrefs(prefs: { enabled: boolean; remindBeforeMin: number }) {
  try {
    localStorage.setItem("nodepad-notification-prefs", JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}
