"use client"

import { useEffect, useState } from "react"

/** Desktop installed PWA title-bar region (Window Controls Overlay API). */
export function WindowControlsOverlay() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const nav = navigator as Navigator & {
      windowControlsOverlay?: {
        visible: boolean
        addEventListener?: (e: string, fn: () => void) => void
        removeEventListener?: (e: string, fn: () => void) => void
      }
    }
    if (!nav.windowControlsOverlay) return
    setVisible(nav.windowControlsOverlay.visible)
    const onChange = () => setVisible(nav.windowControlsOverlay?.visible ?? false)
    nav.windowControlsOverlay.addEventListener?.("geometrychange", onChange)
    return () => nav.windowControlsOverlay?.removeEventListener?.("geometrychange", onChange)
  }, [])

  if (!visible) return null

  return (
    <div
      id="wco-titlebar"
      className="fixed top-0 left-0 z-[300] flex h-[var(--titlebar-area-height,32px)] items-center gap-3 bg-card/90 backdrop-blur-md border-b border-border"
      style={{
        width: "var(--titlebar-area-width, 100%)",
        paddingLeft: "var(--titlebar-area-x, 0)",
        paddingRight: "env(titlebar-area-width, 0)",
      }}
    >
      <span className="font-mono text-[10px] font-black uppercase tracking-widest text-foreground/70 pl-2">
        nodepad
      </span>
      <span className="font-mono text-[9px] text-muted-foreground/50 hidden sm:inline">
        spatial research · installed app
      </span>
    </div>
  )
}
