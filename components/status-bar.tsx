"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CONTENT_TYPE_CONFIG } from "@/lib/content-types"
import type { TextBlock } from "@/components/tile-card"
import { AboutPanel } from "@/components/about-panel"

import { Menu, LayoutList, Sparkles, FlaskConical } from "lucide-react"
import { PwaInstallButton } from "@/components/pwa-install-button"

interface StatusBarProps {
  blockCount: number
  blocks: TextBlock[]
  activeProjectName: string
  isSidebarOpen: boolean
  isIndexOpen: boolean
  isGhostPanelOpen: boolean
  isResearchPanelOpen?: boolean
  ghostNoteCount: number
  onMenuClick: () => void
  onIndexToggle: () => void
  onGhostPanelToggle: () => void
  onResearchPanelToggle?: () => void
  modelLabel?: string
  showHelpTooltip?: boolean
  onHelpTooltipDismiss?: () => void
  compact?: boolean
}

export function StatusBar({
  blockCount,
  blocks,
  activeProjectName,
  isSidebarOpen,
  isIndexOpen,
  isGhostPanelOpen,
  isResearchPanelOpen,
  ghostNoteCount,
  onMenuClick,
  onIndexToggle,
  onGhostPanelToggle,
  onResearchPanelToggle,
  modelLabel,
  showHelpTooltip,
  onHelpTooltipDismiss,
  compact,
}: StatusBarProps) {
  const [time, setTime] = useState("")
  const [isAboutOpen, setIsAboutOpen] = useState(false)

  const activity = useMemo(() => {
    return {
      enriching: blocks.filter(b => b.isEnriching).length,
      errors: blocks.filter(b => b.isError).length
    }
  }, [blocks])

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      )
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    blocks.forEach((b) => {
      counts[b.contentType] = (counts[b.contentType] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
  }, [blocks])

  return (
    <header className="z-header relative flex min-h-10 flex-wrap items-center justify-between gap-1.5 sm:gap-2 border-b border-border bg-card/80 px-2 sm:px-3 py-1.5 sm:py-2 backdrop-blur-md shrink-0 lg:h-10 lg:flex-nowrap lg:py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <button 
          onClick={onMenuClick}
          className={`touch-target p-1.5 rounded-sm transition-all duration-200 ${
            isSidebarOpen 
              ? "bg-primary/20 text-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]" 
              : "hover:bg-secondary text-muted-foreground/50 hover:text-foreground"
          }`}
        >
          <Menu className="h-4 w-4" />
        </button>
        
        <div className="flex min-w-0 items-center gap-2.5 ml-1">
          <div className="flex items-center gap-0.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
            <span className="inline-block h-2 w-2 rounded-sm bg-primary/60" />
            <span className="inline-block h-2 w-2 rounded-sm bg-primary/30" />
          </div>
          <h1 className="font-mono text-xs font-bold text-foreground tracking-tight select-none">
            nodepad
          </h1>
          {activeProjectName && (
            <div className="hidden min-w-0 items-center gap-2 ml-1 sm:flex">
              <span className="text-muted-foreground/20 font-mono text-[10px]">/</span>
              <span className="max-w-[8rem] truncate font-mono text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em]">{activeProjectName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap justify-end">
        {blockCount > 0 && compact && (
          <span className="font-mono text-[9px] text-muted-foreground/50 font-bold uppercase tracking-wider lg:hidden">
            {blockCount} {blockCount === 1 ? "node" : "nodes"}
          </span>
        )}
        {blockCount > 0 && (
          <div className="hidden items-center gap-4 lg:flex">
            <span className="font-mono text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">
              {blockCount} {blockCount === 1 ? 'node' : 'nodes'}
            </span>
            
            {activity.enriching > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20">
                <span className="h-1 w-1 animate-pulse rounded-full bg-primary" />
                <span className="font-mono text-[10px] text-primary">
                  {activity.enriching} {blocks.length > activity.enriching ? "contextualizing..." : "processing..."}
                </span>
              </div>
            )}

            {activity.errors > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-destructive/10">
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                <span className="font-mono text-[10px] text-destructive font-bold">
                  {activity.errors} failed
                </span>
              </div>
            )}

            {typeCounts.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/20 italic">{"//"}</span>
                <div className="flex items-center gap-3">
                  {typeCounts.map(([type, count]) => {
                    const config =
                      CONTENT_TYPE_CONFIG[
                        type as keyof typeof CONTENT_TYPE_CONFIG
                      ]
                    return (
                      <span
                        key={type}
                        className="font-mono text-[9px] font-bold uppercase tracking-tighter"
                        style={{ color: config.accentVar }}
                      >
                        {count} {config.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2 border-l border-border/40 pl-1.5 sm:pl-4 ml-0.5 sm:ml-4">
          <PwaInstallButton />
          {modelLabel && (
            <span className="hidden font-mono text-[9px] text-muted-foreground/60 uppercase tracking-wider px-1.5 lg:inline-flex">
              {modelLabel}
            </span>
          )}
          <span className="hidden lg:inline font-mono text-[10px] text-muted-foreground tabular-nums" suppressHydrationWarning>
            {time}
          </span>
          {/* Ghost panel toggle with badge */}
          {onResearchPanelToggle && (
            <button
              onClick={onResearchPanelToggle}
              className={`touch-target p-1.5 rounded-sm transition-all duration-200 ${
                isResearchPanelOpen
                  ? "bg-primary/20 text-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                  : "hover:bg-secondary text-muted-foreground/50 hover:text-foreground"
              }`}
              title="Research toolkit (PDF, Excel, finance, citations)"
            >
              <FlaskConical className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onGhostPanelToggle}
            className={`touch-target relative p-1.5 rounded-sm transition-all duration-200 ${
              isGhostPanelOpen
                ? "bg-primary/20 text-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                : "hover:bg-secondary text-muted-foreground/50 hover:text-foreground"
            }`}
            title="Synthesis Panel"
          >
            <Sparkles className="h-4 w-4" />
            {ghostNoteCount > 0 && !isGhostPanelOpen && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary font-mono text-[7px] font-black text-primary-foreground">
                {ghostNoteCount}
              </span>
            )}
          </button>
          <button
            onClick={onIndexToggle}
            className={`touch-target p-1.5 rounded-sm transition-all duration-200 ${
              isIndexOpen
                ? "bg-primary/20 text-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
                : "hover:bg-secondary text-muted-foreground/50 hover:text-foreground"
            }`}
            title="Workspace Index"
          >
            <LayoutList className="h-4 w-4" />
          </button>

          <span className="w-px h-4 bg-border/60 mx-0.5" />

          <div className="relative">
            <button
              onClick={() => {
                setIsAboutOpen(true)
                onHelpTooltipDismiss?.()
              }}
              className="touch-target p-1.5 rounded-sm transition-all duration-200 hover:bg-secondary text-muted-foreground/40 hover:text-foreground"
              title="About nodepad"
            >
              <span className="font-mono text-[11px] font-black leading-none">?</span>
            </button>

            {/* Help tooltip — shown after intro modal is dismissed */}
            <AnimatePresence>
              {showHelpTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-2.5 z-[300] w-48 rounded-sm bg-primary text-primary-foreground shadow-lg pointer-events-none select-none"
                >
                  {/* Arrow pointing up toward the ? button */}
                  <div className="absolute -top-1.5 right-2.5 w-3 h-3 rotate-45 bg-primary rounded-[2px]" />
                  <div className="relative px-3 py-2.5">
                    <p className="text-[11px] font-medium leading-snug">
                      Find help and quick-start tips here anytime
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AboutPanel open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </header>
  )
}

