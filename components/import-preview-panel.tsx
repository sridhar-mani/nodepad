"use client"

import { FileText, FolderInput, ListChecks, Upload, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { KnowledgeDocument } from "@/lib/knowledge-base"

type ImportMode = "knowledge" | "project" | "note"

type ImportProjectPreview = {
  name: string
  blocks: number
  knowledgeDocs: number
  ghostNotes: number
  collapsed: number
}

interface ImportPreviewPanelProps {
  open: boolean
  sourceLabel: string
  mode: ImportMode
  documents?: KnowledgeDocument[]
  previewNotes?: string[]
  noteText?: string
  projectPreview?: ImportProjectPreview
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
  mode,
  documents = [],
  previewNotes = [],
  noteText = "",
  projectPreview,
  isConfirming = false,
  onCancel,
  onConfirm,
}: ImportPreviewPanelProps) {
  const confirmLabel = mode === "project" ? "Import project" : mode === "note" ? "Add note" : "Confirm import"
  const title = mode === "project" ? "Review project before importing" : mode === "note" ? "Review note before adding" : "Review before importing"
  const subtitle =
    mode === "project"
      ? `${sourceLabel} has been parsed. Check the project summary before it is added.`
      : mode === "note"
        ? `${sourceLabel} is ready to be added as a note.`
        : `${sourceLabel} has been parsed. Inspect the extracted data and confirm when it looks right.`

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onCancel() }}>
      <SheetContent side="right" className="w-full max-w-xl border-border bg-card/98 backdrop-blur-3xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {mode === "project" ? <FolderInput className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
            {mode === "project" ? "Project preview" : "Import preview"}
          </div>
          <SheetTitle className="font-mono text-sm">{title}</SheetTitle>
          <SheetDescription className="font-mono text-[10px] leading-relaxed">{subtitle}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <ListChecks className="h-3 w-3" />
                {mode === "knowledge" ? "Items" : mode === "project" ? "Blocks" : "Chars"}
              </div>
              <div className="mt-2 text-sm font-semibold">
                {mode === "knowledge"
                  ? documents.length
                  : mode === "project"
                    ? (projectPreview?.blocks ?? 0)
                    : noteText.length}
              </div>
            </div>
            <div className="rounded-md border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3 w-3" />
                Source
              </div>
              <div className="mt-2 text-sm font-semibold">{sourceLabel}</div>
            </div>
          </div>

          {mode === "project" && projectPreview && (
            <div className="rounded-md border border-border bg-background p-3 space-y-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Project</p>
                <h3 className="mt-1 text-sm font-semibold">{projectPreview.name}</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
                <div className="rounded-sm bg-secondary/30 px-2 py-1">Blocks: {projectPreview.blocks}</div>
                <div className="rounded-sm bg-secondary/30 px-2 py-1">Knowledge docs: {projectPreview.knowledgeDocs}</div>
                <div className="rounded-sm bg-secondary/30 px-2 py-1">Ghost notes: {projectPreview.ghostNotes}</div>
                <div className="rounded-sm bg-secondary/30 px-2 py-1">Collapsed: {projectPreview.collapsed}</div>
              </div>
            </div>
          )}

          {mode === "note" && (
            <div className="rounded-md border border-border bg-background p-3 space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Note preview</p>
              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-sm bg-secondary/30 px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {noteText}
              </pre>
            </div>
          )}

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
              disabled={
                isConfirming ||
                (mode === "knowledge" ? documents.length === 0 : mode === "note" ? noteText.trim().length === 0 : !projectPreview)
              }
              onClick={onConfirm}
              className="flex-1 rounded-md bg-primary px-3 py-2 font-mono text-xs text-primary-foreground disabled:opacity-50"
            >
              {isConfirming ? "Working…" : confirmLabel}
            </button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}