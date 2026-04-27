export interface WorkspaceSnapshot<TProject = unknown> {
  projects: TProject[]
  activeProjectId: string
  backup?: TProject[]
}

const DB_NAME = "nodepad-db"
const DB_VERSION = 1
const STORE_NAME = "kv"

const KEY_PROJECTS = "projects"
const KEY_ACTIVE = "activeProjectId"
const KEY_BACKUP = "backup"

function hasIndexedDB(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined"
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error("IndexedDB is not available"))
      return
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"))
  })
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)

    req.onsuccess = () => resolve((req.result as T | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error(`Failed reading key: ${key}`))
  })
}

function idbSet<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.put(value, key)

    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error(`Failed writing key: ${key}`))
  })
}

export async function loadWorkspaceFromIndexedDB<TProject = unknown>(): Promise<WorkspaceSnapshot<TProject> | null> {
  if (!hasIndexedDB()) return null

  const db = await openDb()
  try {
    const [projects, activeProjectId, backup] = await Promise.all([
      idbGet<TProject[]>(db, KEY_PROJECTS),
      idbGet<string>(db, KEY_ACTIVE),
      idbGet<TProject[]>(db, KEY_BACKUP),
    ])

    if (!projects || projects.length === 0) return null

    return {
      projects,
      activeProjectId: activeProjectId || "",
      backup: backup ?? undefined,
    }
  } finally {
    db.close()
  }
}

export async function saveWorkspaceToIndexedDB<TProject = unknown>(
  projects: TProject[],
  activeProjectId: string,
): Promise<void> {
  if (!hasIndexedDB()) return

  const db = await openDb()
  try {
    await Promise.all([
      idbSet(db, KEY_PROJECTS, projects),
      idbSet(db, KEY_ACTIVE, activeProjectId),
    ])
  } finally {
    db.close()
  }
}

export async function saveWorkspaceBackupToIndexedDB<TProject = unknown>(projects: TProject[]): Promise<void> {
  if (!hasIndexedDB()) return

  const db = await openDb()
  try {
    await idbSet(db, KEY_BACKUP, projects)
  } finally {
    db.close()
  }
}
