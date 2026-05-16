export function createIndexedDBAccessor(adapter, keyMap) {
  if (!adapter?.get || !adapter?.set) throw new Error("A valid adapter is required")
  if (!keyMap || typeof keyMap !== "object") throw new Error("A valid keyMap is required")

  async function read(name) {
    const key = keyMap[name]
    if (!key) throw new Error(`Unknown key map entry: ${name}`)
    return adapter.get(key)
  }

  async function write(name, value) {
    const key = keyMap[name]
    if (!key) throw new Error(`Unknown key map entry: ${name}`)
    return adapter.set(key, value)
  }

  async function readSnapshot() {
    const names = Object.keys(keyMap)
    const values = await Promise.all(names.map((name) => read(name)))

    return names.reduce((acc, name, index) => {
      acc[name] = values[index]
      return acc
    }, {})
  }

  async function writeSnapshot(payload) {
    const entries = Object.entries(payload)
    await Promise.all(entries.map(([name, value]) => write(name, value)))
  }

  return { read, write, readSnapshot, writeSnapshot }
}
