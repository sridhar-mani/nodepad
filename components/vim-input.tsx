"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Trello, Grid, Trash2, Clipboard, Download,
  FolderOpen, FolderPlus, BookOpen, Sparkles,
  FolderDown, FolderInput, GitFork, Mic, MicOff, ImagePlus, FileText
} from "lucide-react"
import { Command } from "cmdk"
import { useModKey } from "@/lib/utils"

async function imageFileToOptimizedDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error("Could not load image"))
      i.src = objectUrl
    })

    const maxDim = 1400
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not available")

    ctx.drawImage(img, 0, 0, w, h)

    // First pass: visually lossless JPEG for photos and most screenshots.
    let out = canvas.toDataURL("image/jpeg", 0.86)

    // Second pass if still large (roughly >1.6MB as a data URL string).
    if (out.length > 1_600_000) {
      out = canvas.toDataURL("image/jpeg", 0.72)
    }

    return out
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

const ACTION_ITEMS = [
  { id: "export-nodepad", icon: FolderDown,  label: "Export",  sub: ".nodepad"  },
  { id: "import-nodepad", icon: FolderInput, label: "Import",  sub: ".nodepad"  },
  { id: "export-md",      icon: Download,    label: "Export",  sub: "markdown"  },
  { id: "copy-md",        icon: Clipboard,   label: "Copy",    sub: "markdown"  },
  { id: "clear",          icon: Trash2,      label: "Clear",   sub: "canvas"    },
]

// ─── Props ───────────────────────────────────────────────────────────────────

interface VimInputProps {
  onSubmit: (text: string) => void
  onSubmitReferenceImage: (imageDataUrl: string, fileName: string) => void
  onSubmitKnowledgeFiles: (files: File[]) => void
  onCommand: (cmd: string, text?: string) => void
  isCommandKOpen: boolean
  setIsCommandKOpen: (open: boolean) => void
  compact?: boolean
  /** When a drawer/backdrop is open on mobile — sink chrome below panels */
  overlayOpen?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VimInput({ onSubmit, onSubmitReferenceImage, onSubmitKnowledgeFiles, onCommand, isCommandKOpen, setIsCommandKOpen, compact, overlayOpen }: VimInputProps) {
  const [value, setValue] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [focusedIdx, setFocusedIdx] = React.useState(0)
  const [isListening, setIsListening] = React.useState(false)
  const [speechSupported, setSpeechSupported] = React.useState(false)
  const mod = useModKey()

  const mainInputRef = React.useRef<HTMLInputElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const imageInputRef = React.useRef<HTMLInputElement>(null)
  const knowledgeInputRef = React.useRef<HTMLInputElement>(null)
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  const recognitionRef = React.useRef<unknown>(null)

  // ── Items (mod-key aware) ───────────────────────────────────────────────

  const VIEW_ITEMS = React.useMemo(() => [
    { id: "tiling", icon: Grid,    label: "Tiling", sub: "" },
    { id: "kanban", icon: Trello,  label: "Kanban", sub: "" },
    { id: "graph",  icon: GitFork, label: "Graph",  sub: "" },
  ], [])

  const NAV_ITEMS = React.useMemo(() => [
    { id: "open-projects",  icon: FolderOpen, label: "Projects",    sub: "" },
    { id: "new-project",    icon: FolderPlus, label: "New Project", sub: "" },
    { id: "open-index",     icon: BookOpen,   label: "Index",       sub: "" },
    { id: "open-synthesis", icon: Sparkles,   label: "Synthesis",   sub: "" },
    { id: "open-research",  icon: BookOpen,   label: "Research",    sub: "toolkit" },
  ], [])

  // ── Filtered items ──────────────────────────────────────────────────────

  const q = search.toLowerCase()
  const viewItems   = q ? VIEW_ITEMS.filter(i => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q))   : VIEW_ITEMS
  const navItems    = q ? NAV_ITEMS.filter(i  => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q))    : NAV_ITEMS
  const actionItems = q ? ACTION_ITEMS.filter(i => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q)) : ACTION_ITEMS

  const viewCount   = viewItems.length
  const navCount    = navItems.length
  const actionCount = actionItems.length
  const totalItems  = viewCount + navCount + actionCount

  // Section boundaries for keyboard nav
  // Section 0: views   [0 .. viewCount)
  // Section 1: nav     [viewCount .. viewCount+navCount)
  // Section 2: actions [viewCount+navCount .. total)
  const sections = React.useMemo(() => [
    { start: 0,                    count: viewCount,   cols: 3 },
    { start: viewCount,            count: navCount,    cols: 4 },
    { start: viewCount + navCount, count: actionCount, cols: 5 },
  ], [viewCount, navCount, actionCount])

  const getSectionForIdx = React.useCallback((idx: number) => {
    return sections.find(s => idx >= s.start && idx < s.start + s.count) ?? sections[0]
  }, [sections])

  // ── Lifecycle ───────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (isCommandKOpen) {
      setSearch("")
      setFocusedIdx(0)
      requestAnimationFrame(() => searchInputRef.current?.focus())
    }
  }, [isCommandKOpen])

  React.useEffect(() => { setFocusedIdx(0) }, [search])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) return

    setSpeechSupported(true)
    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event: any) => {
      let finalTranscript = ""
      for (let i = (event as any).resultIndex; i < (event as any).results.length; i += 1) {
        const result = (event as any).results[i]
        if (result.isFinal) finalTranscript += result[0].transcript
      }
      if (finalTranscript.trim()) {
        setValue(prev => `${prev}${prev ? " " : ""}${finalTranscript.trim()}`)
      }
    }

    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition

    return () => {
      try { recognition.stop() } catch { /* no-op */ }
      recognitionRef.current = null
    }
  }, [])

  // Scroll focused item into view
  React.useEffect(() => {
    itemRefs.current[focusedIdx]?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [focusedIdx])

  // ── Helpers ─────────────────────────────────────────────────────────────

  const close = React.useCallback(() => {
    setIsCommandKOpen(false)
    requestAnimationFrame(() => mainInputRef.current?.focus())
  }, [setIsCommandKOpen])

  const handleSelect = React.useCallback((cmd: string) => {
    onCommand(cmd, value)
    setSearch("")
    close()
  }, [onCommand, value, close])

  const submitValue = React.useCallback((raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (trimmed.startsWith(":")) {
      const body = trimmed.slice(1).trim()
      const [head, ...rest] = body.split(/\s+/)
      const cmd = head.toLowerCase()
      const arg = rest.join(" ").trim()
      if (cmd === "research") {
        onCommand("open-research")
        return
      }
      if (cmd === "finance" && arg) {
        onCommand("finance", arg)
        return
      }
      if (cmd === "cite" && arg) {
        onCommand("cite", arg)
        return
      }
    }
    onSubmit(trimmed)
  }, [onCommand, onSubmit])

  const toggleDictation = React.useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return

    if (isListening) {
      try { recognition.stop() } catch { /* no-op */ }
      setIsListening(false)
      return
    }

    try {
      recognition.start()
      setIsListening(true)
    } catch {
      setIsListening(false)
    }
  }, [isListening])

  const handleImagePick = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      e.target.value = ""
      return
    }

    imageFileToOptimizedDataUrl(file)
      .then(dataUrl => {
        if (!dataUrl.startsWith("data:image/")) return
        onSubmitReferenceImage(dataUrl, file.name)
      })
      .catch(() => {
        // Ignore file conversion failures; user can retry with a different image.
      })
    e.target.value = ""
  }, [onSubmitReferenceImage])

  const handleKnowledgePick = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onSubmitKnowledgeFiles(files)
    e.target.value = ""
  }, [onSubmitKnowledgeFiles])

  // ── Grid keyboard navigation ─────────────────────────────────────────────

  const getItemAtIdx = React.useCallback((idx: number): string | null => {
    if (idx < viewCount)                        return viewItems[idx]?.id ?? null
    if (idx < viewCount + navCount)             return navItems[idx - viewCount]?.id ?? null
    if (idx < viewCount + navCount + actionCount) return actionItems[idx - viewCount - navCount]?.id ?? null
    return null
  }, [viewCount, navCount, actionCount, viewItems, navItems, actionItems])

  const handlePopupKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (totalItems === 0) return
    const sec      = getSectionForIdx(focusedIdx)
    const localIdx = focusedIdx - sec.start
    const rowStart = sec.start + Math.floor(localIdx / sec.cols) * sec.cols
    const rowEnd   = Math.min(rowStart + sec.cols - 1, sec.start + sec.count - 1)

    switch (e.key) {
      case "Escape":
        e.preventDefault()
        close()
        break

      case "Enter": {
        e.preventDefault()
        const id = getItemAtIdx(focusedIdx)
        if (id) handleSelect(id)
        break
      }

      case "ArrowRight":
        e.preventDefault()
        setFocusedIdx(focusedIdx >= rowEnd ? rowStart : focusedIdx + 1)
        break

      case "ArrowLeft":
        e.preventDefault()
        setFocusedIdx(focusedIdx <= rowStart ? rowEnd : focusedIdx - 1)
        break

      case "ArrowDown": {
        e.preventDefault()
        const nextInSec = focusedIdx + sec.cols
        if (nextInSec < sec.start + sec.count) {
          setFocusedIdx(nextInSec)
        } else {
          // Move to first item of next section
          const nextSecStart = sec.start + sec.count
          if (nextSecStart < totalItems) {
            const col = localIdx % sec.cols
            const ns  = getSectionForIdx(nextSecStart)
            setFocusedIdx(Math.min(nextSecStart + col, nextSecStart + ns.count - 1))
          }
        }
        break
      }

      case "ArrowUp": {
        e.preventDefault()
        const prevInSec = focusedIdx - sec.cols
        if (prevInSec >= sec.start) {
          setFocusedIdx(prevInSec)
        } else if (sec.start > 0) {
          // Move to last row of previous section
          const prevSecEnd   = sec.start - 1
          const ps           = getSectionForIdx(prevSecEnd)
          const col          = localIdx % sec.cols
          const lastRowStart = ps.start + Math.floor((ps.count - 1) / ps.cols) * ps.cols
          setFocusedIdx(Math.min(lastRowStart + col, ps.start + ps.count - 1))
        }
        break
      }
    }
  }, [focusedIdx, totalItems, getSectionForIdx, getItemAtIdx, close, handleSelect])

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`w-full relative flex flex-col items-center ${compact ? "entry-bar-compact" : ""} ${overlayOpen ? "max-lg:select-none" : ""}`}>
      <Command
        className="w-full"
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim() && !isCommandKOpen) {
            submitValue(value)
            setValue("")
          }
          if (e.key === "Escape") setIsCommandKOpen(false)
        }}
      >
        {/* ── Command Popup ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {isCommandKOpen && !overlayOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="command-palette command-palette-root absolute bottom-full left-0 right-0 w-full backdrop-blur-3xl shadow-[0_-24px_60px_-12px_rgba(0,0,0,0.15)] max-h-[min(50vh,360px)] overflow-hidden"
              onKeyDown={handlePopupKeyDown}
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--surface-overlay-border)]">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] command-palette-muted select-none shrink-0">{mod}K</span>
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search commands…"
                  className="flex-1 bg-transparent font-mono text-xs text-[var(--surface-overlay-fg)] placeholder:text-[var(--surface-overlay-muted)] outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="command-palette-muted hover:text-[var(--surface-overlay-fg)] transition-colors text-[10px] font-mono"
                  >
                    clear
                  </button>
                )}
              </div>

              <div className="p-3 max-h-[360px] overflow-y-auto scrollbar-none space-y-3">

                {/* ── Views ──────────────────────────────────────────────── */}
                {viewItems.length > 0 && (
                  <div>
                    <p className="px-1 pb-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] command-palette-muted">Views</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {viewItems.map((item, i) => {
                        const focused = focusedIdx === i
                        return (
                          <button
                            key={item.id}
                            ref={el => { itemRefs.current[i] = el }}
                            onClick={() => handleSelect(item.id)}
                            onMouseEnter={() => setFocusedIdx(i)}
                            className={`command-palette-item group flex flex-col items-center justify-center gap-2 rounded-sm border py-4 px-2 transition-all duration-100 outline-none ${focused ? "bg-primary/12 border-primary/35 text-primary shadow-[0_0_0_1px_var(--primary)]" : ""}`}
                          >
                            <item.icon className={`h-[18px] w-[18px] transition-transform duration-100 ${focused ? "scale-110" : "group-hover:scale-105"}`} />
                            <div className="text-center leading-tight">
                              <div className="font-mono text-[10px] font-bold tracking-tight">{item.label}</div>
                              {item.sub && <div className={`font-mono text-[7px] uppercase tracking-[0.15em] mt-0.5 ${focused ? "text-primary/60" : "command-palette-muted"}`}>{item.sub}</div>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Navigate ───────────────────────────────────────────── */}
                {navItems.length > 0 && (
                  <div className="border-t border-[var(--surface-overlay-border)] pt-3">
                    <p className="px-1 pb-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] command-palette-muted">Navigate</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {navItems.map((item, i) => {
                        const idx     = viewCount + i
                        const focused = focusedIdx === idx
                        return (
                          <button
                            key={item.id}
                            ref={el => { itemRefs.current[idx] = el }}
                            onClick={() => handleSelect(item.id)}
                            onMouseEnter={() => setFocusedIdx(idx)}
                            className={`command-palette-item group flex flex-col items-center justify-center gap-2 rounded-sm border py-4 px-2 transition-all duration-100 outline-none ${focused ? "bg-primary/12 border-primary/35 text-primary shadow-[0_0_0_1px_var(--primary)]" : ""}`}
                          >
                            <item.icon className={`h-[18px] w-[18px] transition-transform duration-100 ${focused ? "scale-110" : "group-hover:scale-105"}`} />
                            <div className="text-center leading-tight">
                              <div className="font-mono text-[10px] font-bold tracking-tight">{item.label}</div>
                              {item.sub && <div className={`font-mono text-[7px] uppercase tracking-[0.15em] mt-0.5 ${focused ? "text-primary/60" : "command-palette-muted"}`}>{item.sub}</div>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Actions ────────────────────────────────────────────── */}
                {actionItems.length > 0 && (
                  <div className="border-t border-[var(--surface-overlay-border)] pt-3">
                    <p className="px-1 pb-2 font-mono text-[8px] font-bold uppercase tracking-[0.2em] command-palette-muted">Actions</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5">
                      {actionItems.map((item, i) => {
                        const idx     = viewCount + navCount + i
                        const focused = focusedIdx === idx
                        return (
                          <button
                            key={item.id}
                            ref={el => { itemRefs.current[idx] = el }}
                            onClick={() => handleSelect(item.id)}
                            onMouseEnter={() => setFocusedIdx(idx)}
                            className={`command-palette-item group flex flex-col items-center justify-center gap-2 rounded-sm border py-4 px-2 transition-all duration-100 outline-none ${focused ? "bg-primary/12 border-primary/35 text-primary shadow-[0_0_0_1px_var(--primary)]" : ""}`}
                          >
                            <item.icon className={`h-[18px] w-[18px] transition-transform duration-100 ${focused ? "scale-110" : "group-hover:scale-105"}`} />
                            <div className="text-center leading-tight">
                              <div className="font-mono text-[10px] font-bold tracking-tight">{item.label}</div>
                              <div className={`font-mono text-[7px] uppercase tracking-[0.15em] mt-0.5 ${focused ? "text-primary/60" : "command-palette-muted"}`}>{item.sub}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ── Empty state ────────────────────────────────────────── */}
                {totalItems === 0 && (
                  <div className="py-10 text-center font-mono text-[9px] uppercase tracking-[0.2em] command-palette-muted">
                    No commands match
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div className="flex items-center justify-end gap-4 px-5 py-2 border-t border-[var(--surface-overlay-border)]">
                {[
                  ["↑↓", "rows"],
                  ["←→", "tiles"],
                  ["↵",  "select"],
                  ["esc","close"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <kbd className="entry-bar-chip font-mono text-[9px] rounded px-1 py-0.5">{key}</kbd>
                    <span className="font-mono text-[8px] uppercase tracking-wider command-palette-muted">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Input Bar ─────────────────────────────────────────────── */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImagePick}
        />
        <input
          ref={knowledgeInputRef}
          type="file"
          accept=".txt,.md,.markdown,.csv,.json,.yaml,.yml,.pdf,.xlsx,.xls,text/plain,text/markdown,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          className="hidden"
          onChange={handleKnowledgePick}
        />
        <div className="entry-bar w-full backdrop-blur-3xl px-3 py-3 sm:px-5 sm:py-4 lg:px-6 lg:py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-all duration-300 focus-within:border-primary/40 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="font-mono text-[10px] font-bold entry-bar-muted uppercase tracking-[0.2em] select-none shrink-0 hidden sm:block">
              Entry
            </div>
            <Command.Input
              ref={mainInputRef}
              value={value}
              onValueChange={setValue}
              placeholder="Capture something..."
              className="flex-1 min-w-0 bg-transparent font-mono text-sm tracking-tight text-[var(--surface-bar-fg)] outline-none placeholder:text-[var(--surface-bar-muted)]"
              autoFocus
            />
          </div>

          <div className="entry-bar-actions flex items-center gap-2 sm:gap-3 flex-wrap justify-end shrink-0">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="entry-bar-chip touch-target flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[9px]"
              title="Add image as reference"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Image</span>
            </button>

            <button
              onClick={() => knowledgeInputRef.current?.click()}
              className="entry-bar-chip touch-target flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[9px]"
              title="Upload knowledge files"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Knowledge</span>
            </button>

            {speechSupported && (
              <button
                onClick={toggleDictation}
                className={`touch-target flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[9px] transition-colors ${
                  isListening
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "entry-bar-chip"
                }`}
                title={isListening ? "Stop dictation" : "Start dictation"}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{isListening ? "Listening" : "Dictate"}</span>
              </button>
            )}

            <div className="entry-bar-hint hidden md:flex items-center gap-2">
              <kbd className="entry-bar-chip flex h-5 items-center rounded px-1.5 font-mono text-[9px]">
                <span className="text-[11px] mr-1">⌘</span>
                <span>Z</span>
              </kbd>
              <span className="text-[9px] font-mono font-bold entry-bar-muted uppercase tracking-tighter">Undo</span>
            </div>

            <div className="entry-bar-hint hidden md:block h-4 w-px bg-[var(--surface-bar-border)]" />

            <div className="entry-bar-hint hidden md:flex items-center gap-2">
              <kbd className="entry-bar-chip flex h-5 items-center rounded px-1.5 font-mono text-[9px]">
                <span className="text-[11px] mr-1">⌘</span>
                <span>K</span>
              </kbd>
              <span className="text-[9px] font-mono font-bold entry-bar-muted uppercase tracking-tighter">Commands</span>
            </div>

            <div className="entry-bar-hint hidden md:block h-4 w-px bg-[var(--surface-bar-border)]" />

            <button
              onClick={() => {
                if (value.trim()) {
                  submitValue(value)
                  setValue("")
                  setIsCommandKOpen(false)
                }
              }}
              className="font-mono text-[10px] font-bold text-primary uppercase tracking-widest hover:brightness-125 transition-all active:scale-95 disabled:opacity-20"
              disabled={!value.trim()}
            >
              Submit
            </button>
          </div>
        </div>
      </Command>
    </div>
  )
}
