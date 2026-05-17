"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

interface IntroModalProps {
  open: boolean
  onClose: () => void
}

const STEPS = [
  { title: "Capture", body: "Type a thought, question, or paste a URL in the bar at the bottom. No prompts required." },
  { title: "Enrich", body: "Each note is classified and annotated in context with your canvas and uploaded knowledge." },
  { title: "Connect", body: "Switch to Graph view to see note links and knowledge-base connections." },
  { title: "Synthesize", body: "After a few notes, emergent theses appear in the Synthesis panel (sparkle icon)." },
]

export function IntroModal({ open, onClose }: IntroModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="surface-modal relative w-full max-w-lg rounded-sm shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-0.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/60" />
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/30" />
                  </div>
                  <span className="font-mono text-sm font-black text-foreground tracking-tight">nodepad</span>
                </div>
                <p className="text-xs text-muted-foreground/60 font-mono uppercase tracking-widest">
                  Quick start
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pb-4 space-y-4">
              {STEPS.map((step, i) => (
                <div key={step.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 font-mono text-[10px] font-black text-primary">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-xs text-muted-foreground/40">
                Open <span className="font-mono font-black text-muted-foreground/60">?</span> anytime for full help
              </p>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-mono font-medium rounded-sm bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
              >
                Get started →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
