const HANDLE_DB = "nodepad-fs-handles"
const HANDLE_KEY = "linked-file"

async function openHandleDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return null
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore("handles")
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function storeLinkedFileHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openHandleDb()
  if (!db) return
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite")
    tx.objectStore("handles").put(handle, HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getLinkedFileHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openHandleDb()
  if (!db) return null
  const handle = await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
    const tx = db.transaction("handles", "readonly")
    const req = tx.objectStore("handles").get(HANDLE_KEY)
    req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return handle
}

export async function pickNodepadFile(): Promise<File | null> {
  if (!("showOpenFilePicker" in window)) return null
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: "nodepad project",
          accept: { "application/json": [".nodepad", ".json"] },
        },
      ],
      multiple: false,
    })
    await storeLinkedFileHandle(handle)
    return handle.getFile()
  } catch {
    return null
  }
}

export async function saveToLinkedFile(contents: string): Promise<boolean> {
  const handle = await getLinkedFileHandle()
  if (!handle) return false
  try {
    const perm = await handle.queryPermission({ mode: "readwrite" })
    if (perm !== "granted") {
      const req = await handle.requestPermission({ mode: "readwrite" })
      if (req !== "granted") return false
    }
    const writable = await handle.createWritable()
    await writable.write(contents)
    await writable.close()
    return true
  } catch {
    return false
  }
}

export async function pickSaveNodepadFile(suggestedName: string): Promise<boolean> {
  if (!("showSaveFilePicker" in window)) return false
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: "nodepad project",
          accept: { "application/json": [".nodepad"] },
        },
      ],
    })
    await storeLinkedFileHandle(handle)
    return true
  } catch {
    return false
  }
}
