import { NextResponse } from "next/server"

/** Lightweight edge-style sync endpoint — caches last workspace snapshot server-side. */
const cache = new Map<string, { ts: number; payload: unknown }>()

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const id = req.headers.get("x-nodepad-client") ?? "default"
    cache.set(id, { ts: body.ts ?? Date.now(), payload: body.payload })
    return NextResponse.json({ ok: true, ts: Date.now() })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}

export async function GET(req: Request) {
  const id = req.headers.get("x-nodepad-client") ?? new URL(req.url).searchParams.get("id") ?? "default"
  const entry = cache.get(id)
  if (!entry) return NextResponse.json({ ok: false }, { status: 404 })
  return NextResponse.json({ ok: true, ...entry })
}
