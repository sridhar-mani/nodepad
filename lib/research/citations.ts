export type CitationStyle = "apa" | "vancouver" | "harvard1" | "bibtex"

export async function formatCitation(
  input: string,
  style: CitationStyle = "apa",
): Promise<string> {
  const trimmed = input.trim()
  if (!trimmed) return ""

  const { Cite } = await import("@citation-js/core")
  const cite = await Cite.async(trimmed)
  if (style === "bibtex") {
    return cite.format("bibtex")
  }
  return cite.format("bibliography", {
    format: "text",
    template: style,
    lang: "en-US",
  })
}
