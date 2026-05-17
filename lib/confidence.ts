/** Normalize model confidence to an integer 0–100 for display and storage. */
export function normalizeConfidencePercent(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null
  let n = Number(value)
  if (n <= 1 && n >= 0) n = n * 100
  else if (n > 0 && n < 2) n = n * 100
  return Math.min(100, Math.max(0, Math.round(n)))
}
