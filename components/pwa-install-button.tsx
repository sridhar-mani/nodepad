"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"
import {
  canShowInstallUi,
  getDeferredInstallPrompt,
  isAppInstalled,
  isIosDevice,
  triggerInstallPrompt,
} from "@/lib/pwa/install"
import { cn } from "@/lib/utils"

interface PwaInstallButtonProps {
  variant?: "bar" | "pill"
  className?: string
}

export function PwaInstallButton({ variant = "bar", className }: PwaInstallButtonProps) {
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)
  const [iosHelpOpen, setIosHelpOpen] = useState(false)
  const [installing, setInstalling] = useState(false)

  const refresh = useCallback(() => {
    if (isAppInstalled()) {
      setVisible(false)
      return
    }
    setIos(isIosDevice())
    setVisible(canShowInstallUi())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener("nodepad-install-ready", refresh)
    window.addEventListener("appinstalled", refresh)
    return () => {
      window.removeEventListener("nodepad-install-ready", refresh)
      window.removeEventListener("appinstalled", refresh)
    }
  }, [refresh])

  const onInstallClick = async () => {
    if (ios && !getDeferredInstallPrompt()) {
      setIosHelpOpen(true)
      return
    }
    setInstalling(true)
    try {
      const result = await triggerInstallPrompt()
      if (result === "accepted") setVisible(false)
      if (result === "unavailable" && ios) setIosHelpOpen(true)
    } finally {
      setInstalling(false)
      refresh()
    }
  }

  if (!visible) return null

  const btnClass =
    variant === "pill"
      ? "touch-target flex w-full items-center justify-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-primary/25 transition-colors"
      : "touch-target flex items-center gap-1.5 rounded-sm bg-primary/15 border border-primary/25 px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-primary/25 transition-colors shrink-0"

  return (
    <>
      <button
        type="button"
        onClick={onInstallClick}
        disabled={installing}
        className={cn(btnClass, className)}
        title="Install nodepad as an app"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{ios && !getDeferredInstallPrompt() ? "Add app" : "Install"}</span>
      </button>

      {iosHelpOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-background/60 backdrop-blur-sm"
          role="dialog"
          aria-label="Install on iPhone or iPad"
          onClick={() => setIosHelpOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-md border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-mono text-xs font-bold text-foreground">Add to Home Screen</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-1 leading-relaxed">
                  Safari does not show an Install button. Use Share → Add to Home Screen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIosHelpOpen(false)}
                className="touch-target p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-2 font-mono text-[10px] text-muted-foreground leading-relaxed list-decimal list-inside">
              <li>Tap the <Share className="inline h-3 w-3 mx-0.5" /> Share button in Safari</li>
              <li>Scroll and choose <strong className="text-foreground">Add to Home Screen</strong></li>
              <li>Tap <strong className="text-foreground">Add</strong></li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
