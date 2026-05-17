import type { ViewportTier } from "@/lib/use-viewport"

/** Tier-based limits — keep phones cool and responsive. */
export interface PerformanceProfile {
  tier: ViewportTier
  enrichContextBlocks: number
  enrichMemoryLimit: number
  useLangGraphMemory: boolean
  useLettaMemory: boolean
  useLoraMemory: boolean
  ghostMemoryLimit: number
  graphMaxBlocks: number
  graphTickThrottleMs: number
  graphAlphaDecay: number
  graphResizeThrottleMs: number
  knowledgeGapLimit: number
  knowledgeGapMaxBlocks: number
  kbMatchLimit: number
  persistenceDebounceMs: number
  backupDebounceMs: number
  checkpointDebounceMs: number
  checkpointBlockCap: number
  skipEdgeSync: boolean
  opfsDebounceMs: number
  reminderIntervalMs: number
}

const MOBILE: PerformanceProfile = {
  tier: "mobile",
  enrichContextBlocks: 8,
  enrichMemoryLimit: 2,
  useLangGraphMemory: false,
  useLettaMemory: false,
  useLoraMemory: false,
  ghostMemoryLimit: 1,
  graphMaxBlocks: 36,
  graphTickThrottleMs: 48,
  graphAlphaDecay: 0.028,
  graphResizeThrottleMs: 200,
  knowledgeGapLimit: 2,
  knowledgeGapMaxBlocks: 40,
  kbMatchLimit: 2,
  persistenceDebounceMs: 0,
  backupDebounceMs: 4000,
  checkpointDebounceMs: 6000,
  checkpointBlockCap: 60,
  skipEdgeSync: true,
  opfsDebounceMs: 3000,
  reminderIntervalMs: 60_000,
}

const TABLET: PerformanceProfile = {
  tier: "tablet",
  enrichContextBlocks: 12,
  enrichMemoryLimit: 3,
  useLangGraphMemory: false,
  useLettaMemory: false,
  useLoraMemory: false,
  ghostMemoryLimit: 2,
  graphMaxBlocks: 56,
  graphTickThrottleMs: 32,
  graphAlphaDecay: 0.018,
  graphResizeThrottleMs: 120,
  knowledgeGapLimit: 3,
  knowledgeGapMaxBlocks: 80,
  kbMatchLimit: 3,
  persistenceDebounceMs: 0,
  backupDebounceMs: 2000,
  checkpointDebounceMs: 4000,
  checkpointBlockCap: 90,
  skipEdgeSync: false,
  opfsDebounceMs: 1500,
  reminderIntervalMs: 45_000,
}

const DESKTOP: PerformanceProfile = {
  tier: "desktop",
  enrichContextBlocks: 15,
  enrichMemoryLimit: 5,
  useLangGraphMemory: true,
  useLettaMemory: true,
  useLoraMemory: true,
  ghostMemoryLimit: 3,
  graphMaxBlocks: 200,
  graphTickThrottleMs: 0,
  graphAlphaDecay: 0.012,
  graphResizeThrottleMs: 0,
  knowledgeGapLimit: 4,
  knowledgeGapMaxBlocks: 500,
  kbMatchLimit: 4,
  persistenceDebounceMs: 0,
  backupDebounceMs: 0,
  checkpointDebounceMs: 0,
  checkpointBlockCap: 120,
  skipEdgeSync: false,
  opfsDebounceMs: 0,
  reminderIntervalMs: 30_000,
}

export function getPerformanceProfile(tier: ViewportTier): PerformanceProfile {
  if (tier === "mobile") return MOBILE
  if (tier === "tablet") return TABLET
  return DESKTOP
}
