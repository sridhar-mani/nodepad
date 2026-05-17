const SYNC_TAG = "nodepad-workspace-sync"

export async function pushWorkspaceToEdge(payload: unknown): Promise<boolean> {
  try {
    const res = await fetch("/api/pwa-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ts: Date.now(), payload }),
      keepalive: true,
    })
    return res.ok
  } catch {
    return false
  }
}

export async function registerBackgroundSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    await reg.sync.register(SYNC_TAG)
  } catch {
    /* Background Sync not available */
  }
}

export async function registerPeriodicSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return
  const periodic = (navigator.serviceWorker.ready as Promise<ServiceWorkerRegistration>).then(
    async (reg) => {
      const ps = (reg as ServiceWorkerRegistration & { periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> } }).periodicSync
      if (ps) await ps.register("nodepad-periodic", { minInterval: 12 * 60 * 60 * 1000 })
    },
  )
  await periodic.catch(() => {})
}

export { SYNC_TAG }
