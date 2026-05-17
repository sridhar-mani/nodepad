import type { ViewportTier } from "@/lib/use-viewport"

export type ResearchFileKind = "pdf" | "spreadsheet" | "text" | "unknown"

export interface ResearchProfile {
  tier: ViewportTier
  parsePdf: boolean
  parseSpreadsheet: boolean
  useDataframe: boolean
  renderCharts: boolean
  fetchMarketData: boolean
  formatCitations: boolean
  pdfMaxPages: number
  excelMaxRows: number
  excelMaxSheets: number
  chartMaxPoints: number
  /** Rows shown in the interactive spreadsheet grid */
  gridDisplayMaxRows: number
}

const MOBILE: ResearchProfile = {
  tier: "mobile",
  parsePdf: true,
  parseSpreadsheet: true,
  useDataframe: false,
  renderCharts: true,
  fetchMarketData: true,
  formatCitations: true,
  pdfMaxPages: 8,
  excelMaxRows: 400,
  excelMaxSheets: 1,
  chartMaxPoints: 120,
  gridDisplayMaxRows: 80,
}

const TABLET: ResearchProfile = {
  tier: "tablet",
  parsePdf: true,
  parseSpreadsheet: true,
  useDataframe: true,
  renderCharts: true,
  fetchMarketData: true,
  formatCitations: true,
  pdfMaxPages: 20,
  excelMaxRows: 2000,
  excelMaxSheets: 3,
  chartMaxPoints: 240,
  gridDisplayMaxRows: 150,
}

const DESKTOP: ResearchProfile = {
  tier: "desktop",
  parsePdf: true,
  parseSpreadsheet: true,
  useDataframe: true,
  renderCharts: true,
  fetchMarketData: true,
  formatCitations: true,
  pdfMaxPages: 60,
  excelMaxRows: 15_000,
  excelMaxSheets: 10,
  chartMaxPoints: 500,
  gridDisplayMaxRows: 300,
}

export function getResearchProfile(tier: ViewportTier): ResearchProfile {
  if (tier === "mobile") return MOBILE
  if (tier === "tablet") return TABLET
  return DESKTOP
}

export function getResearchFileKind(file: File): ResearchFileKind {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf"
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv")
  ) {
    return "spreadsheet"
  }
  if (
    type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown") ||
    name.endsWith(".json") ||
    name.endsWith(".yaml") ||
    name.endsWith(".yml")
  ) {
    return "text"
  }
  return "unknown"
}

export function isResearchImportable(file: File): boolean {
  return getResearchFileKind(file) !== "unknown"
}
