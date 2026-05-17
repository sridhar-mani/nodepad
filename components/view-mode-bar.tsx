"use client"

import { Grid, GitFork, Trello } from "lucide-react"
import { cn } from "@/lib/utils"

export type ViewMode = "tiling" | "kanban" | "graph"

const MODES: { id: ViewMode; label: string; short: string; icon: typeof Grid }[] = [
  { id: "tiling", label: "Tiling", short: "Tiles", icon: Grid },
  { id: "kanban", label: "Kanban", short: "Board", icon: Trello },
  { id: "graph", label: "Graph", short: "Graph", icon: GitFork },
]

interface ViewModeBarProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  className?: string
}

/** Thumb-friendly view switcher for phone and tablet (hidden on desktop). */
export function ViewModeBar({ value, onChange, className }: ViewModeBarProps) {
  return (
    <nav
      aria-label="Workspace view"
      className={cn(
        "shrink-0 border-t border-border bg-card/95 backdrop-blur-md px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden",
        className,
      )}
    >
      <div className="mx-auto flex max-w-md gap-1 rounded-md bg-secondary/40 p-1">
        {MODES.map(({ id, label, short, icon: Icon }) => {
          const active = value === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "touch-target flex flex-1 flex-col items-center justify-center gap-0.5 rounded-sm px-2 py-2 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors",
                active
                  ? "bg-primary/15 text-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
              aria-pressed={active}
            >
              <Icon className="h-4 w-4" />
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
