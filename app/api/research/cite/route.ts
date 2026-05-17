import { NextResponse } from "next/server"
import { formatCitation, type CitationStyle } from "@/lib/research/citations"

const STYLES = new Set<CitationStyle>(["apa", "vancouver", "harvard1", "bibtex"])

export async function POST(req: Request) {
  let body: { input?: string; style?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const input = body.input?.trim()
  if (!input || input.length > 50_000) {
    return NextResponse.json({ error: "Invalid citation input" }, { status: 400 })
  }

  const style = (body.style ?? "apa") as CitationStyle
  if (!STYLES.has(style)) {
    return NextResponse.json({ error: "Unknown style" }, { status: 400 })
  }

  try {
    const formatted = await formatCitation(input, style)
    return NextResponse.json({ formatted })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Citation failed"
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
