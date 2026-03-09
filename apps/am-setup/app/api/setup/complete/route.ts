export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { writeSetupState } from "@/lib/setup-state";

export async function POST() {
  const state = writeSetupState({
    complete: true,
    completedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, state });
}
