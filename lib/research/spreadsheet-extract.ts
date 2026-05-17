import type { ResearchProfile } from "@/lib/research/profile"

export interface SpreadsheetSummary {
  text: string
  sheetNames: string[]
  columns: string[]
  rowCount: number
  previewCsv: string
}

export async function extractSpreadsheetSummary(
  buffer: ArrayBuffer,
  fileName: string,
  profile: ResearchProfile,
): Promise<SpreadsheetSummary> {
  const XLSX = await import("xlsx")
  const wb = XLSX.read(buffer, {
    type: "array",
    sheetRows: profile.excelMaxRows + 1,
  })

  const sheetNames = wb.SheetNames.slice(0, profile.excelMaxSheets)
  const sections: string[] = []
  let totalRows = 0
  const allColumns = new Set<string>()

  for (const sheetName of sheetNames) {
    const sheet = wb.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    })
    totalRows += rows.length
    const cols = rows.length > 0 ? Object.keys(rows[0]) : []
    cols.forEach((c) => allColumns.add(c))

    const preview = rows.slice(0, 8)
    sections.push(
      `## Sheet: ${sheetName}\n` +
        `Rows: ${rows.length} · Columns: ${cols.join(", ") || "(none)"}\n\n` +
        formatPreviewTable(preview, cols),
    )
  }

  let dataframeNote = ""
  if (profile.useDataframe && sheetNames[0]) {
    try {
      dataframeNote = await summarizeWithDanfo(wb.Sheets[sheetNames[0]], sheetNames[0])
    } catch {
      dataframeNote = ""
    }
  }

  const text = [
    `# Spreadsheet: ${fileName}`,
    `Sheets (${sheetNames.length}): ${sheetNames.join(", ")}`,
    "",
    ...sections,
    dataframeNote ? `\n### Dataframe summary\n${dataframeNote}` : "",
  ].join("\n")

  const firstSheet = wb.Sheets[sheetNames[0]]
  const previewCsv = firstSheet
    ? XLSX.utils.sheet_to_csv(firstSheet, { FS: ",", strip: true }).slice(0, 4000)
    : ""

  return {
    text,
    sheetNames,
    columns: [...allColumns],
    rowCount: totalRows,
    previewCsv,
  }
}

function formatPreviewTable(rows: Record<string, unknown>[], cols: string[]): string {
  if (cols.length === 0) return "(empty sheet)"
  const head = `| ${cols.join(" | ")} |`
  const sep = `| ${cols.map(() => "---").join(" | ")} |`
  const body = rows
    .map((r) => `| ${cols.map((c) => String(r[c] ?? "").slice(0, 40)).join(" | ")} |`)
    .join("\n")
  return `${head}\n${sep}\n${body}`
}

async function summarizeWithDanfo(sheet: import("xlsx").WorkSheet, sheetName: string): Promise<string> {
  const XLSX = await import("xlsx")
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: "" })
  if (rows.length === 0) return "Empty sheet."

  const dfd = await import("danfojs")
  const df = new dfd.DataFrame(rows)
  const describe = df.describe ? await df.describe().toString() : ""
  const shape = `${df.shape?.[0] ?? rows.length} rows × ${df.shape?.[1] ?? Object.keys(rows[0]).length} cols`
  return `Sheet "${sheetName}": ${shape}\n${describe}`.slice(0, 2500)
}
