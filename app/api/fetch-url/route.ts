import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  void req
  return NextResponse.json(
    {
      error: "Deprecated: URL metadata enrichment is now client-side only.",
    },
    { status: 410 },
  )
}
