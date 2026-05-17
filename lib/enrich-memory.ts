import type { PerformanceProfile } from "@/lib/performance-profile"
import type { AgentMemoryRecord } from "@/lib/agent-memory"
import {
  retrieveMemoriesViaLangGraph,
  retrievePreferenceMemories,
  retrieveRelevantMemories,
  tryRetrieveLettaMemories,
} from "@/lib/agent-memory"

/** Fetch memory context for enrichment — respects mobile/tablet cost limits. */
export async function fetchEnrichMemories(
  projectId: string,
  query: string,
  perf: PerformanceProfile,
): Promise<{
  memoryContext: AgentMemoryRecord[]
  preferenceMemories: string[]
  lettaMemories: string[]
}> {
  const limit = perf.enrichMemoryLimit

  const preferenceMemories = await retrievePreferenceMemories(Math.min(3, limit))

  if (limit === 0) {
    return { memoryContext: [], preferenceMemories, lettaMemories: [] }
  }

  const memoryContext = perf.useLangGraphMemory
    ? await retrieveMemoriesViaLangGraph(projectId, query, limit)
    : await retrieveRelevantMemories(projectId, query, limit, {
        skipLora: !perf.useLoraMemory,
      })

  const lettaMemories = perf.useLettaMemory ? await tryRetrieveLettaMemories(query) : []

  return { memoryContext, preferenceMemories, lettaMemories }
}
