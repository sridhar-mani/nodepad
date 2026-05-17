"use client"

import { useMemo } from "react"
import { getPerformanceProfile, type PerformanceProfile } from "@/lib/performance-profile"
import { useViewport } from "@/lib/use-viewport"

export function usePerformanceProfile(): PerformanceProfile {
  const { tier } = useViewport()
  return useMemo(() => getPerformanceProfile(tier), [tier])
}
