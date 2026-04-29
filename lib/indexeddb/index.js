import { createIndexedDBConnector, hasIndexedDB } from "./connector"
import { createIndexedDBAdapter } from "./adapter"
import { createIndexedDBAccessor } from "./accessor"

export { createIndexedDBConnector, hasIndexedDB, createIndexedDBAdapter, createIndexedDBAccessor }

export function createIndexedDBClient(config) {
  const connector = createIndexedDBConnector(config)
  const adapter = createIndexedDBAdapter(connector)
  const accessor = createIndexedDBAccessor(adapter, config.keyMap ?? {})

  return { connector, adapter, accessor }
}
