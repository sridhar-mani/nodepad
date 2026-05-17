"use client"

import { useCallback, useMemo, useState } from "react"
import { Play, RotateCcw, Download } from "lucide-react"
import {
  DATA_OP_LABELS,
  runDataOp,
  type DataOp,
  type DataOpKind,
  type DataTable,
  type FilterOp,
} from "@/lib/research/data-ops"
import { SpreadsheetGrid } from "@/components/research/spreadsheet-grid"
import { downloadWorkbookSheetXlsx } from "@/lib/research/spreadsheet-workbook"
import type { SpreadsheetWorkbook } from "@/lib/research/spreadsheet-workbook"

interface DataLabProps {
  sourceTable: DataTable
  workbook?: SpreadsheetWorkbook
  sheetIndex?: number
  useDanfo: boolean
  gridMaxRows: number
  onTableChange: (table: DataTable) => void
  onAddNote?: (markdown: string) => void
}

const OP_OPTIONS: DataOpKind[] = [
  "head",
  "tail",
  "filter",
  "sort",
  "select",
  "unique",
  "groupby_sum",
  "groupby_mean",
  "describe",
  "fillna",
  "dropna",
]

export function DataLab({
  sourceTable,
  workbook,
  sheetIndex = 0,
  useDanfo,
  gridMaxRows,
  onTableChange,
  onAddNote,
}: DataLabProps) {
  const [opKind, setOpKind] = useState<DataOpKind>("head")
  const [n, setN] = useState("25")
  const [column, setColumn] = useState("")
  const [valueColumn, setValueColumn] = useState("")
  const [filterOp, setFilterOp] = useState<FilterOp>("contains")
  const [filterValue, setFilterValue] = useState("")
  const [fillValue, setFillValue] = useState("0")
  const [desc, setDesc] = useState(false)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [baseline] = useState(() => ({
    columns: [...sourceTable.columns],
    rows: sourceTable.rows.map((r) => ({ ...r })),
  }))

  const columns = sourceTable.columns
  const activeCol = column || columns[0] || ""
  const activeValCol = valueColumn || columns[1] || columns[0] || ""

  const needsColumn = useMemo(
    () =>
      ["filter", "sort", "unique", "groupby_sum", "groupby_mean", "dropna"].includes(opKind),
    [opKind],
  )
  const needsValueCol = useMemo(
    () => ["groupby_sum", "groupby_mean"].includes(opKind),
    [opKind],
  )
  const needsFilter = opKind === "filter"
  const needsN = opKind === "head" || opKind === "tail"
  const needsFill = opKind === "fillna"

  const runOp = useCallback(async () => {
    setBusy(true)
    setSummary(null)
    const op: DataOp = { kind: opKind }
    if (needsN) op.n = Math.max(1, Number(n) || 10)
    if (needsColumn) op.column = activeCol
    if (needsValueCol) {
      op.groupColumn = activeCol
      op.valueColumn = activeValCol
    }
    if (needsFilter) {
      op.filterOp = filterOp
      op.value = filterValue
    }
    if (needsFill) op.fillValue = fillValue
    if (opKind === "sort") op.desc = desc

    try {
      const result = await runDataOp(sourceTable, op, useDanfo)
      onTableChange(result.table)
      setSummary(result.summary)
    } catch (e) {
      setSummary(e instanceof Error ? e.message : "Operation failed")
    } finally {
      setBusy(false)
    }
  }, [
    opKind,
    n,
    activeCol,
    activeValCol,
    filterOp,
    filterValue,
    fillValue,
    desc,
    sourceTable,
    useDanfo,
    onTableChange,
    needsN,
    needsColumn,
    needsValueCol,
    needsFilter,
    needsFill,
  ])

  const reset = useCallback(() => {
    onTableChange({
      columns: [...baseline.columns],
      rows: baseline.rows.map((r) => ({ ...r })),
    })
    setSummary("Reset to loaded sheet.")
  }, [baseline, onTableChange])

  const exportXlsx = useCallback(async () => {
    if (!workbook) return
    const patched: SpreadsheetWorkbook = {
      ...workbook,
      sheets: workbook.sheets.map((s, i) =>
        i === sheetIndex ? { ...s, columns: sourceTable.columns, rows: sourceTable.rows } : s,
      ),
    }
    await downloadWorkbookSheetXlsx(patched, sheetIndex)
  }, [workbook, sheetIndex, sourceTable])

  const pushNote = useCallback(() => {
    if (!onAddNote) return
    const head = sourceTable.rows.slice(0, 5)
    const md = [
      "## Data lab result",
      summary ?? "",
      "",
      `Rows: ${sourceTable.rows.length} · Cols: ${sourceTable.columns.join(", ")}`,
      "",
      "| " + sourceTable.columns.join(" | ") + " |",
      "| " + sourceTable.columns.map(() => "---").join(" | ") + " |",
      ...head.map(
        (r) =>
          "| " + sourceTable.columns.map((c) => String(r[c] ?? "").slice(0, 32)).join(" | ") + " |",
      ),
    ].join("\n")
    onAddNote(md)
    setSummary("Snapshot added as note.")
  }, [onAddNote, sourceTable, summary])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
        Data lab
        {useDanfo && (
          <span className="normal-case text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
            danfo
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 font-mono text-[10px] text-muted-foreground">Operation</label>
        <select
          value={opKind}
          onChange={(e) => setOpKind(e.target.value as DataOpKind)}
          className="col-span-2 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
        >
          {OP_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {DATA_OP_LABELS[k]}
            </option>
          ))}
        </select>

        {needsN && (
          <>
            <label className="font-mono text-[10px] text-muted-foreground">N</label>
            <input
              value={n}
              onChange={(e) => setN(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            />
          </>
        )}

        {(needsColumn || needsValueCol) && (
          <>
            <label className="font-mono text-[10px] text-muted-foreground">Column</label>
            <select
              value={activeCol}
              onChange={(e) => setColumn(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        )}

        {needsValueCol && (
          <>
            <label className="font-mono text-[10px] text-muted-foreground">Value col</label>
            <select
              value={activeValCol}
              onChange={(e) => setValueColumn(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </>
        )}

        {needsFilter && (
          <>
            <label className="font-mono text-[10px] text-muted-foreground">Match</label>
            <select
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value as FilterOp)}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            >
              <option value="contains">contains</option>
              <option value="eq">equals</option>
              <option value="gt">&gt;</option>
              <option value="lt">&lt;</option>
              <option value="gte">≥</option>
              <option value="lte">≤</option>
            </select>
            <label className="font-mono text-[10px] text-muted-foreground">Value</label>
            <input
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            />
          </>
        )}

        {needsFill && (
          <>
            <label className="font-mono text-[10px] text-muted-foreground">Fill with</label>
            <input
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
            />
          </>
        )}

        {opKind === "sort" && (
          <label className="col-span-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <input type="checkbox" checked={desc} onChange={(e) => setDesc(e.target.checked)} />
            Descending
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void runOp()}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-mono text-xs text-primary-foreground disabled:opacity-50"
        >
          <Play className="h-3 w-3" />
          {busy ? "Running…" : "Run"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs hover:bg-secondary"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
        {workbook && (
          <button
            type="button"
            onClick={() => void exportXlsx()}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs hover:bg-secondary"
          >
            <Download className="h-3 w-3" />
            Export .xlsx
          </button>
        )}
        {onAddNote && (
          <button
            type="button"
            onClick={pushNote}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs hover:bg-secondary"
          >
            Note snapshot
          </button>
        )}
      </div>

      {summary && (
        <p className="font-mono text-[10px] text-muted-foreground">{summary}</p>
      )}

      <SpreadsheetGrid
        table={sourceTable}
        maxRows={gridMaxRows}
        caption="Current table"
      />
    </div>
  )
}
