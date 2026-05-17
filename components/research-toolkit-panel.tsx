"use client"

import { useCallback, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  FileSpreadsheet,
  FileText,
  LineChart,
  Calculator,
  BookOpen,
  Upload,
  Database,
  Wrench,
} from "lucide-react"
import { FinanceChart } from "@/components/finance-chart"
import { PdfViewer } from "@/components/research/pdf-viewer"
import { SpreadsheetGrid } from "@/components/research/spreadsheet-grid"
import { DataLab } from "@/components/research/data-lab"
import { getResearchFileKind, getResearchProfile } from "@/lib/research/profile"
import { ingestResearchFiles } from "@/lib/research/ingest"
import { formatCitation, type CitationStyle } from "@/lib/research/citations"
import {
  fetchStockHistory,
  fetchStockQuote,
  formatQuoteNote,
  type HistoryPoint,
} from "@/lib/research/finance-client"
import { loadSpreadsheetWorkbook, type SpreadsheetWorkbook } from "@/lib/research/spreadsheet-workbook"
import type { DataTable } from "@/lib/research/data-ops"
import type { ViewportTier } from "@/lib/use-viewport"
import type { KnowledgeDocument } from "@/lib/knowledge-base"

type PanelTab = "documents" | "tools"

type PdfWorkbench = {
  kind: "pdf"
  fileName: string
  buffer: ArrayBuffer
}

type SheetWorkbench = {
  kind: "spreadsheet"
  fileName: string
  buffer: ArrayBuffer
  workbook: SpreadsheetWorkbook
  sheetIndex: number
  table: DataTable
}

type Workbench = PdfWorkbench | SheetWorkbench

interface ResearchToolkitPanelProps {
  isOpen: boolean
  onClose: () => void
  tier: ViewportTier
  onImportDocuments: (docs: KnowledgeDocument[], previewNotes: string[]) => void
  onAddResearchNote: (markdown: string) => void
}

export function ResearchToolkitPanel({
  isOpen,
  onClose,
  tier,
  onImportDocuments,
  onAddResearchNote,
}: ResearchToolkitPanelProps) {
  const profile = getResearchProfile(tier)
  const fileRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<PanelTab>("documents")
  const [workbench, setWorkbench] = useState<Workbench | null>(null)
  const [openBusy, setOpenBusy] = useState(false)

  const [symbol, setSymbol] = useState("AAPL")
  const [quoteBusy, setQuoteBusy] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [chartPoints, setChartPoints] = useState<HistoryPoint[]>([])
  const [chartSymbol, setChartSymbol] = useState("")
  const [importBusy, setImportBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const [citeInput, setCiteInput] = useState("")
  const [citeStyle, setCiteStyle] = useState<CitationStyle>("apa")
  const [citeBusy, setCiteBusy] = useState(false)

  const [npvRate, setNpvRate] = useState("0.08")
  const [npvFlows, setNpvFlows] = useState("-10000,3000,4000,5000,6000")
  const [calcResult, setCalcResult] = useState<string | null>(null)

  const openFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return
      const file = files[0]
      const kind = getResearchFileKind(file)
      setOpenBusy(true)
      setStatus(null)
      try {
        const buffer = await file.arrayBuffer()
        if (kind === "pdf" && profile.parsePdf) {
          setWorkbench({ kind: "pdf", fileName: file.name, buffer })
          setTab("documents")
          setStatus(`Opened PDF: ${file.name}`)
        } else if (kind === "spreadsheet" && profile.parseSpreadsheet) {
          const workbook = await loadSpreadsheetWorkbook(buffer, file.name, profile)
          const sheet = workbook.sheets[0]
          if (!sheet) throw new Error("No sheets found")
          setWorkbench({
            kind: "spreadsheet",
            fileName: file.name,
            buffer,
            workbook,
            sheetIndex: 0,
            table: { columns: sheet.columns, rows: sheet.rows },
          })
          setTab("documents")
          setStatus(`Opened ${file.name} · ${sheet.rows.length} rows`)
        } else {
          setStatus("Unsupported file type.")
        }
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Could not open file")
      } finally {
        setOpenBusy(false)
        if (fileRef.current) fileRef.current.value = ""
      }
    },
    [profile],
  )

  const importToKb = useCallback(
    async (files?: FileList | null) => {
      let list: File[] | null = files ? Array.from(files) : null
      if (!list?.length && workbench) {
        const mime =
          workbench.kind === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        list = [new File([workbench.buffer], workbench.fileName, { type: mime })]
      }
      if (!list?.length) return

      setImportBusy(true)
      setStatus(null)
      try {
        const results = await ingestResearchFiles(list, tier)
        if (results.length === 0) {
          setStatus("Nothing imported.")
          return
        }
        onImportDocuments(
          results.map((r) => r.document),
          results.map((r) => r.previewNote),
        )
        setStatus(`Added ${results.length} doc(s) to knowledge base.`)
      } catch {
        setStatus("Import failed.")
      } finally {
        setImportBusy(false)
        if (fileRef.current) fileRef.current.value = ""
      }
    },
    [tier, onImportDocuments, workbench],
  )

  const setSheetIndex = useCallback((index: number) => {
    setWorkbench((prev) => {
      if (!prev || prev.kind !== "spreadsheet") return prev
      const sheet = prev.workbook.sheets[index]
      if (!sheet) return prev
      return {
        ...prev,
        sheetIndex: index,
        table: { columns: sheet.columns, rows: sheet.rows.map((r) => ({ ...r })) },
      }
    })
  }, [])

  const updateTable = useCallback((table: DataTable) => {
    setWorkbench((prev) => {
      if (!prev || prev.kind !== "spreadsheet") return prev
      return { ...prev, table }
    })
  }, [])

  const handleQuote = useCallback(async () => {
    if (!profile.fetchMarketData || !symbol.trim()) return
    setQuoteBusy(true)
    setStatus(null)
    try {
      const q = await fetchStockQuote(symbol)
      onAddResearchNote(formatQuoteNote(q))
      setStatus(`Quote added for ${q.symbol}.`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Quote failed")
    } finally {
      setQuoteBusy(false)
    }
  }, [symbol, profile.fetchMarketData, onAddResearchNote])

  const handleChart = useCallback(async () => {
    if (!profile.renderCharts || !symbol.trim()) return
    setHistoryBusy(true)
    setStatus(null)
    try {
      const hist = await fetchStockHistory(symbol, tier === "mobile" ? "1mo" : "3mo")
      const max = profile.chartMaxPoints
      const sliced =
        hist.points.length > max
          ? hist.points.slice(hist.points.length - max)
          : hist.points
      setChartPoints(sliced)
      setChartSymbol(hist.symbol)
      setStatus(`Chart loaded: ${hist.symbol} (${sliced.length} points).`)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Chart failed")
    } finally {
      setHistoryBusy(false)
    }
  }, [symbol, profile.renderCharts, profile.chartMaxPoints, tier])

  const handleCite = useCallback(async () => {
    if (!profile.formatCitations || !citeInput.trim()) return
    setCiteBusy(true)
    setStatus(null)
    try {
      const formatted = await formatCitation(citeInput, citeStyle)
      onAddResearchNote(`## Citation (${citeStyle})\n\n${formatted}`)
      setStatus("Citation note added.")
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Citation failed")
    } finally {
      setCiteBusy(false)
    }
  }, [citeInput, citeStyle, profile.formatCitations, onAddResearchNote])

  const handleNpv = useCallback(async () => {
    setCalcResult(null)
    try {
      const { npv, irr } = await import("financial-fns")
      const rate = Number(npvRate)
      const flows = npvFlows.split(",").map((s) => Number(s.trim()))
      if (flows.some((n) => Number.isNaN(n)) || Number.isNaN(rate)) {
        setCalcResult("Invalid numbers.")
        return
      }
      const npvVal = npv(flows, rate)
      let irrVal: number | string = "n/a"
      try {
        irrVal = irr(flows)
      } catch {
        irrVal = "n/a"
      }
      const note = [
        "## Financial calc",
        `Rate: ${(rate * 100).toFixed(2)}%`,
        `Cash flows: ${flows.join(", ")}`,
        `**NPV:** ${Number(npvVal).toFixed(2)}`,
        `**IRR:** ${typeof irrVal === "number" ? (irrVal * 100).toFixed(2) + "%" : irrVal}`,
      ].join("\n")
      setCalcResult(note)
      onAddResearchNote(note)
    } catch {
      setCalcResult("Calculation failed.")
    }
  }, [npvRate, npvFlows, onAddResearchNote])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[115] bg-background/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-[120] flex h-dvh w-full max-w-md lg:max-w-3xl flex-col border-l border-border bg-card shadow-2xl"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 shrink-0">
              <div className="min-w-0">
                <h2 className="font-mono text-sm font-semibold tracking-tight">Research toolkit</h2>
                <p className="font-mono text-[10px] text-muted-foreground truncate">
                  View PDF & Excel · manipulate data · {tier}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Close research panel"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex border-b border-border shrink-0">
              <button
                type="button"
                onClick={() => setTab("documents")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-mono text-xs border-b-2 transition-colors ${
                  tab === "documents"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                Documents
              </button>
              <button
                type="button"
                onClick={() => setTab("tools")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-mono text-xs border-b-2 transition-colors ${
                  tab === "tools"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Wrench className="h-3.5 w-3.5" />
                Tools
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {tab === "documents" && (
                <>
                  <section className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      <Upload className="h-3.5 w-3.5" />
                      Open file
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={(e) => void openFiles(e.target.files)}
                    />
                    <motion.div className="flex gap-2">
                      <button
                        type="button"
                        disabled={openBusy}
                        onClick={() => fileRef.current?.click()}
                        className="flex-1 rounded-md border border-border bg-secondary/50 px-3 py-2 font-mono text-xs hover:bg-secondary disabled:opacity-50"
                      >
                        {openBusy ? "Opening…" : "Open PDF / Excel"}
                      </button>
                      <button
                        type="button"
                        disabled={importBusy || !workbench}
                        onClick={() => void importToKb()}
                        className="rounded-md border border-border px-3 py-2 font-mono text-xs hover:bg-secondary disabled:opacity-40"
                        title="Add open file to knowledge base"
                      >
                        {importBusy ? "…" : "→ KB"}
                      </button>
                    </motion.div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      PDF render up to {profile.pdfMaxPages} pages · sheets up to {profile.excelMaxRows} rows
                      {profile.useDataframe ? " · danfo stats on tablet/desktop" : ""}
                    </p>
                  </section>

                  {workbench?.kind === "pdf" && (
                    <PdfViewer
                      buffer={workbench.buffer}
                      fileName={workbench.fileName}
                      profile={profile}
                    />
                  )}

                  {workbench?.kind === "spreadsheet" && (
                    <>
                      {workbench.workbook.sheets.length > 1 && (
                        <select
                          value={workbench.sheetIndex}
                          onChange={(e) => setSheetIndex(Number(e.target.value))}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
                        >
                          {workbench.workbook.sheets.map((s, i) => (
                            <option key={s.name} value={i}>
                              {s.name} ({s.rows.length} rows)
                            </option>
                          ))}
                        </select>
                      )}
                      <SpreadsheetGrid
                        table={workbench.table}
                        maxRows={profile.gridDisplayMaxRows}
                        caption={workbench.workbook.sheets[workbench.sheetIndex]?.name}
                      />
                      <DataLab
                        sourceTable={workbench.table}
                        workbook={workbench.workbook}
                        sheetIndex={workbench.sheetIndex}
                        useDanfo={profile.useDataframe}
                        gridMaxRows={profile.gridDisplayMaxRows}
                        onTableChange={updateTable}
                        onAddNote={onAddResearchNote}
                      />
                    </>
                  )}

                  {!workbench && (
                    <div className="rounded-md border border-dashed border-border p-6 text-center">
                      <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="font-mono text-[11px] text-muted-foreground">
                        Open a PDF to read page-by-page, or Excel/CSV to view and transform data.
                      </p>
                    </div>
                  )}
                </>
              )}

              {tab === "tools" && (
                <>
                  <section className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      <LineChart className="h-3.5 w-3.5" />
                      Markets
                    </div>
                    <input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="Ticker e.g. AAPL"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={quoteBusy || !profile.fetchMarketData}
                        onClick={() => void handleQuote()}
                        className="flex-1 rounded-md bg-primary px-3 py-2 font-mono text-xs text-primary-foreground disabled:opacity-50"
                      >
                        {quoteBusy ? "…" : "Quote → note"}
                      </button>
                      <button
                        type="button"
                        disabled={historyBusy || !profile.renderCharts}
                        onClick={() => void handleChart()}
                        className="flex-1 rounded-md border border-border px-3 py-2 font-mono text-xs hover:bg-secondary disabled:opacity-50"
                      >
                        {historyBusy ? "…" : "Chart"}
                      </button>
                    </div>
                    {chartPoints.length > 0 && profile.renderCharts && (
                      <FinanceChart symbol={chartSymbol} points={chartPoints} />
                    )}
                  </section>

                  <section className="space-y-2">
                    <motion.div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      <Calculator className="h-3.5 w-3.5" />
                      NPV / IRR
                    </motion.div>
                    <label className="block font-mono text-[10px] text-muted-foreground">Discount rate</label>
                    <input
                      value={npvRate}
                      onChange={(e) => setNpvRate(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                    />
                    <label className="block font-mono text-[10px] text-muted-foreground">Cash flows</label>
                    <textarea
                      value={npvFlows}
                      onChange={(e) => setNpvFlows(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleNpv()}
                      className="w-full rounded-md border border-border px-3 py-2 font-mono text-xs hover:bg-secondary"
                    >
                      Calculate & add note
                    </button>
                    {calcResult && (
                      <pre className="rounded-md bg-secondary/40 p-2 font-mono text-[10px] whitespace-pre-wrap text-muted-foreground">
                        {calcResult}
                      </pre>
                    )}
                  </section>

                  <section className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                      <BookOpen className="h-3.5 w-3.5" />
                      Citations
                    </div>
                    <select
                      value={citeStyle}
                      onChange={(e) => setCiteStyle(e.target.value as CitationStyle)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                    >
                      <option value="apa">APA</option>
                      <option value="vancouver">Vancouver</option>
                      <option value="harvard1">Harvard</option>
                      <option value="bibtex">BibTeX</option>
                    </select>
                    <textarea
                      value={citeInput}
                      onChange={(e) => setCiteInput(e.target.value)}
                      placeholder="DOI, PMID, or BibTeX…"
                      rows={4}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs resize-none"
                    />
                    <button
                      type="button"
                      disabled={citeBusy || !profile.formatCitations}
                      onClick={() => void handleCite()}
                      className="w-full rounded-md border border-border px-3 py-2 font-mono text-xs hover:bg-secondary disabled:opacity-50"
                    >
                      {citeBusy ? "Formatting…" : "Format & add note"}
                    </button>
                  </section>

                  <section className="rounded-md border border-dashed border-border p-3 space-y-1">
                    <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      Math in notes
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Use $inline$ or $$block$$ LaTeX in annotations.
                    </p>
                  </section>
                </>
              )}

              {status && (
                <p className="font-mono text-[10px] text-muted-foreground border-t border-border pt-2">
                  {status}
                </p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
