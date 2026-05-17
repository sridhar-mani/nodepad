"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

const DISMISS_KEY = "nodepad-ai-banner-dismissed"

interface AiKeyBannerProps {
  providerLabel: string
  keyUrl?: string
  onOpenSettings: () => void
}

export function AiKeyBanner({ providerLabel, keyUrl, onOpenSettings }: AiKeyBannerProps) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  if (dismissed) return null

  return (
    <div className="shrink-0 border-b border-amber-800/50 bg-amber-950/90 text-amber-100">
      <div className="flex items-start gap-2 px-2.5 py-2 sm:px-4 sm:py-2.5 max-w-3xl mx-auto">
        <p className="flex-1 font-mono text-[10px] sm:text-xs leading-relaxed min-w-0">
          <span className="opacity-90">AI needs a </span>
          <strong>{providerLabel}</strong>
          <span className="opacity-90"> key — </span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-amber-200 underline underline-offset-2 font-semibold"
          >
            Settings
          </button>
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded bg-amber-700/70 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wide hover:bg-amber-600/80"
          >
            Add key
          </button>
          {keyUrl && (
            <a
              href={keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline font-mono text-[9px] opacity-70 hover:opacity-100 underline"
            >
              Get key
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem(DISMISS_KEY, "1")
              } catch {
                /* ignore */
              }
              setDismissed(true)
            }}
            className="touch-target p-1 text-amber-200/50 hover:text-amber-100"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
