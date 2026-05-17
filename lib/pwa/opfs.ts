const WORKSPACE_FILE = "workspace.json"
const KNOWLEDGE_DIR = "knowledge"

async function getRoot(): Promise<FileSystemDirectoryHandle | null> {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) return null
  try {
    return await navigator.storage.getDirectory()
  } catch {
    return null
  }
}

export async function writeWorkspaceToOpfs(payload: unknown): Promise<boolean> {
  const root = await getRoot()
  if (!root) return false
  try {
    const handle = await root.getFileHandle(WORKSPACE_FILE, { create: true })
    const writable = await handle.createWritable()
    await writable.write(JSON.stringify(payload))
    await writable.close()
    return true
  } catch (e) {
    console.warn("OPFS workspace write failed", e)
    return false
  }
}

export async function readWorkspaceFromOpfs<T = unknown>(): Promise<T | null> {
  const root = await getRoot()
  if (!root) return null
  try {
    const handle = await root.getFileHandle(WORKSPACE_FILE)
    const file = await handle.getFile()
    const text = await file.text()
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function writeKnowledgeBlobToOpfs(
  docId: string,
  data: ArrayBuffer,
): Promise<boolean> {
  const root = await getRoot()
  if (!root) return false
  try {
    const dir = await root.getDirectoryHandle(KNOWLEDGE_DIR, { create: true })
    const handle = await dir.getFileHandle(`${docId}.bin`, { create: true })
    const writable = await handle.createWritable()
    await writable.write(data)
    await writable.close()
    return true
  } catch {
    return false
  }
}

export async function getOpfsUsage(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { used: usage, quota }
  } catch {
    return null
  }
}
