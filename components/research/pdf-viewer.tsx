"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import {
  getPdfViewPageLimit,
  openPdfDocument,
  renderPdfPageToCanvas,
  type PdfDocumentHandle,
} from "@/lib/research/pdf-render"
import type { ResearchProfile } from "@/lib/research/profile"

interface PdfViewerProps {
  buffer: ArrayBuffer
  fileName: string
  profile: ResearchProfile
}

export function PdfViewer({ buffer, fileName, profile }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docRef = useRef<PdfDocumentHandle | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [viewLimit, setViewLimit] = useState(0)
  const [scale, setScale] = useState(profile.tier === "mobile" ? 0.9 : 1.15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const doc = await openPdfDocument(buffer)
        if (cancelled) return
        docRef.current = doc
        const limit = getPdfViewPageLimit(doc.numPages, profile)
        setTotalPages(doc.numPages)
        setViewLimit(limit)
        setPage(1)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to open PDF")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      docRef.current = null
    }
  }, [buffer, profile])

  const paint = useCallback(async () => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas) return
    try {
      await renderPdfPageToCanvas(doc, page, canvas, scale)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed")
    }
  }, [page, scale])

  useEffect(() => {
    if (!loading && docRef.current) void paint()
  }, [loading, paint])

  if (error) {
    return <p className="font-mono text-[10px] text-destructive p-2">{error}</p>
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background/50 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border bg-secondary/30">
        <span className="font-mono text-[10px] text-muted-foreground truncate min-w-0" title={fileName}>
          {fileName}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
          {loading ? "…" : `${page} / ${viewLimit}`}
          {totalPages > viewLimit ? ` (${totalPages} total)` : ""}
        </span>
      </div>

      <div className="overflow-auto max-h-[min(52vh,420px)] flex justify-center bg-muted/20 p-2 min-h-[120px]">
        {!loading && <canvas ref={canvasRef} className="max-w-full shadow-sm" />}
        {loading && (
          <p className="font-mono text-[10px] text-muted-foreground self-center">Loading PDF…</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 px-2 pb-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="p-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
            className="p-1.5 rounded-md border border-border hover:bg-secondary"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            className="p-1.5 rounded-md border border-border hover:bg-secondary"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          disabled={page >= viewLimit || loading}
          onClick={() => setPage((p) => Math.min(viewLimit, p + 1))}
          className="p-1.5 rounded-md border border-border hover:bg-secondary disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
