"use client"

import { FileSpreadsheet, FileText, ListChecks, Upload, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { KnowledgeDocument } from "@/lib/knowledge-base"

interface ImportPreviewPanelProps {
  open: boolean
  sourceLabel: string
  documents: KnowledgeDocument[]
  previewNotes: string[]
  isConfirming?: boolean
  onCancel: () => void
  onConfirm: () => void
}

function getDocumentKindLabel(doc: KnowledgeDocument): string {
  const mime = doc.mimeType.toLowerCase()
  if (mime.includes("pdf")) return "PDF"
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("spreadsheet")) return "Spreadsheet"
  if (mime.startsWith("text/")) return "Text"
  if (doc.fileName.toLowerCase().endsWith(".csv")) return "CSV"
  return "Document"
}

export function ImportPreviewPanel({
  open,
  sourceLabel,
  documents,
  previewNotes,
  isConfirming = false,
  onCancel,
  onConfirm,
}: ImportPreviewPanelProps) {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel() }}>
      <SheetContent side="right" className="w-full max-w-xl border-border bg-card/98 backdrop-blur-3xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Upload className="h-3.5 w-3.5" />
            Import preview
          </div>
          <SheetTitle className="font-mono text-sm">Review before importing</SheetTitle>
          <SheetDescription className="font-mono text-[10px] leading-relaxed">
            {sourceLabel} has been parsed. Inspect the extracted data and confirm when it looks right.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <ListChecks className="h-3 w-3" />
                Items
              </div>
              <div className="mt-2 text-sm font-semibold">{documents.length}</div>
            </div>
            <div className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3 w-3" />
                Source
              </div>
              <div className="mt-2 text-sm font-semibold">{sourceLabel}</div>
            </div>
          </div>

          <div className="space-y-3">
            {documents.map((doc, index) => (
              <article key={doc.id} className="rounded-md border border-border bg-background p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-mono text-xs font-semibold truncate">{doc.title}</h3>
                    <p className="font-mono text-[10px] text-muted-foreground truncate">{doc.fileName}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {getDocumentKindLabel(doc)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
                  <div className="rounded-sm bg-secondary/30 px-2 py-1">Chunks: {doc.chunks.length}</div>
                  <div className="rounded-sm bg-secondary/30 px-2 py-1">Chars: {doc.rawText.length}</div>
                </div>

                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-sm bg-secondary/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {previewNotes[index] ?? doc.rawText.slice(0, 420)}
                </pre>
              </article>
            ))}
          </div>
        </div>

        <SheetFooter className="border-t border-border px-5 py-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-md border border-border px-3 py-2 font-mono text-xs hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isConfirming || documents.length === 0}
              onClick={onConfirm}
              className="flex-1 rounded-md bg-primary px-3 py-2 font-mono text-xs text-primary-foreground disabled:opacity-50"
            >
              {isConfirming ? "Importing…" : "Confirm import"}
            </button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}