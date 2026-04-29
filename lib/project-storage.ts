import { createIndexedDBClient, hasIndexedDB } from "@/lib/indexeddb"

export interface WorkspaceSnapshot<TProject = unknown> {
  projects: TProject[]
  activeProjectId: string
  backup?: TProject[]
}

const storageClient = createIndexedDBClient({
  dbName: "nodepad-db",
  storeName: "kv",
  version: 1,
  keyMap: {
    projects: "projects",
    activeProjectId: "activeProjectId",
    backup: "backup",
  },
})

export async function loadWorkspaceFromIndexedDB<TProject = unknown>(): Promise<WorkspaceSnapshot<TProject> | null> {
  if (!hasIndexedDB()) return null

  const snapshot = await storageClient.accessor.readSnapshot()
  const projects = (snapshot.projects as TProject[] | null) ?? null
  if (!projects || projects.length === 0) return null

  return {
    projects,
    activeProjectId: (snapshot.activeProjectId as string | null) ?? "",
    backup: ((snapshot.backup as TProject[] | null) ?? undefined),
  }
}

export async function saveWorkspaceToIndexedDB<TProject = unknown>(
  projects: TProject[],
  activeProjectId: string,
): Promise<void> {
  if (!hasIndexedDB()) return

  await storageClient.accessor.writeSnapshot({
    projects,
    activeProjectId,
  })
}

export async function saveWorkspaceBackupToIndexedDB<TProject = unknown>(projects: TProject[]): Promise<void> {
  if (!hasIndexedDB()) return
  await storageClient.accessor.write("backup", projects)
}
