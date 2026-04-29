function idbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly")
    const store = tx.objectStore(storeName)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error ?? new Error(`Failed reading key: ${key}`))
  })
}

function idbSet(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    const request = store.put(value, key)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error(`Failed writing key: ${key}`))
  })
}

export function createIndexedDBAdapter(connector) {
  if (!connector?.open) throw new Error("A valid connector is required")
  if (!connector?.storeName) throw new Error("Connector storeName is required")

  async function get(key) {
    const db = await connector.open()
    try {
      return await idbGet(db, connector.storeName, key)
    } finally {
      db.close()
    }
  }

  async function set(key, value) {
    const db = await connector.open()
    try {
      await idbSet(db, connector.storeName, key, value)
    } finally {
      db.close()
    }
  }

  async function getMany(keys) {
    return Promise.all(keys.map((key) => get(key)))
  }

  async function setMany(entries) {
    await Promise.all(entries.map(([key, value]) => set(key, value)))
  }

  return { get, set, getMany, setMany }
}
