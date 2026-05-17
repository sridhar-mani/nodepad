export type FilterOp = "eq" | "contains" | "gt" | "lt" | "gte" | "lte"

export type DataOpKind =
  | "head"
  | "tail"
  | "filter"
  | "sort"
  | "select"
  | "unique"
  | "groupby_sum"
  | "groupby_mean"
  | "describe"
  | "fillna"
  | "dropna"

export interface DataOp {
  kind: DataOpKind
  /** head / tail */
  n?: number
  column?: string
  columns?: string[]
  filterOp?: FilterOp
  value?: string
  desc?: boolean
  /** groupby */
  groupColumn?: string
  valueColumn?: string
  fillValue?: string
}

export interface DataTable {
  columns: string[]
  rows: Record<string, string | number>[]
}

export interface DataOpResult {
  table: DataTable
  summary: string
  usedDanfo: boolean
}

function coerceNum(v: string | number): number | null {
  if (typeof v === "number") return v
  const n = Number(String(v).replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

function compareFilter(
  cell: string | number,
  op: FilterOp,
  raw: string,
): boolean {
  const s = String(cell ?? "").toLowerCase()
  const q = raw.toLowerCase()
  if (op === "eq") return s === q
  if (op === "contains") return s.includes(q)
  const a = coerceNum(cell)
  const b = coerceNum(raw)
  if (a == null || b == null) return false
  if (op === "gt") return a > b
  if (op === "lt") return a < b
  if (op === "gte") return a >= b
  if (op === "lte") return a <= b
  return false
}

function applyJsOp(table: DataTable, op: DataOp): DataTable {
  let { columns, rows } = table

  switch (op.kind) {
    case "head":
      rows = rows.slice(0, Math.max(1, op.n ?? 10))
      break
    case "tail":
      rows = rows.slice(-Math.max(1, op.n ?? 10))
      break
    case "filter": {
      const col = op.column
      if (!col) break
      rows = rows.filter((r) =>
        compareFilter(r[col] ?? "", op.filterOp ?? "contains", op.value ?? ""),
      )
      break
    }
    case "sort": {
      const col = op.column
      if (!col) break
      rows = [...rows].sort((a, b) => {
        const av = a[col] ?? ""
        const bv = b[col] ?? ""
        const an = coerceNum(av)
        const bn = coerceNum(bv)
        let cmp = 0
        if (an != null && bn != null) cmp = an - bn
        else cmp = String(av).localeCompare(String(bv))
        return op.desc ? -cmp : cmp
      })
      break
    }
    case "select": {
      const pick = op.columns?.length ? op.columns : columns
      columns = pick.filter((c) => columns.includes(c))
      rows = rows.map((r) => {
        const next: Record<string, string | number> = {}
        for (const c of columns) next[c] = r[c] ?? ""
        return next
      })
      break
    }
    case "unique": {
      const col = op.column ?? columns[0]
      const seen = new Set<string>()
      rows = rows.filter((r) => {
        const key = String(r[col] ?? "")
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      break
    }
    case "groupby_sum":
    case "groupby_mean": {
      const g = op.groupColumn ?? columns[0]
      const v = op.valueColumn ?? columns[1]
      if (!g || !v) break
      const map = new Map<string, { sum: number; count: number }>()
      for (const r of rows) {
        const key = String(r[g] ?? "")
        const n = coerceNum(r[v] ?? "") ?? 0
        const cur = map.get(key) ?? { sum: 0, count: 0 }
        cur.sum += n
        cur.count += 1
        map.set(key, cur)
      }
      columns = [g, op.kind === "groupby_mean" ? `${v}_mean` : `${v}_sum`]
      rows = [...map.entries()].map(([key, agg]) => ({
        [g]: key,
        [columns[1]]: op.kind === "groupby_mean" ? agg.sum / agg.count : agg.sum,
      }))
      break
    }
    case "fillna": {
      const fill = op.fillValue ?? ""
      rows = rows.map((r) => {
        const next = { ...r }
        for (const c of columns) {
          if (next[c] === "" || next[c] == null) next[c] = fill
        }
        return next
      })
      break
    }
    case "dropna": {
      const col = op.column
      rows = rows.filter((r) => {
        if (col) return r[col] !== "" && r[col] != null
        return columns.every((c) => r[c] !== "" && r[c] != null)
      })
      break
    }
    default:
      break
  }

  return { columns, rows }
}

async function applyDanfoOp(table: DataTable, op: DataOp): Promise<DataTable | null> {
  if (op.kind !== "describe" && op.kind !== "groupby_sum" && op.kind !== "groupby_mean") {
    return null
  }

  try {
    const dfd = await import("danfojs")
    const df = new dfd.DataFrame(table.rows)

    if (op.kind === "describe") {
      const desc = df.describe()
      const json = dfd.toJSON(desc) as Record<string, unknown>[]
      if (!json?.length) return { columns: table.columns, rows: table.rows }
      const columns = Object.keys(json[0])
      const rows = json.map((row) => {
        const out: Record<string, string | number> = {}
        for (const c of columns) out[c] = String(row[c] ?? "")
        return out
      })
      return { columns, rows }
    }

    const g = op.groupColumn
    const v = op.valueColumn
    if (!g || !v) return null

    const grouped = df.groupby([g])
    const agg = op.kind === "groupby_mean" ? grouped.col([v]).mean() : grouped.col([v]).sum()
    const json = dfd.toJSON(agg) as Record<string, string | number>[]
    const columns = json.length > 0 ? Object.keys(json[0]) : [g, v]
    return { columns, rows: json }
  } catch {
    return null
  }
}

export async function runDataOp(
  table: DataTable,
  op: DataOp,
  useDanfo: boolean,
): Promise<DataOpResult> {
  let usedDanfo = false
  let next = table

  if (useDanfo && (op.kind === "describe" || op.kind === "groupby_sum" || op.kind === "groupby_mean")) {
    const danfoResult = await applyDanfoOp(table, op)
    if (danfoResult) {
      next = danfoResult
      usedDanfo = true
    } else {
      next = applyJsOp(table, op)
    }
  } else if (op.kind === "describe") {
    next = summarizeDescribeJs(table)
    usedDanfo = false
  } else {
    next = applyJsOp(table, op)
  }

  const summary = `${op.kind} → ${next.rows.length} rows × ${next.columns.length} cols${usedDanfo ? " (danfo)" : ""}`
  return { table: next, summary, usedDanfo }
}

function summarizeDescribeJs(table: DataTable): DataTable {
  const numericCols = table.columns.filter((c) =>
    table.rows.some((r) => coerceNum(r[c] ?? "") != null),
  )
  const rows: Record<string, string | number>[] = []
  for (const c of numericCols) {
    const vals = table.rows.map((r) => coerceNum(r[c] ?? "")).filter((n): n is number => n != null)
    if (vals.length === 0) continue
    const sum = vals.reduce((a, b) => a + b, 0)
    const mean = sum / vals.length
    const sorted = [...vals].sort((a, b) => a - b)
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    rows.push({
      column: c,
      count: vals.length,
      mean: mean.toFixed(4),
      min: String(min),
      max: String(max),
    })
  }
  return {
    columns: ["column", "count", "mean", "min", "max"],
    rows: rows.length ? rows : [{ column: "(none)", count: 0, mean: "-", min: "-", max: "-" }],
  }
}

export const DATA_OP_LABELS: Record<DataOpKind, string> = {
  head: "First N rows",
  tail: "Last N rows",
  filter: "Filter rows",
  sort: "Sort by column",
  select: "Select columns",
  unique: "Unique values",
  groupby_sum: "Group by → sum",
  groupby_mean: "Group by → mean",
  describe: "Describe (stats)",
  fillna: "Fill empty cells",
  dropna: "Drop empty rows",
}
