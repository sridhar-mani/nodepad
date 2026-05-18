"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  Settings,
  Trash2,
  Check,
  X,
  Edit3,
  LayoutGrid,
  ArrowLeft,
  Key,
  ChevronDown,
  Globe,
  Eye,
  EyeOff,
  Save,
  FolderInput,
  RefreshCw,
} from "lucide-react"
import { ThemeToggle } from './theme-toggle'
import {
  getNotificationSupport,
  loadNotificationPrefs,
  requestNotificationPermission,
  saveNotificationPrefs,
} from "@/lib/notifications"
import { AdsPrefsRow } from "@/components/ads-prefs-sync"
import { PwaInstallButton } from "@/components/pwa-install-button"
import { PwaFeaturesPanel } from "@/components/pwa-features-panel"
import {
  AI_PROVIDER_PRESETS,
  MODEL_PRESETS,
  fetchProviderModelsFromRegistry,
  getModelsForProvider,
  getSuggestedModelsForTask,
  getPreset,
  type AIModel,
  type AISettings,
  type AIProvider,
} from "@/lib/ai-settings"

interface Project {
  id: string
  name: string
  blocks: unknown[]
  collapsedIds: string[]
}

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  activeProjectId: string
  onSelectProject: (id: string) => void
  onCreateProject: () => void
  onImportProject: () => void
  onRenameProject: (id: string, newName: string) => void
  onDeleteProject: (id: string) => void
  openToSettings?: boolean
  onSettingsOpened?: () => void
  // AI Settings
  aiSettings: AISettings
  onUpdateAISettings: (patch: Partial<AISettings>) => void
  workspaceJson?: string
  onPwaImportFile?: (file: File) => void
  onPwaSerialCapture?: (text: string) => void
  onPwaOfflineSummary?: (summary: string) => void
}

export function ProjectSidebar({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onImportProject,
  onRenameProject,
  onDeleteProject,
  aiSettings,
  onUpdateAISettings,
  openToSettings,
  onSettingsOpened,
  workspaceJson,
  onPwaImportFile,
  onPwaSerialCapture,
  onPwaOfflineSummary,
}: ProjectSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [presetOpen, setPresetOpen] = useState(false)
  const [providerOpen, setProviderOpen] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string>(MODEL_PRESETS[0].id)
  const [registryModels, setRegistryModels] = useState<AIModel[]>([])
  const [isLoadingRegistryModels, setIsLoadingRegistryModels] = useState(false)
  const [registryModelError, setRegistryModelError] = useState<string | null>(null)
  // local draft for settings (only save on "Save")
  const [draft, setDraft] = useState<AISettings>(aiSettings)
  const [ollamaModels, setOllamaModels] = useState<AIModel[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaError, setOllamaError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [notifPrefs, setNotifPrefs] = useState(() => loadNotificationPrefs())
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default")
  const [themeChoice, setThemeChoice] = useState<'system'|'light'|'dark'>(() => {
    try {
      const t = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
      return t === 'light' || t === 'dark' ? (t as 'light'|'dark') : 'system'
    } catch (e) { return 'system' }
  })

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  // Sync draft when panel opens
  useEffect(() => {
    if (showSettings) {
      setDraft(aiSettings)
      setRegistryModels([])
      setRegistryModelError(null)
      setNotifPrefs(loadNotificationPrefs())
      setNotifPermission(getNotificationSupport())
      // sync theme choice when opening settings
      try {
        const t = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
        setThemeChoice(t === 'light' || t === 'dark' ? (t as 'light'|'dark') : 'system')
      } catch (e) {}
    }
  }, [showSettings])

  useEffect(() => {
    if (!showSettings) return

  // Listen for external theme changes (ThemeToggle or other tabs)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        const t = e.newValue
        setThemeChoice(t === 'light' || t === 'dark' ? (t as 'light'|'dark') : 'system')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

    let cancelled = false
    const loadRegistryModels = async () => {
      setIsLoadingRegistryModels(true)
      setRegistryModelError(null)

      const liveModels = await fetchProviderModelsFromRegistry(
        draft.provider,
        draft.apiKey,
        draft.customBaseUrl ?? "",
      )

      if (cancelled) return

      setRegistryModels(liveModels)
      if (liveModels.length === 0 && draft.apiKey.trim() && draft.provider !== "anthropic") {
        setRegistryModelError("Could not load provider registry. Using curated model list.")
      }
      setIsLoadingRegistryModels(false)
    }

    loadRegistryModels().catch(() => {
      if (cancelled) return
      setRegistryModels([])
      setRegistryModelError("Could not load provider registry. Using curated model list.")
      setIsLoadingRegistryModels(false)
    })

    return () => {
      cancelled = true
    }
  }, [showSettings, draft.provider, draft.apiKey, draft.customBaseUrl])

  // Jump straight to settings when requested externally
  useEffect(() => {
    if (openToSettings) {
      setShowSettings(true)
      onSettingsOpened?.()
    }
  }, [openToSettings])

  const handleRename = (id: string) => {
    if (editName.trim()) onRenameProject(id, editName.trim())
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    onDeleteProject(id)
    setDeletingId(null)
  }

  const persistSettings = () => {
    // Trim key to strip accidental whitespace/newlines from paste
    const trimmedKey = draft.apiKey.trim()
    const providerKeys: Partial<Record<AIProvider, string>> = {
      ...(draft.providerKeys ?? {}),
      [draft.provider]: trimmedKey,
    }
    onUpdateAISettings({ ...draft, apiKey: trimmedKey, providerKeys })
  }

  // Theme controls (Settings panel only)
  const applyTheme = (t: string | null) => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    if (t === 'light' || t === 'dark') {
      root.classList.add(t)
      try { localStorage.setItem('theme', t) } catch (e) {}
    } else {
      try { localStorage.removeItem('theme') } catch (e) {}
      // apply system preference
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark' : 'light')
    }
  }

  const handleSaveSettings = () => {
    persistSettings()
    setShowSettings(false)
  }

  // Auto-save settings when the sidebar closes or when navigating back,
  // so key edits are never silently dropped.
  const handleClose = () => {
    if (showSettings) persistSettings()
    onClose()
  }

  const currentPreset = getPreset(draft.provider)
  const curatedModels = getModelsForProvider(draft.provider)
  const models = registryModels.length > 0 ? registryModels : curatedModels
  const selectedModel = models.find(m => m.id === draft.modelId)
    || curatedModels.find(m => m.id === draft.modelId)
    || models[0]
    || curatedModels[0]
    || undefined
  const isOllama = draft.provider === "ollama"
  const selectedPreset = MODEL_PRESETS.find(p => p.id === selectedPresetId) ?? MODEL_PRESETS[0]
  const suggestedByPreset = getSuggestedModelsForTask(draft.provider, selectedPreset.task, models)

  return (
    <div
      style={{ 
        width: isOpen ? 240 : 0,
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? "visible" : "hidden"
      }}
      className={`fixed inset-y-0 left-0 z-drawer transition-all duration-200 ease-in-out overflow-hidden border-r border-border bg-card/95 backdrop-blur-3xl flex flex-col h-[100dvh] w-[min(92vw,20rem)] sm:w-[min(88vw,17.5rem)] lg:static lg:z-auto lg:h-full lg:w-auto lg:bg-card/85 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div className="w-full lg:w-[240px] flex flex-col h-full">
        {/* Header */}
        <div className="flex h-10 items-center justify-between border-b border-border bg-card/70 backdrop-blur-md px-3 py-1.5 shrink-0">
          <div className="flex items-center gap-2.5">
            {showSettings ? (
              <button
                onClick={handleSaveSettings}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="font-mono text-xs font-bold uppercase tracking-tight">Settings</span>
              </button>
            ) : (
              <>
                <div className="flex items-center justify-center h-5 w-5 bg-primary/10 rounded-sm">
                  <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="font-mono text-xs font-bold uppercase tracking-tight text-foreground/80 select-none">
                  Spaces
                </h2>
              </>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 px-1.5 hover:bg-secondary rounded-sm transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content — animated slide between projects/settings */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait" initial={false}>
            {!showSettings ? (
              <motion.div
                key="projects"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar"
              >
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    className={`group relative rounded-sm transition-all duration-150 ${
                      activeProjectId === project.id 
                        ? "bg-primary/10 shadow-[inset_0_1px_0px_rgba(255,255,255,0.05)]" 
                        : "hover:bg-secondary/60"
                    }`}
                  >
                    <div className="flex items-center p-2 px-2.5">
                      <button
                        onClick={() => onSelectProject(project.id)}
                        className="flex-1 text-left flex flex-col gap-0 overflow-hidden"
                      >
                        {editingId === project.id ? (
                          <input
                            ref={inputRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(project.id)
                              if (e.key === "Escape") setEditingId(null)
                            }}
                            onBlur={() => handleRename(project.id)}
                            className="bg-transparent font-mono text-xs font-bold text-foreground focus:outline-none w-full border-b border-primary/50 py-0"
                          />
                        ) : (
                          <span className={`font-mono text-[12px] font-bold truncate ${
                            activeProjectId === project.id ? "text-primary" : "text-foreground/80 group-hover:text-foreground"
                          }`}>
                            {project.name}
                          </span>
                        )}
                        <span className="font-mono text-[8px] text-muted-foreground uppercase tracking-tighter font-bold">
                          {project.blocks.length} {project.blocks.length === 1 ? 'node' : 'nodes'}
                        </span>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {editingId !== project.id && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditName(project.name)
                                setEditingId(project.id)
                              }}
                              className="p-1 hover:bg-white/10 rounded-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            {projects.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeletingId(project.id)
                                }}
                                className="p-1 hover:bg-destructive/20 rounded-sm text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Delete Confirmation Overlay */}
                    <AnimatePresence>
                      {deletingId === project.id && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0 }}
                          className="absolute inset-0 z-10 bg-destructive/95 backdrop-blur-md rounded-sm flex items-center justify-between px-3"
                        >
                          <span className="font-mono text-[8px] font-bold text-white uppercase tracking-tighter">
                            Delete Space?
                          </span>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleDelete(project.id)}
                              className="p-1 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)}
                              className="p-1 bg-black/30 hover:bg-black/40 rounded-full text-white transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 20, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 overflow-y-auto px-3 py-4 flex flex-col gap-5 custom-scrollbar"
              >
                {/* Provider Selector */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Provider
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setProviderOpen(v => !v)}
                      className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left hover:bg-white/[0.07] focus:outline-none transition-colors"
                    >
                      <span className="font-mono text-[11px] font-bold text-foreground">{currentPreset.label}</span>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${providerOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {providerOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-white/10 bg-popover shadow-xl"
                        >
                          {AI_PROVIDER_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                const newModels = getModelsForProvider(preset.id)
                                setDraft(d => ({
                                  ...d,
                                  provider: preset.id,
                                  modelId: newModels[0]?.id ?? "",
                                  webGrounding: d.webGrounding,
                                  customBaseUrl: "",
                                  // Restore the saved key for this provider if one exists,
                                  // otherwise clear so the user knows to enter a new one.
                                  apiKey: d.providerKeys?.[preset.id] ?? "",
                                }))
                                setRegistryModels([])
                                setRegistryModelError(null)
                                setProviderOpen(false)
                              }}
                              className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-white/5 transition-colors"
                            >
                              <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                draft.provider === preset.id ? "border-primary bg-primary/20" : "border-white/10"
                              }`}>
                                {draft.provider === preset.id && <Check className="h-2.5 w-2.5 text-primary" />}
                              </div>
                              <span className="font-mono text-[10px] font-bold text-foreground">{preset.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* API Key */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {isOllama ? "API Key (Optional)" : "API Key"}
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                    <Key className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <input
                      type="text"
                      value={draft.apiKey}
                      onChange={e => setDraft(d => ({ ...d, apiKey: e.target.value }))}
                      placeholder={currentPreset.keyPlaceholder || "Your API key"}
                      className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                      style={showKey ? undefined : { WebkitTextSecurity: "disc" } as never}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button onClick={() => setShowKey(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    {isOllama
                      ? "Optional for local Ollama. Leave blank when running on localhost. "
                      : "Stored locally. Never sent to a server. "}
                    {currentPreset.keyUrl && (
                      <a href={currentPreset.keyUrl} target="_blank" rel="noopener noreferrer"
                        className="text-primary underline hover:brightness-125 transition-all">
                        Get a key →
                      </a>
                    )}
                  </p>
                </div>

                {/* Custom Base URL */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Custom Base URL
                  </label>
                  <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                    <input
                      type="text"
                      value={draft.customBaseUrl ?? ""}
                      onChange={e => setDraft(d => ({ ...d, customBaseUrl: e.target.value }))}
                      placeholder="Optional — for local/self-hosted endpoints"
                      className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    Override the provider URL. You can enter full URLs or local shorthand like 11434 or localhost:11434.
                  </p>
                </div>

                {/* Notifications (PWA) */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Install &amp; PWA
                  </label>
                  <PwaInstallButton variant="pill" className="w-full justify-center" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Reminders
                  </label>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    Enable browser notifications for deadlines, reminders, and focus timers. Works when the app is installed or open.
                  </p>
                  <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-2.5 py-2">
                    <span className="font-mono text-[10px] text-foreground">Local notifications</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...notifPrefs, enabled: !notifPrefs.enabled }
                        setNotifPrefs(next)
                        saveNotificationPrefs(next)
                      }}
                      className={`relative h-5 w-9 rounded-full transition-colors ${notifPrefs.enabled ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${notifPrefs.enabled ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const p = await requestNotificationPermission()
                      setNotifPermission(p)
                    }}
                    disabled={notifPermission === "unsupported"}
                    className="w-full rounded-md border border-border bg-secondary/40 px-2.5 py-2 font-mono text-[10px] text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-40"
                  >
                    {notifPermission === "unsupported"
                      ? "Notifications not supported"
                      : notifPermission === "granted"
                        ? "Notifications allowed"
                        : "Allow notifications"}
                  </button>
                  <label className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                    Default remind-before (minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={notifPrefs.remindBeforeMin}
                    onChange={(e) => {
                      const next = { ...notifPrefs, remindBeforeMin: Number(e.target.value) || 15 }
                      setNotifPrefs(next)
                      saveNotificationPrefs(next)
                    }}
                    className="w-20 rounded border border-border bg-input px-2 py-1 font-mono text-[10px]"
                  />
                </div>

                <AdsPrefsRow />

                <PwaFeaturesPanel
                  workspaceJson={workspaceJson}
                  onImportFile={onPwaImportFile}
                  onSerialCapture={onPwaSerialCapture}
                  onOfflineSummary={onPwaOfflineSummary}
                />

                {/* Theme Selector */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Theme
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setThemeChoice('system'); applyTheme(null) }}
                      className={`px-2 py-1 rounded-md border transition-colors ${themeChoice === 'system' ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary/50 border-border text-muted-foreground'}`}>
                      System
                    </button>
                    <button
                      onClick={() => { setThemeChoice('light'); applyTheme('light') }}
                      className={`px-2 py-1 rounded-md border transition-colors ${themeChoice === 'light' ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary/50 border-border text-muted-foreground'}`}>
                      Light
                    </button>
                    <button
                      onClick={() => { setThemeChoice('dark'); applyTheme('dark') }}
                      className={`px-2 py-1 rounded-md border transition-colors ${themeChoice === 'dark' ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary/50 border-border text-muted-foreground'}`}>
                      Dark
                    </button>
                  </div>
                </div>

                {/* Model Selector */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Premade
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setPresetOpen(v => !v)}
                      className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left hover:bg-white/[0.07] focus:outline-none transition-colors"
                    >
                      <div>
                        <div className="font-mono text-[11px] font-bold text-foreground">{selectedPreset.label}</div>
                        <div className="font-mono text-[9px] text-muted-foreground mt-0.5">{selectedPreset.description}</div>
                      </div>
                      <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${presetOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {presetOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-white/10 bg-popover shadow-xl"
                        >
                          {MODEL_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                setSelectedPresetId(preset.id)
                                const recommended = getSuggestedModelsForTask(draft.provider, preset.task, models)[0]
                                if (recommended) setDraft(d => ({ ...d, modelId: recommended.id }))
                                setPresetOpen(false)
                              }}
                              className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-white/5 transition-colors"
                            >
                              <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                selectedPreset.id === preset.id ? "border-primary bg-primary/20" : "border-white/10"
                              }`}>
                                {selectedPreset.id === preset.id && <Check className="h-2.5 w-2.5 text-primary" />}
                              </div>
                              <div>
                                <div className="font-mono text-[10px] font-bold text-foreground">{preset.label}</div>
                                <div className="font-mono text-[9px] text-muted-foreground">{preset.description}</div>
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <label className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Model
                  </label>
                  <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                    {registryModels.length > 0 ? "Using live provider registry." : "Using curated model list."}
                    {isLoadingRegistryModels ? " Refreshing..." : ""}
                  </p>
                  {registryModelError && (
                    <p className="font-mono text-[9px] text-amber-500/80 leading-relaxed">{registryModelError}</p>
                  )}
                  {suggestedByPreset.length > 0 && (
                    <p className="font-mono text-[9px] text-primary/80 leading-relaxed">
                      Suggested for {selectedPreset.label}: {suggestedByPreset.slice(0, 2).map(m => m.label).join(" · ")}
                    </p>
                  )}
                  {models.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 focus-within:border-primary/50 transition-colors">
                      <input
                        type="text"
                        value={draft.modelId}
                        onChange={e => setDraft(d => ({ ...d, modelId: e.target.value }))}
                        placeholder="e.g. gpt-4o, claude-3-opus-20240229"
                        className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/40"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <button
                        onClick={() => setModelOpen(v => !v)}
                        className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left hover:bg-white/[0.07] focus:outline-none transition-colors"
                      >
                        <div>
                          <div className="font-mono text-[11px] font-bold text-foreground">{selectedModel?.label ?? draft.modelId}</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5">{selectedModel?.description ?? "Custom model ID"}</div>
                        </div>
                        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${modelOpen ? "rotate-180" : ""}`} />
                      </button>
                      <AnimatePresence>
                        {modelOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.1 }}
                            className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-white/10 bg-popover shadow-xl"
                          >
                            {models.map(model => (
                              <button
                                key={model.id}
                                onClick={() => {
                                  setDraft(d => ({ ...d, modelId: model.id, webGrounding: model.supportsGrounding ? d.webGrounding : false }))
                                  setModelOpen(false)
                                }}
                                className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left hover:bg-white/5 transition-colors"
                              >
                                <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                  draft.modelId === model.id ? "border-primary bg-primary/20" : "border-white/10"
                                }`}>
                                  {draft.modelId === model.id && <Check className="h-2.5 w-2.5 text-primary" />}
                                </div>
                                <div>
                                  <div className="font-mono text-[10px] font-bold text-foreground">{model.label}</div>
                                  <div className="font-mono text-[9px] text-muted-foreground">{model.description}</div>
                                </div>
                                {model.supportsGrounding && (draft.provider === "openrouter" || draft.provider === "openai") && <Globe className="ml-auto h-3 w-3 shrink-0 text-primary/50" />}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  {isOllama && (
                    <p className="font-mono text-[9px] text-muted-foreground leading-relaxed">
                      {ollamaLoading
                        ? "Fetching local models from Ollama..."
                        : ollamaError
                          ? `${ollamaError} You can still type a model ID manually.`
                          : ollamaModels.length > 0
                            ? `Detected ${ollamaModels.length} local model${ollamaModels.length === 1 ? "" : "s"} from Ollama.`
                            : "No local model list yet. Click Refresh or enter model ID manually."}
                    </p>
                  )}
                </div>

                {/* Web Grounding (OpenRouter + OpenAI) */}
                {(draft.provider === "openrouter" || draft.provider === "openai") && selectedModel && (
                  <div className="flex items-start justify-between gap-3 rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-2.5">
                    <div className="flex items-start gap-2">
                      <Globe className="h-3.5 w-3.5 mt-0.5 text-primary/60 shrink-0" />
                      <div>
                        <div className="font-mono text-[11px] font-bold text-foreground">Web Grounding</div>
                        <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-relaxed">
                          {selectedModel.supportsGrounding
                            ? draft.provider === "openai"
                              ? `Uses ${selectedModel.groundingModelId ?? "search-preview"} for live web access`
                              : "Adds :online for live search"
                            : "Not available for this model"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => selectedModel.supportsGrounding && setDraft(d => ({ ...d, webGrounding: !d.webGrounding }))}
                      disabled={!selectedModel.supportsGrounding}
                      className={`relative shrink-0 h-5 w-9 rounded-full transition-all duration-200 ${
                        draft.webGrounding && selectedModel.supportsGrounding ? "bg-primary" : "bg-white/10"
                      } disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${
                        draft.webGrounding && selectedModel.supportsGrounding ? "left-5" : "left-0.5"
                      }`} />
                    </button>
                  </div>
                )}

                {/* API Status */}
                <div className={`flex items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[9px] ${
                  draft.apiKey
                    ? "bg-primary/10 border border-primary/20 text-primary"
                    : "bg-white/5 border border-white/5 text-muted-foreground"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${draft.apiKey ? "bg-primary animate-pulse" : "bg-white/30"}`} />
                  {draft.apiKey
                    ? `${currentPreset.label} — API key configured`
                    : isOllama
                      ? "Ollama local mode — no API key required"
                      : "No API key — AI disabled"}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 bg-black/10 shrink-0">
          {showSettings ? (
            <div className="flex flex-col gap-1.5">
              <button
                onClick={handleSaveSettings}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
              >
                <span>Save Settings</span>
                <Save className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex items-center justify-center w-full h-8 px-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-muted-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-white/5"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-end gap-2 mb-1">
                <ThemeToggle />
              </div>
              <button
                onClick={onCreateProject}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] shadow-sm"
              >
                <span>New Space</span>
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onImportProject}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-white/5"
                title="Import a .nodepad file"
              >
                <span>Import .nodepad</span>
                <FolderInput className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground font-mono text-[9px] font-bold uppercase tracking-[0.1em] transition-all active:scale-[0.98] border border-white/5"
              >
                <span>Settings</span>
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
