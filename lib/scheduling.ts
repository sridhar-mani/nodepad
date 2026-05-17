import type { TextBlock } from "@/components/tile-card"

export interface SubTaskSchedule {
  id: string
  text: string
  isDone: boolean
  timestamp: number
  dueAt?: number
  reminderAt?: number
  timerEndsAt?: number
}

export type SchedulePatch = {
  dueAt?: number | null
  reminderAt?: number | null
  timerEndsAt?: number | null
}

export function applySchedulePatch<T extends SchedulePatch>(
  item: T,
  patch: SchedulePatch,
): T {
  const next = { ...item }
  if (patch.dueAt !== undefined) next.dueAt = patch.dueAt ?? undefined
  if (patch.reminderAt !== undefined) next.reminderAt = patch.reminderAt ?? undefined
  if (patch.timerEndsAt !== undefined) next.timerEndsAt = patch.timerEndsAt ?? undefined
  return next
}

export interface DueReminder {
  id: string
  projectId: string
  projectName: string
  blockId: string
  label: string
  fireAt: number
  kind: "due" | "reminder" | "timer"
}

const FIRED_KEY = "nodepad-fired-reminders"

function firedSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function persistFired(ids: Set<string>) {
  try {
    const arr = [...ids].slice(-200)
    sessionStorage.setItem(FIRED_KEY, JSON.stringify(arr))
  } catch {
    /* ignore */
  }
}

export function markReminderFired(reminderId: string) {
  const s = firedSet()
  s.add(reminderId)
  persistFired(s)
}

export function wasReminderFired(reminderId: string): boolean {
  return firedSet().has(reminderId)
}

export function formatDueLabel(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  const diff = ts - now
  if (diff < 0) return `Overdue · ${d.toLocaleString()}`
  if (diff < 60_000) return "Due in <1 min"
  if (diff < 3_600_000) return `Due in ${Math.round(diff / 60_000)} min`
  if (diff < 86_400_000) return `Due in ${Math.round(diff / 3_600_000)} hr`
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function formatTimerRemaining(endsAt: number): string {
  const diff = endsAt - Date.now()
  if (diff <= 0) return "Timer done"
  const m = Math.floor(diff / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`
}

/** Parse shorthand: 30m, 2h, 1d */
export function parseDurationMs(input: string): number | null {
  const m = input.trim().match(/^(\d+(?:\.\d+)?)\s*(m|min|h|hr|d|day)s?$/i)
  if (!m) return null
  const n = Number(m[1])
  const u = m[2].toLowerCase()
  if (u.startsWith("m")) return n * 60_000
  if (u.startsWith("h")) return n * 3_600_000
  if (u.startsWith("d")) return n * 86_400_000
  return null
}

export function collectDueReminders(
  projects: Array<{ id: string; name: string; blocks: TextBlock[] }>,
  now = Date.now(),
  windowMs = 60_000,
): DueReminder[] {
  const out: DueReminder[] = []

  for (const project of projects) {
    for (const block of project.blocks) {
      const baseLabel = block.text.slice(0, 80) || "Task"

      const check = (
        fireAt: number | undefined,
        kind: DueReminder["kind"],
        suffix: string,
      ) => {
        if (fireAt == null || fireAt > now + windowMs) return
        if (fireAt < now - windowMs * 5) return
        const id = `${project.id}:${block.id}:${kind}:${fireAt}`
        if (wasReminderFired(id)) return
        out.push({
          id,
          projectId: project.id,
          projectName: project.name,
          blockId: block.id,
          label: `${baseLabel}${suffix}`,
          fireAt,
          kind,
        })
      }

      if (block.contentType === "task") {
        check(block.reminderAt, "reminder", " (reminder)")
        check(block.dueAt, "due", " (due)")
        check(block.timerEndsAt, "timer", " (timer)")
        for (const st of block.subTasks ?? []) {
          const sub = st as SubTaskSchedule
          check(sub.reminderAt, "reminder", ` → ${sub.text.slice(0, 40)}`)
          check(sub.dueAt, "due", ` → ${sub.text.slice(0, 40)}`)
          check(sub.timerEndsAt, "timer", ` → ${sub.text.slice(0, 40)}`)
        }
      } else {
        check(block.reminderAt, "reminder", " (reminder)")
        check(block.dueAt, "due", " (due)")
        check(block.timerEndsAt, "timer", " (timer)")
      }
    }
  }

  return out.sort((a, b) => a.fireAt - b.fireAt)
}
