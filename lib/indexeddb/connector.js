const DEFAULT_DB_VERSION = 1

export function hasIndexedDB() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined"
}

export function createIndexedDBConnector({ dbName, storeName, version = DEFAULT_DB_VERSION }) {
  if (!dbName) throw new Error("dbName is required")
  if (!storeName) throw new Error("storeName is required")

  async function open() {
    return new Promise((resolve, reject) => {
      if (!hasIndexedDB()) {
        reject(new Error("IndexedDB is not available"))
        return
      }

      const request = window.indexedDB.open(dbName, version)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"))
    })
  }

  return { open, dbName, storeName, version }
}
