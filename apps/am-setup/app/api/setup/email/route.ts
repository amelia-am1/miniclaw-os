export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { vaultSet } from "@/lib/vault";
import { checkGmailAuth } from "@/lib/email-check";
import { writeSetupState } from "@/lib/setup-state";

export async function POST(req: Request) {
  const { email, appPassword } = await req.json();

  if (!email || !appPassword) {
    return NextResponse.json({ ok: false, error: "Email and app password are required" }, { status: 400 });
  }

  // 1. Test credentials first
  const authCheck = await checkGmailAuth(email, appPassword);
  if (!authCheck.ok) {
    return NextResponse.json({ ok: false, error: authCheck.error || "Auth failed" }, { status: 400 });
  }

  // 2. Write to vault
  const emailResult = vaultSet("gmail-email", email);
  if (!emailResult.ok) {
    return NextResponse.json({ ok: false, error: `Vault error: ${emailResult.error}` }, { status: 500 });
  }

  const pwResult = vaultSet("gmail-app-password", appPassword);
  if (!pwResult.ok) {
    return NextResponse.json({ ok: false, error: `Vault error: ${pwResult.error}` }, { status: 500 });
  }

  // 3. Update setup state
  writeSetupState({ emailAddress: email, emailConfigured: true });

  return NextResponse.json({ ok: true });
}
