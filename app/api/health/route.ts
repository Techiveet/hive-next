// app/api/health/route.ts

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() }, { status: 200 });
}
