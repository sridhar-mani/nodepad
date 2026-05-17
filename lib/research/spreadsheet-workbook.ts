import type { ResearchProfile } from "@/lib/research/profile"

export interface SheetData {
  name: string
  columns: string[]
  rows: Record<string, string | number>[]
}

export interface SpreadsheetWorkbook {
  fileName: string
  sheets: SheetData[]
}

export async function loadSpreadsheetWorkbook(
  buffer: ArrayBuffer,
  fileName: string,
  profile: ResearchProfile,
): Promise<SpreadsheetWorkbook> {
  const XLSX = await import("xlsx")
  const wb = XLSX.read(buffer, {
    type: "array",
    sheetRows: profile.excelMaxRows + 1,
  })

  const sheetNames = wb.SheetNames.slice(0, profile.excelMaxSheets)
  const sheets: SheetData[] = []

  for (const name of sheetNames) {
    const sheet = wb.Sheets[name]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, {
      defval: "",
      raw: false,
    })
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []
    sheets.push({ name, columns, rows })
  }

  return { fileName, sheets }
}

export async function exportWorkbookSheetCsv(
  workbook: SpreadsheetWorkbook,
  sheetIndex: number,
): Promise<string> {
  const XLSX = await import("xlsx")
  const sheet = workbook.sheets[sheetIndex]
  if (!sheet) return ""
  const ws = XLSX.utils.json_to_sheet(sheet.rows)
  return XLSX.utils.sheet_to_csv(ws)
}

export async function downloadWorkbookSheetXlsx(
  workbook: SpreadsheetWorkbook,
  sheetIndex: number,
  fileName?: string,
): Promise<void> {
  const XLSX = await import("xlsx")
  const sheet = workbook.sheets[sheetIndex]
  if (!sheet) return

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet.rows), sheet.name)
  XLSX.writeFile(wb, fileName ?? `${workbook.fileName.replace(/\.[^.]+$/, "")}-export.xlsx`)
}
