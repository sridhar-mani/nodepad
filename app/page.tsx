"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TilingArea } from "@/components/tiling-area"
import { KanbanArea } from "@/components/kanban-area"
import { GraphArea } from "@/components/graph-area"
import { ProjectSidebar } from "@/components/project-sidebar"
import { StatusBar } from "@/components/status-bar"
import { GhostPanel, type GhostNote } from "@/components/ghost-panel"
import { VimInput } from "@/components/vim-input"
import { IntroModal } from "@/components/intro-modal"
import type { TextBlock } from "@/components/tile-card"
import type { ContentType } from "@/lib/content-types"
import { INITIAL_PROJECTS } from "@/lib/initial-data"
import { getPreset, useAISettings } from "@/lib/ai-settings"
import { enrichBlockClient } from "@/lib/ai-enrich"
import { generateGhostClient } from "@/lib/ai-ghost"
import { exportToMarkdown, downloadMarkdown, copyToClipboard } from "@/lib/export"
import { downloadNodepadFile, parseNodepadFile, serialiseProject, NodepadParseError } from "@/lib/nodepad-format"
import { PwaRuntime } from "@/components/pwa-runtime"
import { verifyBiometricLock, hasStoredWebAuthnCredential } from "@/lib/pwa/webauthn"
import { readWorkspaceFromOpfs } from "@/lib/pwa/opfs"
import {
  loadWorkspaceFromIndexedDB,
  saveWorkspaceBackupToIndexedDB,
  saveWorkspaceToIndexedDB,
} from "@/lib/project-storage"
import {
  isLikelyTextFile,
  isLikelyImportableFile,
  mergeKnowledgeDocs,
  type KnowledgeDocument,
} from "@/lib/knowledge-base"
import { ingestResearchFiles } from "@/lib/research/ingest"
import { fetchStockQuote, formatQuoteNote } from "@/lib/research/finance-client"
import { formatCitation } from "@/lib/research/citations"
import { ResearchToolkitPanel } from "@/components/research-toolkit-panel"
import { ImportPreviewPanel } from "@/components/import-preview-panel"
import { findKnowledgeGapSuggestions } from "@/lib/knowledge-graph"
import { normalizeConfidencePercent } from "@/lib/confidence"
import { applySchedulePatch, type SchedulePatch } from "@/lib/scheduling"
import { ReminderEngine } from "@/components/reminder-engine"
import { PanelBackdrop } from "@/components/panel-backdrop"
import { ViewModeBar } from "@/components/view-mode-bar"
import { AiKeyBanner } from "@/components/ai-key-banner"
import { useViewport } from "@/lib/use-viewport"
import { usePerformanceProfile } from "@/lib/use-performance-profile"
import { capBlocksForDisplay } from "@/lib/cap-blocks"
import { fetchEnrichMemories } from "@/lib/enrich-memory"
import {
  buildKnowledgeDocumentsFromFilesInWorker,
  findKnowledgeMatchesInWorker,
  detectContentTypeInWorker,
} from "@/lib/worker-client"
import {
  rememberNoteMemory,
  rememberPreferenceMemory,
  saveAgentCheckpoint,
} from "@/lib/agent-memory"

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

function isKnowledgeLikeInput(text: string, type?: ContentType): boolean {
  if (type === "reference" || type === "definition") return true
  const trimmed = text.trim()
  if (/^https?:\/\//i.test(trimmed)) return true
  if (/^kb:\/\//i.test(trimmed)) return true
  if (/^!\[[^\]]*\]\(data:image\//i.test(trimmed)) return true
  return false
}

export interface Project {
  id: string
  name: string
  blocks: TextBlock[]
  collapsedIds: string[]
  ghostNotes: GhostNote[]
  knowledgeDocuments?: KnowledgeDocument[]
  lastGhostBlockCount?: number
  lastGhostTimestamp?: number
  /** Texts of recently generated ghost notes — passed back to the API to prevent near-duplicates */
  lastGhostTexts?: string[]
}

import { TileIndex } from "@/components/tile-index"

export default function Page() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string>("")
  const [highlightedBlockId, setHighlightedBlockId] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isIndexOpen, setIsIndexOpen] = useState(false)
  const [isGhostPanelOpen, setIsGhostPanelOpen] = useState(false)
  const [isResearchPanelOpen, setIsResearchPanelOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<
    | {
        kind: "knowledge"
        sourceLabel: string
        docs: KnowledgeDocument[]
        previews: string[]
      }
    | {
        kind: "project"
        sourceLabel: string
        project: Project
      }
    | {
        kind: "note"
        sourceLabel: string
        text: string
      }
    | null
  >(null)
  const [viewMode, setViewMode] = useState<"tiling" | "kanban" | "graph">("tiling")
  const [isCommandKOpen, setIsCommandKOpen] = useState(false)
  const [jumpToSettings, setJumpToSettings] = useState(false)
  const [isIntroOpen, setIsIntroOpen] = useState(false)
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const helpTooltipTimer = useRef<NodeJS.Timeout | null>(null)
  const { settings, updateSettings, resolvedModelId, currentModel, isHydrated } = useAISettings()
  const providerPreset = getPreset(settings.provider)
  const aiReady = settings.provider === "ollama" || Boolean(settings.apiKey)
  const debounceTimers = useRef<Record<string, Record<string, NodeJS.Timeout>>>({})
  const { isCompact, isMobile, isTablet, tier } = useViewport()
  const perf = usePerformanceProfile()
  const perfRef = useRef(perf)
  perfRef.current = perf

  // ── Undo history ring (max 20 block snapshots per project) ───────────────
  const blockHistoryRef = useRef<Record<string, TextBlock[][]>>({})
  const [undoToast, setUndoToast] = useState<string | null>(null)
  const undoToastTimer = useRef<NodeJS.Timeout | null>(null)

  const pushHistory = useCallback((projectId: string, currentBlocks: TextBlock[]) => {
    if (!blockHistoryRef.current[projectId]) blockHistoryRef.current[projectId] = []
    const stack = blockHistoryRef.current[projectId]
    stack.push(currentBlocks.map(b => ({ ...b })))
    if (stack.length > 20) stack.shift()
  }, [])

  const showUndoToast = useCallback((msg: string) => {
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current)
    setUndoToast(msg)
    undoToastTimer.current = setTimeout(() => setUndoToast(null), 2200)
  }, [])

  // Clean up undo toast timer on unmount
  useEffect(() => () => {
    if (undoToastTimer.current) clearTimeout(undoToastTimer.current)
  }, [])

  // ── Intro modal ──────────────────────────────────────────────────────────
  const handleIntroClose = useCallback(() => {
    setIsIntroOpen(false)
    localStorage.setItem("nodepad-intro-seen", "true")
    // Show the help tooltip for 6 seconds pointing to the ? button
    setShowHelpTooltip(true)
    if (helpTooltipTimer.current) clearTimeout(helpTooltipTimer.current)
    helpTooltipTimer.current = setTimeout(() => setShowHelpTooltip(false), 6000)
  }, [])

  useEffect(() => () => {
    if (helpTooltipTimer.current) clearTimeout(helpTooltipTimer.current)
  }, [])

  const undo = useCallback(() => {
    const stack = blockHistoryRef.current[activeProjectId]
    if (!stack || stack.length === 0) {
      showUndoToast("Nothing to undo")
      return
    }
    const previousBlocks = stack.pop()!
    setProjects(prev => prev.map(p => p.id === activeProjectId
      ? { ...p, blocks: previousBlocks }
      : p
    ))
    showUndoToast("↩ Undone")
  }, [activeProjectId, showUndoToast])

  const activeProject = useMemo(() =>
    projects.find(p => p.id === activeProjectId) || projects[0],
  [projects, activeProjectId])

  const blocks = activeProject?.blocks || []
  const ghostNotes = activeProject?.ghostNotes || []

  const knowledgeGapSuggestions = useMemo(() => {
    if (perf.knowledgeGapLimit === 0) return []
    const scoped = capBlocksForDisplay(blocks, perf.knowledgeGapMaxBlocks)
    return findKnowledgeGapSuggestions(
      scoped,
      activeProject?.knowledgeDocuments ?? [],
      perf.knowledgeGapLimit,
    )
  }, [blocks, activeProject?.knowledgeDocuments, perf.knowledgeGapLimit, perf.knowledgeGapMaxBlocks])

  const closeOverlayPanels = useCallback(() => {
    setIsSidebarOpen(false)
    setIsIndexOpen(false)
    setIsGhostPanelOpen(false)
    setIsResearchPanelOpen(false)
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((open) => {
      const next = !open
      if (next && isCompact) {
        setIsIndexOpen(false)
        setIsGhostPanelOpen(false)
        setIsResearchPanelOpen(false)
      }
      return next
    })
  }, [isCompact])

  const toggleIndex = useCallback(() => {
    setIsIndexOpen((open) => {
      const next = !open
      if (next && isCompact) {
        setIsSidebarOpen(false)
        setIsGhostPanelOpen(false)
        setIsResearchPanelOpen(false)
      }
      return next
    })
  }, [isCompact])

  const toggleGhostPanel = useCallback(() => {
    setIsGhostPanelOpen((open) => {
      const next = !open
      if (next && isCompact) {
        setIsSidebarOpen(false)
        setIsIndexOpen(false)
        setIsResearchPanelOpen(false)
      }
      return next
    })
  }, [isCompact])

  const toggleResearchPanel = useCallback(() => {
    setIsResearchPanelOpen((open) => {
      const next = !open
      if (next && isCompact) {
        setIsSidebarOpen(false)
        setIsIndexOpen(false)
        setIsGhostPanelOpen(false)
      }
      return next
    })
  }, [isCompact])

  useEffect(() => {
    if (!isLoaded) return
    try {
      if (localStorage.getItem("nodepad-default-view-set")) return
      if (isMobile || isTablet) setViewMode("kanban")
      localStorage.setItem("nodepad-default-view-set", "1")
    } catch {
      /* ignore */
    }
  }, [isLoaded, isMobile, isTablet])

  const workspaceJson = useMemo(() => {
    if (!activeProject) return undefined
    try {
      return JSON.stringify(serialiseProject(activeProject))
    } catch {
      return undefined
    }
  }, [activeProject])

  const updateActiveProject = useCallback((updater: (p: Project) => Project) => {
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updater(p) : p))
  }, [activeProjectId])

  // Clear debounce timers for the previous project when switching
  const prevActiveProjectId = useRef<string | null>(null)
  useEffect(() => {
    const prev = prevActiveProjectId.current
    if (prev && prev !== activeProjectId && debounceTimers.current[prev]) {
      Object.values(debounceTimers.current[prev]).forEach(clearTimeout)
      delete debounceTimers.current[prev]
    }
    prevActiveProjectId.current = activeProjectId
  }, [activeProjectId])

  // 1. Persistence: Initial Load & Migration
  useEffect(() => {
    let cancelled = false

    const loadWorkspace = async () => {
      let initialProjects: Project[] = []
      let initialActiveId = ""
      let loadedFromLegacyStorage = false

      try {
        const indexed = await loadWorkspaceFromIndexedDB<Project>()
        if (indexed?.projects?.length) {
          initialProjects = indexed.projects
          initialActiveId = indexed.activeProjectId || indexed.projects[0]?.id || ""
        }
      } catch (error) {
        console.warn("IndexedDB load failed; attempting legacy localStorage migration", error)
      }

      if (initialProjects.length === 0) {
        loadedFromLegacyStorage = true
        const savedProjects = localStorage.getItem("nodepad-projects")
        const savedActiveId = localStorage.getItem("nodepad-active-project")
        const oldBlocks = localStorage.getItem("nodepad-blocks")
        const oldCollapsed = localStorage.getItem("nodepad-collapsed")
        const backupProjects = localStorage.getItem("nodepad-backup")

        if (savedProjects) {
          try {
            initialProjects = JSON.parse(savedProjects)
            initialActiveId = savedActiveId || initialProjects[0]?.id || ""
          } catch (e) {
            console.error("Failed to parse saved projects — trying backup", e)
          }
        }

        if (initialProjects.length === 0 && backupProjects) {
          try {
            initialProjects = JSON.parse(backupProjects)
            initialActiveId = initialProjects[0]?.id || ""
            console.info("Restored from nodepad-backup")
          } catch (e) {
            console.error("Backup restore also failed", e)
          }
        }

        if (initialProjects.length === 0 && oldBlocks) {
          try {
            const blks = JSON.parse(oldBlocks)
            const collapsed = oldCollapsed ? JSON.parse(oldCollapsed) : []
            const defaultProject: Project = {
              id: "default",
              name: "Default Space",
              blocks: blks,
              collapsedIds: collapsed,
              ghostNotes: [],
            }
            initialProjects = [defaultProject]
            initialActiveId = "default"
          } catch (e) {
            console.error("Migration failed", e)
          }
        }
      }

      if (initialProjects.length === 0) {
        const opfs = await readWorkspaceFromOpfs<{ projects?: Project[]; activeProjectId?: string }>()
        if (opfs?.projects?.length) {
          initialProjects = opfs.projects
          initialActiveId = opfs.activeProjectId || opfs.projects[0]?.id || ""
        }
      }

      if (initialProjects.length === 0) {
        initialProjects = INITIAL_PROJECTS
        initialActiveId = INITIAL_PROJECTS[0].id
      }

      if (cancelled) return

      if (hasStoredWebAuthnCredential()) {
        const unlocked = await verifyBiometricLock()
        if (!unlocked && !cancelled) {
          console.warn("Biometric unlock failed — continuing in read-only spirit")
        }
      }

      setProjects(initialProjects)
      setActiveProjectId(initialActiveId)
      setIsLoaded(true)

      if (!localStorage.getItem("nodepad-intro-seen")) {
        setIsIntroOpen(true)
      }

      if (loadedFromLegacyStorage) {
        saveWorkspaceToIndexedDB(initialProjects, initialActiveId).catch(error => {
          console.warn("Initial IndexedDB migration save failed", error)
        })
      }
    }

    loadWorkspace().catch(error => {
      console.error("Workspace load failed", error)
      if (!cancelled) {
        setProjects(INITIAL_PROJECTS)
        setActiveProjectId(INITIAL_PROJECTS[0].id)
        setIsLoaded(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  // 2. Persistence: Save on Change
  useEffect(() => {
    if (!isLoaded) return
    saveWorkspaceToIndexedDB(projects, activeProjectId).catch(error => {
      console.warn("IndexedDB workspace save failed", error)
    })
  }, [projects, activeProjectId, isLoaded])

  // 3. Silent rolling backup — debounced on phone/tablet to reduce IndexedDB churn.
  useEffect(() => {
    if (!isLoaded || projects.length === 0) return
    const save = () => saveWorkspaceBackupToIndexedDB(projects).catch(() => {})
    if (perf.backupDebounceMs <= 0) {
      save()
      return
    }
    const t = window.setTimeout(save, perf.backupDebounceMs)
    return () => clearTimeout(t)
  }, [projects, isLoaded, perf.backupDebounceMs])

  // 4. Agent checkpointing — debounced + smaller slice on compact viewports.
  useEffect(() => {
    if (!isLoaded || !activeProjectId) return
    const active = projects.find((p) => p.id === activeProjectId)
    if (!active) return

    const save = () => {
      const checkpointState = JSON.parse(JSON.stringify({
        activeProjectId,
        projectName: active.name,
        blocks: active.blocks.slice(-perf.checkpointBlockCap),
        collapsedIds: active.collapsedIds,
        ghostNotes: active.ghostNotes.slice(-8),
      }))
      saveAgentCheckpoint(activeProjectId, checkpointState).catch(() => {})
    }
    if (perf.checkpointDebounceMs <= 0) {
      save()
      return
    }
    const t = window.setTimeout(save, perf.checkpointDebounceMs)
    return () => clearTimeout(t)
  }, [projects, activeProjectId, isLoaded, perf.checkpointDebounceMs, perf.checkpointBlockCap])

  // Persist user preference signals for agent memory retrieval.
  useEffect(() => {
    if (!isHydrated) return
    rememberPreferenceMemory(`Preferred provider: ${settings.provider}`).catch(() => {})
    rememberPreferenceMemory(`Preferred model: ${settings.modelId}`).catch(() => {})
    rememberPreferenceMemory(`Web grounding: ${settings.webGrounding ? "enabled" : "disabled"}`).catch(() => {})
  }, [isHydrated, settings.provider, settings.modelId, settings.webGrounding])

  // Hidden file input for .nodepad import — triggered from sidebar or ⌘K
  const importInputRef = useRef<HTMLInputElement>(null)

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string
        const names = projectsRef.current.map(p => p.name)
        const imported = parseNodepadFile(raw, names) as Project
        setPendingImport({ kind: "project", sourceLabel: file.name, project: imported })
      } catch (err) {
        if (err instanceof NodepadParseError) {
          alert(err.message)
        } else {
          alert("Could not import file — make sure it's a valid .nodepad file.")
        }
      }
    }
    reader.readAsText(file)
    // Reset input so the same file can be re-imported if needed
    e.target.value = ""
  }, [])

  // A ref to read current projects without causing re-renders or stale closures
  const projectsRef = useRef(projects)
  useEffect(() => { projectsRef.current = projects }, [projects])

  // Stable ref to active blocks — lets useCallbacks read current blocks without
  // listing `blocks` in their deps (which would recreate them on every state change
  // and cause all memo-ized TileCards to re-render unnecessarily).
  const blocksRef = useRef<TextBlock[]>([])
  useEffect(() => { blocksRef.current = blocks }, [blocks])

  // Tracks which project IDs currently have a ghost generation in-flight
  const generatingRef = useRef<Set<string>>(new Set())

  /**
   * Builds a recency-biased, category-diverse context window for ghost generation.
   * Strategy:
   *   1. Always include the 4 most recently added blocks (freshest thinking).
   *   2. Then add the single most-recent block from every category not yet represented.
   *   3. Fill remaining slots (up to 10 total) with the next most-recent blocks.
   * This forces the model to see cross-category material rather than a wall of the
   * dominant theme.
   */
  function buildGhostContext(enrichedBlocks: TextBlock[]) {
    if (enrichedBlocks.length <= 8) return enrichedBlocks

    const sorted = [...enrichedBlocks].sort((a, b) => b.timestamp - a.timestamp)
    const selected = new Set<string>()
    const result: TextBlock[] = []

    // Step 1 — most recent 4
    sorted.slice(0, 4).forEach(b => { selected.add(b.id); result.push(b) })

    // Step 2 — one representative per missing category
    const representedCats = new Set(result.map(b => b.category))
    const byCat = new Map<string, TextBlock>()
    sorted.forEach(b => {
      if (b.category && !byCat.has(b.category)) byCat.set(b.category, b)
    })
    for (const [cat, block] of byCat) {
      if (result.length >= 10) break
      if (!representedCats.has(cat) && !selected.has(block.id)) {
        selected.add(block.id)
        result.push(block)
        representedCats.add(cat)
      }
    }

    // Step 3 — fill to 10 with remaining recent blocks
    for (const b of sorted) {
      if (result.length >= 10) break
      if (!selected.has(b.id)) { selected.add(b.id); result.push(b) }
    }

    return result
  }

  const generateGhostNote = useCallback(async (projectId: string) => {
    const targetProject = projectsRef.current.find(p => p.id === projectId)

    if (!targetProject) return

    // Require at least 5 enriched blocks
    const enrichedBlocks = targetProject.blocks.filter(b => !b.isEnriching && b.category)
    if (enrichedBlocks.length < 5) return

    // Cap panel at 5 ghost notes
    if ((targetProject.ghostNotes || []).length >= 5) return

    // No concurrent generation for this project
    if (generatingRef.current.has(projectId)) return

    // Require at least 5 new blocks since last generation
    const lastCount = targetProject.lastGhostBlockCount || 0
    if (enrichedBlocks.length < lastCount + 5) return

    // Require at least 5 minutes since last generation
    const lastTime = targetProject.lastGhostTimestamp || 0
    const fiveMinutes = 5 * 60 * 1000
    if (Date.now() - lastTime < fiveMinutes) return

    // Require at least 2 distinct categories (meaningful diversity)
    const categories = new Set(enrichedBlocks.map(b => b.category).filter(Boolean))
    if (categories.size < 2) return

    generatingRef.current.add(projectId)
    const ghostId = "ghost-" + generateId()

    setProjects(prev => prev.map(p => p.id === projectId ? {
      ...p,
      ghostNotes: [...(p.ghostNotes || []), { id: ghostId, text: "", category: "thesis", isGenerating: true }],
      lastGhostBlockCount: enrichedBlocks.length,
      lastGhostTimestamp: Date.now()
    } : p))

    try {
      const curated = buildGhostContext(enrichedBlocks)
      const ghostQuery = curated.map((b) => b.text).join("\n").slice(0, 2000)
      const { memoryContext, preferenceMemories, lettaMemories } = await fetchEnrichMemories(
        projectId,
        ghostQuery,
        { ...perfRef.current, enrichMemoryLimit: perfRef.current.ghostMemoryLimit },
      )

      const context = [
        ...curated.map(b => ({
          text: b.text,
          category: b.category,
          contentType: b.contentType,
        })),
        ...memoryContext.map((m) => ({
          text: `[Memory] ${m.text}`,
          category: m.category || "Memory",
          contentType: m.contentType,
        })),
        ...lettaMemories.map((m) => ({
          text: `[Letta] ${m}`,
          category: "Agent Memory",
          contentType: "reference",
        })),
        ...preferenceMemories.map((p) => ({
          text: `[Preference] ${p}`,
          category: "Preference",
          contentType: "reference",
        })),
      ]

      // Pass the last 5 generated ghost texts so the model can avoid near-duplicates
      const previousSyntheses = (targetProject.lastGhostTexts || []).slice(-5)

      const kbHints = findKnowledgeGapSuggestions(
        capBlocksForDisplay(enrichedBlocks, perfRef.current.knowledgeGapMaxBlocks),
        targetProject.knowledgeDocuments ?? [],
        perfRef.current.knowledgeGapLimit,
      ).map(
        (g) =>
          `Note "${g.blockPreview}…" may relate to "${g.docTitle}": ${g.snippet.slice(0, 120)}`,
      )

      const data = await generateGhostClient(context, previousSyntheses, kbHints)
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p
        return {
          ...p,
          ghostNotes: (p.ghostNotes || []).map(n =>
            n.id === ghostId ? { ...n, text: data.text, category: data.category, isGenerating: false } : n
          ),
          // Accumulate ghost texts for dedup (keep last 10)
          lastGhostTexts: [...(p.lastGhostTexts || []), data.text].slice(-10),
        }
      }))
    } catch (e) {
      console.error("Ghost note generation failed", e)
      setProjects(prev => prev.map(p => p.id === projectId
        ? { ...p, ghostNotes: (p.ghostNotes || []).filter(n => n.id !== ghostId) }
        : p
      ))
    } finally {
      generatingRef.current.delete(projectId)
    }
  }, [])

  const enrichBlock = useCallback(async (projectId: string, id: string, text: string, category?: string, forcedType?: string) => {
    // Read context directly from the ref — avoids wrapping in setProjects() which
    // React StrictMode double-invokes in development, causing two concurrent
    // enrichment requests and a visible category flicker.
    const targetProject = projectsRef.current.find(p => p.id === projectId)
    if (!targetProject) return

    const context = targetProject.blocks
      .filter((b) => b.id !== id && !b.isEnriching)
      .map((b) => ({
        id: b.id,
        text: b.text,
        category: b.category,
        annotation: b.annotation,
      }))
      .slice(-perfRef.current.enrichContextBlocks)

    const { memoryContext, preferenceMemories, lettaMemories } = await fetchEnrichMemories(
      projectId,
      text,
      perfRef.current,
    )
    const memoryAsContext = memoryContext.map((m, idx) => ({
      id: `memory-${idx}`,
      text: `[Memory] ${m.text}`,
      category: m.category ?? "Memory",
      annotation: "Retrieved from persistent memory",
    }))
    const preferenceAsContext = preferenceMemories.map((p, idx) => ({
      id: `preference-${idx}`,
      text: `[User Preference] ${p}`,
      category: "Preference",
      annotation: "Retrieved user style preference",
    }))
    const lettaAsContext = lettaMemories.map((m, idx) => ({
      id: `letta-${idx}`,
      text: `[Letta Memory] ${m}`,
      category: "Agent Memory",
      annotation: "Retrieved from Letta message memory",
    }))

    const groundTruthNotes = targetProject.blocks
      .filter(b => b.id !== id && b.isGroundTruth)
      .map(b => ({ id: b.id, text: b.text, category: b.category }))
      .slice(-8)

    const knowledgeMatches = await findKnowledgeMatchesInWorker(
      text,
      targetProject.knowledgeDocuments ?? [],
      perfRef.current.kbMatchLimit,
    )

    try {
      const combinedContext = [...context, ...memoryAsContext, ...preferenceAsContext, ...lettaAsContext]
      const data = await enrichBlockClient(
        text,
        combinedContext.map(({ id, ...rest }) => ({ id, ...rest })),
        forcedType,
        category,
        knowledgeMatches,
        groundTruthNotes,
      )

      // Map indices back to stable block IDs — the context array carries
      // the original block IDs so we get exact, rename-proof references.
      const influencedBy = data.influencedByIndices
        ? (data.influencedByIndices as number[])
            .map((idx) => combinedContext[idx]?.id)
            .filter((v): v is string => Boolean(v) && !v.startsWith("memory-") && !v.startsWith("preference-") && !v.startsWith("letta-"))
        : []

      rememberNoteMemory(projectId, {
        text,
        category: data.category,
        contentType: data.contentType,
      }).catch(() => {})

      setProjects((current: Project[]) => {
        const mergeTargetIdx = data.mergeWithIndex
        const mergeTargetId =
          mergeTargetIdx !== null &&
          combinedContext[mergeTargetIdx] &&
          !String(combinedContext[mergeTargetIdx].id).startsWith("memory-") &&
          !String(combinedContext[mergeTargetIdx].id).startsWith("preference-") &&
          !String(combinedContext[mergeTargetIdx].id).startsWith("letta-")
            ? combinedContext[mergeTargetIdx].id
            : null

        return current.map(proj => {
          if (proj.id !== projectId) return proj

          if (mergeTargetId) {
            return {
              ...proj,
              blocks: proj.blocks
                .filter(b => b.id !== id)
                .map(b => b.id === mergeTargetId ? {
                  ...b,
                  text: b.text + "\n\n" + text,
                  contentType: data.contentType,
                  category: data.category,
                  annotation: data.annotation,
                  confidence: normalizeConfidencePercent(data.confidence),
                  influencedBy,
                  isUnrelated: data.isUnrelated,
                  sources: [...(data.sources ?? []), ...(data.knowledgeSources ?? [])],
                  isGroundTruth:
                    b.isGroundTruth ||
                    data.contentType === "reference" ||
                    data.contentType === "definition" ||
                    ((data.knowledgeSources?.length ?? 0) > 0),
                  isEnriching: false,
                  statusText: undefined,
                  isError: false,
                } : b)
            }
          }
          if (data.contentType === "task") {
            const existingTaskIndex = proj.blocks.findIndex(b => b.contentType === "task" && b.id !== id)
            if (existingTaskIndex !== -1) {
              const existingTask = proj.blocks[existingTaskIndex]
              const newSubTask = {
                id: Math.random().toString(36).substring(2, 9),
                text: text,
                isDone: false,
                timestamp: Date.now()
              }
              return {
                ...proj,
                blocks: proj.blocks
                  .filter(b => b.id !== id)
                  .map(b => b.id === existingTask.id ? {
                    ...b,
                    subTasks: [...(b.subTasks || []), newSubTask],
                    isEnriching: false,
                    statusText: undefined
                  } : b)
              }
            } else {
              return {
                ...proj,
                blocks: proj.blocks.map(b => b.id === id ? {
                  ...b,
                  contentType: "task",
                  category: "Tasks",
                  subTasks: [{
                    id: Math.random().toString(36).substring(2, 9),
                    text: text,
                    isDone: false,
                    timestamp: Date.now()
                  }],
                  isEnriching: false,
                  statusText: undefined,
                  isError: false
                } : b)
              }
            }
          }

          return {
            ...proj,
            blocks: proj.blocks.map(b => b.id === id ? {
              ...b,
              contentType: data.contentType,
              category: data.category,
              annotation: data.annotation,
              confidence: normalizeConfidencePercent(data.confidence),
              influencedBy,
              isUnrelated: data.isUnrelated,
              sources: [...(data.sources ?? []), ...(data.knowledgeSources ?? [])],
              isGroundTruth:
                b.isGroundTruth ||
                data.contentType === "reference" ||
                data.contentType === "definition" ||
                ((data.knowledgeSources?.length ?? 0) > 0),
              isEnriching: false,
              statusText: undefined,
              isError: false,
            } : b)
          }
        })
      })

      setTimeout(() => generateGhostNote(projectId), 2500)
    } catch (e: any) {
      console.warn(e)
      const isNoKey = e?.message?.includes("No API key") || e?.message?.includes("Invalid or missing API key") || false
      const errorStatus = isNoKey ? "no-api-key" : (e instanceof Error ? e.message : undefined)
      setProjects((current: Project[]) => current.map(proj => proj.id === projectId ? {
        ...proj,
        blocks: proj.blocks.map(b => b.id === id ? { ...b, isEnriching: false, isError: true, statusText: errorStatus } : b)
      } : proj))
    }
  }, [generateGhostNote])

  const claimGhostNote = useCallback((id: string) => {
    const note = (activeProject?.ghostNotes || []).find(n => n.id === id)
    if (!note || note.isGenerating) return
    const newId = generateId()
    const { text, category } = note

    updateActiveProject(p => {
      const updatedProject = {
        ...p,
        blocks: [...p.blocks, {
          id: newId,
          text,
          timestamp: Date.now(),
          contentType: "thesis" as ContentType,
          category,
          isEnriching: false,
          annotation: "Generated synthesis from the ghost panel.",
        }],
        ghostNotes: (p.ghostNotes || []).filter(n => n.id !== id),
      }
      return updatedProject
    })
  }, [activeProject, updateActiveProject])

  const dismissGhostNote = useCallback((id: string) => {
    updateActiveProject(p => ({
      ...p,
      ghostNotes: (p.ghostNotes || []).filter(n => n.id !== id),
    }))
  }, [updateActiveProject])

  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsCommandKOpen(prev => !prev)
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        // Don't intercept while typing in an input/textarea
        const tag = (e.target as HTMLElement).tagName
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault()
          undo()
        }
      }
      if (e.key === "Escape") {
        if (isCommandKOpen) {
          setIsCommandKOpen(false)
        } else if (isGhostPanelOpen) {
          setIsGhostPanelOpen(false)
        }
      }
    }
    window.addEventListener("keydown", handleKeys)
    return () => window.removeEventListener("keydown", handleKeys)
  }, [isCommandKOpen, isGhostPanelOpen, undo])

  const addBlock = useCallback(
    (text: string, forcedType?: ContentType) => {
      // Parse inline #type tag  e.g. "#claim The earth is 4.5 billion years old"
      let resolvedText = text
      let resolvedType = forcedType

      if (!resolvedType) {
        const tagMatch = text.match(/^#([a-z]+)\s+(.+)/i)
        if (tagMatch) {
          const tag = tagMatch[1].toLowerCase() as ContentType
          const ALL_TYPES: ContentType[] = [
            "entity", "claim", "question", "task", "idea", "reference",
            "quote", "definition", "opinion", "reflection", "narrative",
            "comparison", "thesis", "general"
          ]
          if (ALL_TYPES.includes(tag)) {
            resolvedType = tag
            resolvedText = tagMatch[2].trim()
          }
        }
      }

      const newId = generateId()

      // Types where the heuristic is syntactically unambiguous — the AI is also
      // sent forcedType so it won't reclassify them.  We can show these types
      // immediately because they will never change after enrichment.
      const heuristicType = resolvedType ?? "general"
      const HIGH_CONFIDENCE_TYPES = new Set<ContentType>(["question", "reference", "quote", "task"])
      const enrichForcedType = resolvedType

      // Start as general while worker+AI classify in the background.
      const initialDisplayType: ContentType = resolvedType ?? "general"
      const autoGroundTruth = isKnowledgeLikeInput(resolvedText, resolvedType ?? heuristicType)

      pushHistory(activeProjectId, blocksRef.current)
      updateActiveProject(p => ({
        ...p,
        blocks: [...p.blocks, {
          id: newId,
          text: resolvedText,
          timestamp: Date.now(),
          contentType: initialDisplayType,
          isGroundTruth: autoGroundTruth,
          isEnriching: true,
        }]
      }))

      setIsCommandKOpen(false)

      if (!resolvedType) {
        detectContentTypeInWorker(resolvedText)
          .then((detected) => {
            if (!HIGH_CONFIDENCE_TYPES.has(detected)) return
            setProjects(current => current.map(p => p.id === activeProjectId ? {
              ...p,
              blocks: p.blocks.map(b => b.id === newId ? { ...b, contentType: detected } : b),
            } : p))
          })
          .catch(() => {
            // Best effort only.
          })
      }

      enrichBlock(activeProjectId, newId, resolvedText, undefined, enrichForcedType).catch(console.error)
    },
    [activeProjectId, pushHistory, updateActiveProject, enrichBlock]
  )

  const handlePwaShortcut = useCallback((action: string) => {
    if (action === "capture") {
      document.querySelector<HTMLInputElement>('[cmdk-input]')?.focus()
    } else if (action === "synthesis") {
      setIsGhostPanelOpen(true)
    } else if (action === "settings") {
      setJumpToSettings(true)
      setIsSidebarOpen(true)
    } else if (action.startsWith("view-")) {
      const mode = action.replace("view-", "") as "tiling" | "kanban" | "graph"
      if (mode === "tiling" || mode === "kanban" || mode === "graph") setViewMode(mode)
    }
  }, [])

  const handleShareImport = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setPendingImport({ kind: "note", sourceLabel: "Shared text", text: trimmed })
  }, [addBlock])

  const handlePwaImportFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const names = projects.map((p) => p.name)
        const imported = parseNodepadFile(String(reader.result), names) as Project
        setPendingImport({ kind: "project", sourceLabel: file.name, project: imported })
      } catch (err) {
        console.error(err)
      }
    }
    reader.readAsText(file)
  }, [projects])

  const addReferenceImageBlock = useCallback((imageDataUrl: string, fileName: string) => {
    const refText = `![${fileName}](${imageDataUrl})\n\nImage reference: ${fileName}`
    addBlock(refText, "reference")
  }, [addBlock])

  const appendKnowledgeImport = useCallback((
    docs: KnowledgeDocument[],
    previewBodies: string[],
  ) => {
    if (docs.length === 0) return
    const now = Date.now()
    setProjects(current => current.map(p => {
      if (p.id !== activeProjectId) return p

      const mergedDocs = mergeKnowledgeDocs(p.knowledgeDocuments ?? [], docs)
      const appendedNotes: TextBlock[] = docs.map((doc, idx) => ({
        id: generateId(),
        text: previewBodies[idx] ?? `Knowledge: ${doc.title}`,
        timestamp: now + idx,
        contentType: "reference",
        category: "Knowledge Base",
        isGroundTruth: true,
        isEnriching: false,
        isError: false,
        annotation: "User-supplied knowledge document. Treated as ground truth.",
        sources: [{ url: `kb://${doc.id}`, title: doc.title, siteName: "Knowledge Base" }],
      }))

      return {
        ...p,
        knowledgeDocuments: mergedDocs,
        blocks: [...p.blocks, ...appendedNotes],
      }
    }))
  }, [activeProjectId])

  const stageKnowledgeImport = useCallback((
    sourceLabel: string,
    docs: KnowledgeDocument[],
    previews: string[],
  ) => {
    if (docs.length === 0) return
    setPendingImport({ kind: "knowledge", sourceLabel, docs, previews })
  }, [])

  const confirmKnowledgeImport = useCallback(() => {
    if (!pendingImport || pendingImport.kind !== "knowledge") return
    appendKnowledgeImport(pendingImport.docs, pendingImport.previews)
    setPendingImport(null)
  }, [appendKnowledgeImport, pendingImport])

  const confirmPendingImport = useCallback(() => {
    if (!pendingImport) return

    if (pendingImport.kind === "knowledge") {
      appendKnowledgeImport(pendingImport.docs, pendingImport.previews)
    } else if (pendingImport.kind === "project") {
      setProjects((prev) => [...prev, pendingImport.project])
      setActiveProjectId(pendingImport.project.id)
      setIsSidebarOpen(false)
    } else if (pendingImport.kind === "note") {
      addBlock(pendingImport.text, "reference")
    }

    setPendingImport(null)
  }, [addBlock, appendKnowledgeImport, pendingImport])

  const cancelKnowledgeImport = useCallback(() => {
    setPendingImport(null)
  }, [])

  const addKnowledgeFiles = useCallback(async (files: File[]) => {
    const importable = files.filter(isLikelyImportableFile)
    if (importable.length === 0) return

    const textFiles = importable.filter(isLikelyTextFile)
    const binaryFiles = importable.filter(f => !isLikelyTextFile(f))

    let built: KnowledgeDocument[] = []
    const previews: string[] = []

    if (textFiles.length > 0) {
      try {
        const fromWorker = await buildKnowledgeDocumentsFromFilesInWorker(textFiles)
        for (const doc of fromWorker.filter(d => d.rawText.trim())) {
          built.push(doc)
          previews.push(
            `Knowledge: ${doc.title}\n\n${doc.rawText.slice(0, 420)}${doc.rawText.length > 420 ? "…" : ""}`,
          )
        }
      } catch {
        // fall through — binary ingest may still succeed
      }
    }

    if (binaryFiles.length > 0) {
      const ingested = await ingestResearchFiles(binaryFiles, tier)
      for (const item of ingested) {
        built.push(item.document)
        previews.push(item.previewNote)
      }
    }

    stageKnowledgeImport("Knowledge files", built, previews)
  }, [activeProjectId, tier, stageKnowledgeImport])

  const importResearchDocuments = useCallback((
    docs: KnowledgeDocument[],
    previewNotes: string[],
  ) => {
    stageKnowledgeImport("Research toolkit", docs, previewNotes)
  }, [stageKnowledgeImport])

  const addResearchNote = useCallback((markdown: string) => {
    addBlock(markdown, "reference")
  }, [addBlock])

  const deleteBlock = useCallback((id: string) => {
    pushHistory(activeProjectId, blocksRef.current)
    updateActiveProject(p => ({
      ...p,
      blocks: p.blocks.filter(b => b.id !== id)
    }))
  }, [activeProjectId, pushHistory, updateActiveProject])

  const editBlock = useCallback((id: string, newText: string) => {
    // Snapshot before the edit so Cmd+Z restores the original text
    const currentProj = projectsRef.current.find(p => p.id === activeProjectId)
    if (currentProj) {
      const currentBlock = currentProj.blocks.find(b => b.id === id)
      if (currentBlock && currentBlock.text !== newText) {
        pushHistory(activeProjectId, currentProj.blocks)
      }
    }

    setProjects(prev => {
      const proj = prev.find(p => p.id === activeProjectId)
      if (!proj) return prev
      const block = proj.blocks.find(b => b.id === id)
      if (!block || block.text === newText) return prev

      if (!debounceTimers.current[activeProjectId]) {
        debounceTimers.current[activeProjectId] = {}
      }

      if (debounceTimers.current[activeProjectId][id]) {
        clearTimeout(debounceTimers.current[activeProjectId][id])
      }

      debounceTimers.current[activeProjectId][id] = setTimeout(() => {
        enrichBlock(activeProjectId, id, newText, block.category).catch(console.error)
        delete debounceTimers.current[activeProjectId][id]
      }, 800)

      return prev.map(p => p.id === activeProjectId ? {
        ...p,
        blocks: p.blocks.map(b => b.id === id ? { ...b, text: newText, isEnriching: true, isError: false } : b)
      } : p)
    })
  }, [activeProjectId, enrichBlock, pushHistory])

  const reEnrichBlock = useCallback((id: string, newCategory?: string) => {
    const block = blocksRef.current.find(b => b.id === id)
    if (!block) return

    updateActiveProject(p => ({
      ...p,
      blocks: p.blocks.map(b => b.id === id ? { ...b, category: newCategory, isEnriching: true } : b)
    }))

    enrichBlock(activeProjectId, id, block.text, newCategory || block.category, block.contentType).catch(console.error)
  }, [activeProjectId, updateActiveProject, enrichBlock])

  const editAnnotation = useCallback((id: string, newAnnotation: string) => {
    updateActiveProject(p => ({
      ...p,
      blocks: p.blocks.map(b => b.id === id ? { ...b, annotation: newAnnotation } : b)
    }))
  }, [updateActiveProject])

  const toggleCollapse = useCallback((id: string) => {
    updateActiveProject(p => {
      const next = new Set(p.collapsedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...p, collapsedIds: [...next] }
    })
  }, [updateActiveProject])

  const handleTogglePin = useCallback((id: string) => {
    setProjects((current) => current.map(p => p.id === activeProjectId ? {
      ...p,
      blocks: p.blocks.map(b => b.id === id ? { ...b, isPinned: !b.isPinned } : b)
    } : p))
  }, [activeProjectId])

  const handleToggleGroundTruth = useCallback((id: string) => {
    setProjects((current) => current.map(p => p.id === activeProjectId ? {
      ...p,
      blocks: p.blocks.map(b => b.id === id ? { ...b, isGroundTruth: !b.isGroundTruth } : b)
    } : p))
  }, [activeProjectId])

  const handleToggleSubTask = useCallback((blockId: string, subTaskId: string) => {
    setProjects((current) => current.map(p => p.id === activeProjectId ? {
      ...p,
      blocks: p.blocks.map(b => b.id === blockId ? {
        ...b,
        subTasks: b.subTasks?.map(st => st.id === subTaskId ? { ...st, isDone: !st.isDone } : st)
      } : b)
    } : p))
  }, [activeProjectId])

  const handleUpdateSchedule = useCallback(
    (blockId: string, patch: SchedulePatch, subTaskId?: string) => {
      updateActiveProject((p) => ({
        ...p,
        blocks: p.blocks.map((b) => {
          if (b.id !== blockId) return b
          if (subTaskId) {
            return {
              ...b,
              subTasks: b.subTasks?.map((st) =>
                st.id === subTaskId ? applySchedulePatch(st, patch) : st,
              ),
            }
          }
          return applySchedulePatch(b, patch)
        }),
      }))
    },
    [updateActiveProject],
  )

  const handleDeleteSubTask = useCallback((blockId: string, subTaskId: string) => {
    setProjects((current) => current.map(p => p.id === activeProjectId ? {
      ...p,
      blocks: p.blocks.map(b => b.id === blockId ? {
        ...b,
        subTasks: b.subTasks?.filter(st => st.id !== subTaskId)
      } : b)
    } : p))
  }, [activeProjectId])

  const handleChangeType = useCallback((id: string, newType: ContentType) => {
    const block = blocksRef.current.find(b => b.id === id)
    if (!block) return
    pushHistory(activeProjectId, blocksRef.current)
    updateActiveProject(p => ({
      ...p,
      blocks: p.blocks.map(b => b.id === id ? { ...b, contentType: newType, isEnriching: true } : b)
    }))
    enrichBlock(activeProjectId, id, block.text, block.category, newType).catch(console.error)
  }, [activeProjectId, pushHistory, updateActiveProject, enrichBlock])

  const clearBlocks = useCallback(() => {
    pushHistory(activeProjectId, blocksRef.current)
    updateActiveProject(p => ({ ...p, blocks: [], collapsedIds: [] }))
  }, [activeProjectId, pushHistory, updateActiveProject])

  const createProject = useCallback(() => {
    const newProject: Project = {
      id: generateId(),
      name: "New Space",
      blocks: [],
      collapsedIds: [],
      ghostNotes: [],
    }
    setProjects(prev => [...prev, newProject])
    setActiveProjectId(newProject.id)
  }, [])

  const renameProject = useCallback((id: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => {
      if (prev.length <= 1) return prev
      const nextProjects = prev.filter(p => p.id !== id)
      if (activeProjectId === id) {
        setActiveProjectId(nextProjects[0].id)
      }
      return nextProjects
    })
  }, [activeProjectId])

  const handleCommand = useCallback((cmd: string, text?: string) => {
    setIsCommandKOpen(false)
    
    // Handle view switches
    if (cmd === "kanban") {
      setViewMode("kanban")
    } else if (cmd === "tiling") {
      setViewMode("tiling")
    } else if (cmd === "graph") {
      setViewMode("graph")
    } else if (cmd === "open-projects") {
      setIsGhostPanelOpen(false)
      setIsIndexOpen(false)
      setIsSidebarOpen(prev => !prev)
    } else if (cmd === "new-project") {
      setIsGhostPanelOpen(false)
      setIsIndexOpen(false)
      setIsSidebarOpen(true)
      createProject()
    } else if (cmd === "open-index") {
      setIsSidebarOpen(false)
      setIsGhostPanelOpen(false)
      setIsIndexOpen(prev => !prev)
    } else if (cmd === "open-synthesis") {
      setIsSidebarOpen(false)
      setIsIndexOpen(false)
      setIsResearchPanelOpen(false)
      setIsGhostPanelOpen(prev => !prev)
    } else if (cmd === "open-research" || cmd === "research") {
      setIsSidebarOpen(false)
      setIsIndexOpen(false)
      setIsGhostPanelOpen(false)
      setIsResearchPanelOpen(prev => !prev)
    } else if (cmd === "finance" && text?.trim()) {
      void (async () => {
        try {
          const q = await fetchStockQuote(text.trim())
          addBlock(formatQuoteNote(q), "reference")
        } catch (e) {
          addBlock(
            `Finance lookup failed: ${e instanceof Error ? e.message : "unknown error"}`,
            "reference",
          )
        }
      })()
    } else if (cmd === "cite" && text?.trim()) {
      void (async () => {
        try {
          const formatted = await formatCitation(text.trim())
          addBlock(`## Citation\n\n${formatted}`, "reference")
        } catch (e) {
          addBlock(
            `Citation failed: ${e instanceof Error ? e.message : "unknown error"}`,
            "reference",
          )
        }
      })()
    } else if (cmd === "clear") clearBlocks()
    else if (cmd === "help") window.open("https://github.com/albingroen/react-cmdk", "_blank")
    
    // .nodepad export / import
    else if (cmd === "export-nodepad") {
      setProjects(prev => {
        const proj = prev.find(p => p.id === activeProjectId)
        if (proj) downloadNodepadFile(proj)
        return prev
      })
    } else if (cmd === "import-nodepad") {
      importInputRef.current?.click()
    }

    // Export commands — read project from state snapshot via ref to avoid stale closure
    else if (cmd === "export-md") {
      setProjects(prev => {
        const proj = prev.find(p => p.id === activeProjectId)
        if (proj) {
          const md = exportToMarkdown(proj.name, proj.blocks)
          const slug = proj.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
          downloadMarkdown(`${slug}.md`, md)
        }
        return prev
      })
    } else if (cmd === "copy-md") {
      setProjects(prev => {
        const proj = prev.find(p => p.id === activeProjectId)
        if (proj) {
          const md = exportToMarkdown(proj.name, proj.blocks)
          copyToClipboard(md)
        }
        return prev
      })
    }
    
    // Handle type overrides
    else if (cmd === "task" && text) addBlock(text, "task")
    else if (cmd === "thesis" && text) addBlock(text, "thesis")
    
    setIsCommandKOpen(false)
  }, [clearBlocks, addBlock, activeProjectId, createProject])

  const showPanelBackdrop =
    isCompact && (isSidebarOpen || isIndexOpen || isGhostPanelOpen || isResearchPanelOpen)

  useEffect(() => {
    if (typeof document === "undefined") return
    document.body.classList.toggle("panel-overlay-open", showPanelBackdrop)
    if (showPanelBackdrop) setIsCommandKOpen(false)
    return () => document.body.classList.remove("panel-overlay-open")
  }, [showPanelBackdrop, setIsCommandKOpen])

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <PanelBackdrop visible={showPanelBackdrop} onClose={closeOverlayPanels} />

      {/* Hidden file input for .nodepad import */}
      <input
        ref={importInputRef}
        type="file"
        accept=".nodepad,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      <ProjectSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onCreateProject={createProject}
        onRenameProject={renameProject}
        onDeleteProject={deleteProject}
        onImportProject={() => importInputRef.current?.click()}
        aiSettings={settings}
        onUpdateAISettings={updateSettings}
        openToSettings={jumpToSettings}
        onSettingsOpened={() => setJumpToSettings(false)}
        workspaceJson={workspaceJson}
        onPwaImportFile={handlePwaImportFile}
        onPwaSerialCapture={handleShareImport}
        onPwaOfflineSummary={(summary) => addBlock(`[Offline summary] ${summary}`, "idea")}
      />

      <div className="app-main-column flex flex-1 flex-col overflow-hidden min-w-0">
        <StatusBar
          blockCount={blocks.length}
          blocks={blocks}
          isSidebarOpen={isSidebarOpen}
          isIndexOpen={isIndexOpen}
          isGhostPanelOpen={isGhostPanelOpen}
          ghostNoteCount={ghostNotes.filter(n => !n.isGenerating).length}
          activeProjectName={activeProject?.name || ""}
          onMenuClick={toggleSidebar}
          onIndexToggle={toggleIndex}
          onGhostPanelToggle={toggleGhostPanel}
          isResearchPanelOpen={isResearchPanelOpen}
          onResearchPanelToggle={toggleResearchPanel}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          compact={isCompact}
          modelLabel={isHydrated && aiReady ? currentModel.shortLabel : undefined}
          showHelpTooltip={showHelpTooltip}
          onHelpTooltipDismiss={() => {
            setShowHelpTooltip(false)
            if (helpTooltipTimer.current) clearTimeout(helpTooltipTimer.current)
          }}
        />

        {isHydrated && !aiReady && (
          <AiKeyBanner
            providerLabel={providerPreset.label}
            keyUrl={providerPreset.keyUrl}
            onOpenSettings={() => {
              setIsSidebarOpen(true)
              setJumpToSettings(true)
            }}
          />
        )}

        <div className="flex flex-1 overflow-hidden relative min-h-0 min-w-0">
          <main className="app-workspace-scroll relative flex-1 min-w-0 overflow-auto overflow-x-hidden">
            {isLoaded ? (
              viewMode === "tiling" ? (
                <TilingArea
                  key={`tiling-${activeProjectId}`}
                  blocks={activeProject.blocks}
                  collapsedIds={new Set(activeProject.collapsedIds)}
                  onDelete={deleteBlock}
                  onEdit={editBlock}
                  onEditAnnotation={editAnnotation}
                  onReEnrich={reEnrichBlock}
                  onChangeType={handleChangeType}
                  onToggleCollapse={toggleCollapse}
                  onTogglePin={handleTogglePin}
                  onToggleGroundTruth={handleToggleGroundTruth}
                  onToggleSubTask={handleToggleSubTask}
                  onDeleteSubTask={handleDeleteSubTask}
                  onUpdateSchedule={handleUpdateSchedule}
                  highlightedBlockId={highlightedBlockId}
                  onHighlight={setHighlightedBlockId}
                />
              ) : viewMode === "kanban" ? (
                <KanbanArea
                  key={`kanban-${activeProjectId}`}
                  blocks={activeProject.blocks}
                  onDelete={deleteBlock}
                  onEdit={editBlock}
                  onEditAnnotation={editAnnotation}
                  onReEnrich={reEnrichBlock}
                  onChangeType={handleChangeType}
                  onToggleCollapse={toggleCollapse}
                  onTogglePin={handleTogglePin}
                  onToggleGroundTruth={handleToggleGroundTruth}
                  onToggleSubTask={handleToggleSubTask}
                  onDeleteSubTask={handleDeleteSubTask}
                  onUpdateSchedule={handleUpdateSchedule}
                  collapsedIds={new Set(activeProject.collapsedIds)}
                />
              ) : (
                <GraphArea
                  key={`graph-${activeProjectId}`}
                  blocks={activeProject.blocks}
                  knowledgeDocuments={activeProject.knowledgeDocuments ?? []}
                  ghostNote={ghostNotes[ghostNotes.length - 1]}
                  projectName={activeProject.name}
                  onReEnrich={reEnrichBlock}
                  onChangeType={handleChangeType}
                  onTogglePin={handleTogglePin}
                  onToggleGroundTruth={handleToggleGroundTruth}
                  onEdit={editBlock}
                  onEditAnnotation={editAnnotation}
                  highlightedBlockId={highlightedBlockId}
                  onHighlight={setHighlightedBlockId}
                />
              )
            ) : (
              <div className="h-full w-full" />
            )}
          </main>

          <GhostPanel
            ghostNotes={ghostNotes}
            knowledgeSuggestions={knowledgeGapSuggestions}
            isOpen={isGhostPanelOpen}
            onClose={() => setIsGhostPanelOpen(false)}
            onClaim={claimGhostNote}
            onAddKnowledgeSuggestion={(text) => addBlock(text, "reference")}
            onDismiss={dismissGhostNote}
          />

          <ResearchToolkitPanel
            isOpen={isResearchPanelOpen}
            onClose={() => setIsResearchPanelOpen(false)}
            tier={tier}
            onImportDocuments={importResearchDocuments}
            onAddResearchNote={addResearchNote}
          />
        </div>

        <ImportPreviewPanel
          open={pendingImport !== null}
          sourceLabel={pendingImport?.sourceLabel ?? "Knowledge files"}
          mode={pendingImport?.kind ?? "knowledge"}
          documents={pendingImport?.kind === "knowledge" ? pendingImport.docs : []}
          previewNotes={pendingImport?.kind === "knowledge" ? pendingImport.previews : []}
          noteText={pendingImport?.kind === "note" ? pendingImport.text : ""}
          projectPreview={pendingImport?.kind === "project" ? {
            name: pendingImport.project.name,
            blocks: pendingImport.project.blocks.length,
            knowledgeDocs: pendingImport.project.knowledgeDocuments?.length ?? 0,
            ghostNotes: pendingImport.project.ghostNotes?.length ?? 0,
            collapsed: pendingImport.project.collapsedIds.length,
          } : undefined}
          isConfirming={false}
          onCancel={cancelKnowledgeImport}
          onConfirm={confirmPendingImport}
        />

        {/* Undo toast */}
        <AnimatePresence>
          {undoToast && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed left-1/2 -translate-x-1/2 pointer-events-none max-lg:bottom-[calc(var(--mobile-chrome-h)+0.5rem)] lg:absolute lg:bottom-20"
              style={{ zIndex: "var(--z-toast)" }}
            >
              <div className="px-3 py-1.5 rounded-sm bg-popover border border-border backdrop-blur-md shadow-xl">
                <span className="font-mono text-[10px] text-muted-foreground tracking-tight whitespace-nowrap">{undoToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="app-mobile-chrome shrink-0">
          <ViewModeBar value={viewMode} onChange={setViewMode} />
          <VimInput
            onSubmit={addBlock}
            onSubmitReferenceImage={addReferenceImageBlock}
            onSubmitKnowledgeFiles={addKnowledgeFiles}
            onCommand={handleCommand}
            isCommandKOpen={isCommandKOpen}
            setIsCommandKOpen={setIsCommandKOpen}
            compact={isCompact}
            overlayOpen={showPanelBackdrop}
          />
        </footer>
      </div>

      <TileIndex 
        blocks={blocks} 
        onHighlight={setHighlightedBlockId} 
        highlightedId={highlightedBlockId}
        onClose={() => setIsIndexOpen(false)}
        isOpen={isIndexOpen}
        viewMode={viewMode}
      />

      <PwaRuntime
        projects={projects}
        isLoaded={isLoaded}
        onShortcut={handlePwaShortcut}
        onShareNote={handleShareImport}
      />

      <ReminderEngine projects={projects} />

      <IntroModal open={isIntroOpen} onClose={handleIntroClose} />

    </div>
  )
}
