"use client"

import type { DataTable } from "@/lib/research/data-ops"

interface SpreadsheetGridProps {
  table: DataTable
  maxRows?: number
  caption?: string
}

export function SpreadsheetGrid({ table, maxRows = 200, caption }: SpreadsheetGridProps) {
  const displayRows = table.rows.slice(0, maxRows)
  const truncated = table.rows.length > maxRows

  if (table.columns.length === 0) {
    return (
      <p className="font-mono text-[10px] text-muted-foreground p-3 text-center">Empty sheet</p>
    )
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      {caption && (
        <div className="px-2 py-1 border-b border-border bg-secondary/30 font-mono text-[10px] text-muted-foreground">
          {caption}
        </div>
      )}
      <div className="overflow-auto max-h-[min(40vh,360px)]">
        <table className="w-full border-collapse text-left font-mono text-[10px]">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              {table.columns.map((col) => (
                <th
                  key={col}
                  className="border-b border-border px-2 py-1.5 font-semibold text-foreground/90 whitespace-nowrap max-w-[140px] truncate"
                  title={col}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, ri) => (
              <tr key={ri} className="odd:bg-secondary/20 hover:bg-secondary/40">
                {table.columns.map((col) => (
                  <td
                    key={col}
                    className="border-b border-border/50 px-2 py-1 text-muted-foreground whitespace-nowrap max-w-[140px] truncate"
                    title={String(row[col] ?? "")}
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-2 py-1 border-t border-border font-mono text-[9px] text-muted-foreground">
        {displayRows.length} rows × {table.columns.length} cols
        {truncated && ` · showing first ${maxRows} of ${table.rows.length}`}
      </div>
    </div>
  )
}
