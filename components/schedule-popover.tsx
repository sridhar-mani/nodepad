"use client"

import { useState } from "react"
import { AlarmClock, Bell, Timer, X } from "lucide-react"
import { formatDueLabel, formatTimerRemaining, parseDurationMs, type SchedulePatch } from "@/lib/scheduling"

interface SchedulePopoverProps {
  dueAt?: number
  reminderAt?: number
  timerEndsAt?: number
  onSave: (patch: SchedulePatch) => void
  onClose: () => void
}

export function SchedulePopover({
  dueAt,
  reminderAt,
  timerEndsAt,
  onSave,
  onClose,
}: SchedulePopoverProps) {
  const [dueLocal, setDueLocal] = useState(() =>
    dueAt ? new Date(dueAt).toISOString().slice(0, 16) : "",
  )
  const [remindMin, setRemindMin] = useState("15")
  const [timerInput, setTimerInput] = useState("25m")

  const applyDue = () => {
    if (!dueLocal) {
      onSave({ dueAt: null, reminderAt: null })
      onClose()
      return
    }
    const due = new Date(dueLocal).getTime()
    const mins = Number(remindMin) || 15
    onSave({
      dueAt: due,
      reminderAt: due - mins * 60_000,
    })
    onClose()
  }

  const startTimer = () => {
    const ms = parseDurationMs(timerInput)
    if (!ms) return
    onSave({ timerEndsAt: Date.now() + ms })
    onClose()
  }

  const clearAll = () => {
    onSave({ dueAt: null, reminderAt: null, timerEndsAt: null })
    onClose()
  }

  return (
    <div
      className="absolute right-0 top-full z-[120] mt-1 w-64 rounded-md border border-border bg-popover p-3 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          Schedule
        </span>
        <button type="button" onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      </div>

      <label className="flex flex-col gap-1 mb-2">
        <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <AlarmClock className="h-3 w-3" /> Deadline
        </span>
        <input
          type="datetime-local"
          value={dueLocal}
          onChange={(e) => setDueLocal(e.target.value)}
          className="rounded border border-border bg-input px-2 py-1 font-mono text-[10px] text-foreground"
        />
      </label>

      <label className="flex flex-col gap-1 mb-2">
        <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Bell className="h-3 w-3" /> Remind before (min)
        </span>
        <input
          type="number"
          min={0}
          value={remindMin}
          onChange={(e) => setRemindMin(e.target.value)}
          className="rounded border border-border bg-input px-2 py-1 font-mono text-[10px] text-foreground w-20"
        />
      </label>

      <label className="flex flex-col gap-1 mb-3">
        <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Timer className="h-3 w-3" /> Focus timer
        </span>
        <div className="flex gap-1">
          <input
            type="text"
            value={timerInput}
            onChange={(e) => setTimerInput(e.target.value)}
            placeholder="25m"
            className="flex-1 rounded border border-border bg-input px-2 py-1 font-mono text-[10px] text-foreground"
          />
          <button
            type="button"
            onClick={startTimer}
            className="rounded bg-primary/15 px-2 py-1 font-mono text-[9px] font-bold text-primary hover:bg-primary/25"
          >
            Start
          </button>
        </div>
      </label>

      {(dueAt || timerEndsAt) && (
        <p className="text-[10px] text-muted-foreground mb-2 leading-snug">
          {dueAt ? formatDueLabel(dueAt) : null}
          {dueAt && timerEndsAt ? " · " : null}
          {timerEndsAt ? `Timer: ${formatTimerRemaining(timerEndsAt)}` : null}
          {reminderAt ? ` · Reminder set` : null}
        </p>
      )}

      <div className="flex gap-1">
        <button
          type="button"
          onClick={applyDue}
          className="flex-1 rounded bg-primary py-1 font-mono text-[9px] font-bold text-primary-foreground"
        >
          Save deadline
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded border border-border px-2 py-1 font-mono text-[9px] text-muted-foreground hover:bg-secondary"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
