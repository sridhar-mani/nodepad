export interface SharePayload {
  title?: string
  text?: string
  url?: string
}

export function parseShareTargetSearchParams(search: string): SharePayload {
  const params = new URLSearchParams(search)
  return {
    title: params.get("title") ?? undefined,
    text: params.get("text") ?? undefined,
    url: params.get("url") ?? undefined,
  }
}

export function sharePayloadToNoteText(payload: SharePayload): string {
  const parts: string[] = []
  if (payload.title) parts.push(payload.title)
  if (payload.text) parts.push(payload.text)
  if (payload.url) parts.push(payload.url)
  return parts.join("\n\n").trim()
}

export async function shareFromApp(data: SharePayload): Promise<boolean> {
  if (!navigator.share) return false
  try {
    await navigator.share({
      title: data.title ?? "nodepad",
      text: data.text,
      url: data.url,
    })
    return true
  } catch {
    return false
  }
}

const QUEUE_KEY = "nodepad-share-queue"

export function enqueueSharePayload(payload: SharePayload) {
  try {
    const existing = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as SharePayload[]
    existing.push(payload)
    localStorage.setItem(QUEUE_KEY, JSON.stringify(existing.slice(-20)))
    window.dispatchEvent(new Event("nodepad-share-queue"))
  } catch {
    /* ignore */
  }
}

export function drainShareQueue(): SharePayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    localStorage.removeItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as SharePayload[]) : []
  } catch {
    return []
  }
}
