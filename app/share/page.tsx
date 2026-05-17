"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { enqueueSharePayload, parseShareTargetSearchParams } from "@/lib/pwa/share"

function ShareRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const payload = parseShareTargetSearchParams(searchParams.toString())
    if (payload.title || payload.text || payload.url) {
      enqueueSharePayload(payload)
    }
    router.replace("/?from=share")
  }, [router, searchParams])

  return (
    <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
      Adding shared content…
    </p>
  )
}

export default function ShareTargetPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Suspense fallback={<p className="font-mono text-xs text-muted-foreground">Loading…</p>}>
        <ShareRedirect />
      </Suspense>
    </div>
  )
}
