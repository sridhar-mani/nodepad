"use client"

import { createIndexedDBClient, hasIndexedDB } from "@/lib/indexeddb"
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph/web"
import Letta from "@letta-ai/letta-client"

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue }

export interface AgentMemoryRecord {
  id: string
  projectId: string
  text: string
  category?: string
  contentType?: string
  timestamp: number
}

export interface AgentCheckpoint {
  id: string
  projectId: string
  timestamp: number
  state: JsonValue
}

interface AgentMemoryDB {
  memories: AgentMemoryRecord[]
  checkpoints: AgentCheckpoint[]
  preferences: string[]
  langGraphThreads: Record<string, { projectId: string; query: string; retrieved: AgentMemoryRecord[]; timestamp: number }>
}

const MAX_MEMORY_ITEMS = 600
const MAX_CHECKPOINTS_PER_PROJECT = 30

const memoryClient = createIndexedDBClient({
  dbName: "nodepad-agent-memory",
  storeName: "kv",
  version: 1,
  keyMap: {
    memories: "memories",
    checkpoints: "checkpoints",
    preferences: "preferences",
    langGraphThreads: "langGraphThreads",
  },
})

const MemoryGraphState = Annotation.Root({
  projectId: Annotation<string>(),
  query: Annotation<string>(),
  retrieved: Annotation<AgentMemoryRecord[]>(),
})

const langGraphCheckpointer = new MemorySaver()
const memoryGraph = new StateGraph(MemoryGraphState)
  .addNode("retrieveLocalMemories", async (state) => {
    const retrieved = await retrieveRelevantMemories(state.projectId, state.query, 6)
    return { retrieved }
  })
  .addEdge(START, "retrieveLocalMemories")
  .addEdge("retrieveLocalMemories", END)
  .compile({ checkpointer: langGraphCheckpointer })

let loraDbSingleton: { execute: (query: string, params?: Record<string, unknown>) => Promise<unknown> } | null = null

async function getLoraDb() {
  if (loraDbSingleton) return loraDbSingleton
  try {
    const { createDatabase } = await import("@loradb/lora-wasm/web")
    loraDbSingleton = await createDatabase({ runtime: "auto" })
    return loraDbSingleton
  } catch {
    return null
  }
}

function createId() {
  return Math.random().toString(36).slice(2, 10)
}

async function readDB(): Promise<AgentMemoryDB> {
  if (!hasIndexedDB()) {
    return { memories: [], checkpoints: [], preferences: [], langGraphThreads: {} }
  }

  const snapshot = await memoryClient.accessor.readSnapshot()
  return {
    memories: (snapshot.memories as AgentMemoryRecord[] | null) ?? [],
    checkpoints: (snapshot.checkpoints as AgentCheckpoint[] | null) ?? [],
    preferences: (snapshot.preferences as string[] | null) ?? [],
    langGraphThreads: (snapshot.langGraphThreads as AgentMemoryDB["langGraphThreads"] | null) ?? {},
  }
}

async function writeDB(next: AgentMemoryDB): Promise<void> {
  if (!hasIndexedDB()) return
  await memoryClient.accessor.writeSnapshot(next)
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

function scoreMemory(query: string, memoryText: string): number {
  const q = new Set(tokenize(query))
  const m = new Set(tokenize(memoryText))
  if (q.size === 0 || m.size === 0) return 0

  let overlap = 0
  for (const token of q) {
    if (m.has(token)) overlap += 1
  }
  return overlap / Math.max(1, Math.sqrt(q.size * m.size))
}

export async function rememberNoteMemory(
  projectId: string,
  note: { text: string; category?: string; contentType?: string; timestamp?: number },
): Promise<void> {
  const db = await readDB()
  const item: AgentMemoryRecord = {
    id: createId(),
    projectId,
    text: note.text.slice(0, 1200),
    category: note.category,
    contentType: note.contentType,
    timestamp: note.timestamp ?? Date.now(),
  }

  const memories = [...db.memories, item]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_MEMORY_ITEMS)

  await writeDB({ ...db, memories })

  // Optional local graph backend: link memory nodes by shared project/category.
  const lora = await getLoraDb()
  if (!lora) return
  try {
    await lora.execute(
      `
      CREATE (m:Memory {
        id: $id,
        projectId: $projectId,
        text: $text,
        category: $category,
        contentType: $contentType,
        ts: $ts
      })
      `,
      {
        id: item.id,
        projectId: item.projectId,
        text: item.text,
        category: item.category ?? "",
        contentType: item.contentType ?? "",
        ts: item.timestamp,
      },
    )
  } catch {
    // Best-effort graph indexing only; primary memory store stays IndexedDB.
  }
}

export async function rememberPreferenceMemory(preferenceText: string): Promise<void> {
  const db = await readDB()
  const pref = preferenceText.trim()
  if (!pref) return

  const preferences = [pref, ...db.preferences.filter((p) => p !== pref)].slice(0, 40)
  await writeDB({ ...db, preferences })
}

export async function retrieveRelevantMemories(
  projectId: string,
  query: string,
  limit = 6,
): Promise<AgentMemoryRecord[]> {
  const db = await readDB()
  const indexed = db.memories
    .filter((m) => m.projectId === projectId)
    .map((m) => ({ memory: m, score: scoreMemory(query, `${m.text} ${m.category ?? ""}`) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.memory.timestamp - a.memory.timestamp)
    .map((entry) => entry.memory)

  const lora = await getLoraDb()
  let loraMemories: AgentMemoryRecord[] = []
  if (lora) {
    try {
      const result = await lora.execute(
        `
        MATCH (m:Memory)
        WHERE m.projectId = $projectId
        RETURN m.id AS id, m.projectId AS projectId, m.text AS text, m.category AS category, m.contentType AS contentType, m.ts AS timestamp
        ORDER BY m.ts DESC
        LIMIT 120
        `,
        { projectId },
      ) as unknown
      const rows = Array.isArray((result as { rows?: unknown[] })?.rows)
        ? ((result as { rows: unknown[] }).rows as Array<Record<string, unknown>>)
        : []
      loraMemories = rows
        .map((r) => ({
          id: String(r.id ?? createId()),
          projectId: String(r.projectId ?? projectId),
          text: String(r.text ?? ""),
          category: r.category ? String(r.category) : undefined,
          contentType: r.contentType ? String(r.contentType) : undefined,
          timestamp: Number(r.timestamp ?? Date.now()),
        }))
        .filter((m) => m.text.trim().length > 0)
    } catch {
      loraMemories = []
    }
  }

  const merged = [...indexed, ...loraMemories]
  const deduped = new Map<string, AgentMemoryRecord>()
  for (const m of merged) {
    const key = `${m.projectId}:${m.text}`
    if (!deduped.has(key) || (deduped.get(key)?.timestamp ?? 0) < m.timestamp) {
      deduped.set(key, m)
    }
  }

  return [...deduped.values()]
    .map((m) => ({ memory: m, score: scoreMemory(query, `${m.text} ${m.category ?? ""}`) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.memory.timestamp - a.memory.timestamp)
    .slice(0, limit)
    .map((entry) => entry.memory)
}

export async function retrieveMemoriesViaLangGraph(
  projectId: string,
  query: string,
  limit = 6,
): Promise<AgentMemoryRecord[]> {
  const dbBefore = await readDB()
  const cached = dbBefore.langGraphThreads[`memory-${projectId}`]
  if (cached && cached.query === query) {
    return cached.retrieved.slice(0, limit)
  }

  const result = await memoryGraph.invoke(
    { projectId, query, retrieved: [] },
    { configurable: { thread_id: `memory-${projectId}` } },
  )
  const retrieved = (result.retrieved ?? []).slice(0, limit)
  const dbAfter = await readDB()
  dbAfter.langGraphThreads[`memory-${projectId}`] = {
    projectId,
    query,
    retrieved,
    timestamp: Date.now(),
  }
  await writeDB(dbAfter)
  return retrieved
}

export async function retrievePreferenceMemories(limit = 4): Promise<string[]> {
  const db = await readDB()
  return db.preferences.slice(0, limit)
}

export async function saveAgentCheckpoint(projectId: string, state: JsonValue): Promise<void> {
  const db = await readDB()
  const checkpoint: AgentCheckpoint = {
    id: createId(),
    projectId,
    timestamp: Date.now(),
    state,
  }

  const byProject = [...db.checkpoints, checkpoint]
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_CHECKPOINTS_PER_PROJECT)

  const otherProjects = db.checkpoints.filter((c) => c.projectId !== projectId)
  await writeDB({ ...db, checkpoints: [...otherProjects, ...byProject] })
}

export async function getLatestCheckpoint(projectId: string): Promise<AgentCheckpoint | null> {
  const db = await readDB()
  const latest = db.checkpoints
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => b.timestamp - a.timestamp)[0]
  return latest ?? null
}

// Optional adapters for your target architecture. These are pluggable and safe:
// if the runtime package or config is unavailable, they no-op.
export async function tryRetrieveLettaMemories(_query: string): Promise<string[]> {
  try {
    const raw = localStorage.getItem("nodepad-letta-settings")
    if (!raw) return []
    const cfg = JSON.parse(raw) as { apiKey?: string; baseURL?: string; agentId?: string }
    if (!cfg.apiKey) return []

    const client = new Letta({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL || undefined,
    })

    const results = await client.messages.search({
      query: _query,
      limit: 3,
      ...(cfg.agentId ? { agent_id: cfg.agentId } : {}),
      search_mode: "hybrid",
    })

    return results
      .map((r) => {
        if (!("content" in r)) return ""
        const content = (r as { content?: unknown }).content
        if (typeof content === "string") return content
        if (Array.isArray(content)) {
          return content
            .map((part) => {
              if (typeof part === "string") return part
              if (part && typeof part === "object" && "text" in part) return String((part as { text?: unknown }).text ?? "")
              return ""
            })
            .filter(Boolean)
            .join(" ")
        }
        return ""
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function isLoraWasmAvailable(): Promise<boolean> {
  try {
    await import("@loradb/lora-wasm/web")
    return true
  } catch {
    return false
  }
}
