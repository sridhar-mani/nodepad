export async function updateAppBadge(count: number): Promise<void> {
  if (!("setAppBadge" in navigator)) return
  try {
    if (count <= 0) await navigator.clearAppBadge()
    else await navigator.setAppBadge(count)
  } catch {
    /* ignore */
  }
}
