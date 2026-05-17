import type { ResearchProfile } from "@/lib/research/profile"

export type PdfDocumentHandle = Awaited<ReturnType<typeof openPdfDocument>>

export async function configurePdfWorker(): Promise<void> {
  const pdfjs = await import("pdfjs-dist")
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }
}

export async function openPdfDocument(buffer: ArrayBuffer) {
  await configurePdfWorker()
  const pdfjs = await import("pdfjs-dist")
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  return doc
}

export async function renderPdfPageToCanvas(
  doc: PdfDocumentHandle,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable")

  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)

  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return { width: canvas.width, height: canvas.height }
}

export function getPdfViewPageLimit(totalPages: number, profile: ResearchProfile): number {
  return Math.min(totalPages, profile.pdfMaxPages)
}
