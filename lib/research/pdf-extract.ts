import type { ResearchProfile } from "@/lib/research/profile"
import { openPdfDocument } from "@/lib/research/pdf-render"

export async function extractPdfText(buffer: ArrayBuffer, profile: ResearchProfile): Promise<string> {
  const doc = await openPdfDocument(buffer)
  const maxPages = Math.min(doc.numPages, profile.pdfMaxPages)
  const parts: string[] = []

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
    if (line.trim()) parts.push(line.trim())
  }

  if (doc.numPages > maxPages) {
    parts.push(`\n[Truncated: ${maxPages} of ${doc.numPages} pages on ${profile.tier}]`)
  }

  return parts.join("\n\n")
}
