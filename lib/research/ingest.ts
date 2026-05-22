import {
  buildKnowledgeDocumentFromRaw,
  type KnowledgeDocument,
} from "@/lib/knowledge-base"
import { extractPdfText } from "@/lib/research/pdf-extract"
import { extractSpreadsheetSummary } from "@/lib/research/spreadsheet-extract"
import {
  getResearchFileKind,
  getResearchProfile,
  type ResearchProfile,
} from "@/lib/research/profile"
import type { ViewportTier } from "@/lib/use-viewport"

export interface IngestResult {
  document: KnowledgeDocument
  previewNote: string
  kind: "pdf" | "spreadsheet" | "text"
}

export async function ingestResearchFile(
  file: File,
  tier: ViewportTier,
): Promise<IngestResult | null> {
  const profile = getResearchProfile(tier)
  const kind = getResearchFileKind(file)
  if (kind === "unknown") return null

  if (kind === "pdf") {
    if (!profile.parsePdf) return null
    const buffer = await file.arrayBuffer()
    const rawText = await extractPdfText(buffer, profile)
    if (!rawText.trim()) return null
    const document = buildKnowledgeDocumentFromRaw({
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      rawText,
      title: `PDF: ${file.name}`,
    })
    return {
      document,
      kind: "pdf",
      previewNote: buildPreviewNote(document, "PDF"),
    }
  }

  if (kind === "spreadsheet") {
    if (!profile.parseSpreadsheet) return null
    const buffer = await file.arrayBuffer()
    const summary = await extractSpreadsheetSummary(buffer, file.name, profile)
    const document = buildKnowledgeDocumentFromRaw({
      fileName: file.name,
      mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rawText: summary.text,
      title: `Sheet: ${file.name}`,
    })
    return {
      document,
      kind: "spreadsheet",
      previewNote: buildPreviewNote(document, "Spreadsheet", summary.rowCount),
    }
  }

  return null
}

export async function ingestResearchFiles(
  files: File[],
  tier: ViewportTier,
): Promise<IngestResult[]> {
  const results: IngestResult[] = []

  for (const file of files) {
    const kind = getResearchFileKind(file)
    if (kind === "unknown") continue
    try {
      const result = await ingestResearchFile(file, tier)
      if (result) results.push(result)
    } catch {
      // Skip files that fail parsing on this device.
    }
  }

  return results
}

function buildPreviewNote(
  doc: KnowledgeDocument,
  label: string,
  extra?: number,
): string {
  const extraLine = extra !== undefined ? `\nRows parsed: ${extra}` : ""
  return (
    `**${label} imported:** ${doc.title}\n\n` +
    `${doc.rawText.slice(0, 480)}${doc.rawText.length > 480 ? "…" : ""}` +
    extraLine
  )
}
