export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const CLAUDE_BIN = "/Users/michaeloneal/.local/bin/claude";
const HOME = process.env.HOME || "";

function isAnthropicAuthed(): boolean {
  const authFile = `${HOME}/.openclaw/agents/main/agent/auth-profiles.json`;
  try {
    if (!existsSync(authFile)) return false;
    const data = JSON.parse(readFileSync(authFile, "utf8"));
    const profiles = data?.profiles || {};
    return Object.keys(profiles).some(
      (k) => k.startsWith("anthropic") && profiles[k]?.token,
    );
  } catch {
    return false;
  }
}

// GET: poll for auth status
export async function GET() {
  const authed = isAnthropicAuthed();
  return NextResponse.json({ authed });
}

// POST: kick off claude setup-token (fire and forget)
export async function POST() {
  const { CLAUDECODE: _, ...cleanEnv } = process.env;

  spawn("script", ["-q", "/dev/null", CLAUDE_BIN, "setup-token"], {
    stdio: "ignore",
    detached: true,
    env: { ...cleanEnv, HOME, TERM: "xterm-256color" },
  }).unref();

  return NextResponse.json({ ok: true, message: "OAuth started — sign in via the browser window" });
}

// PUT: paste a session token directly
export async function PUT(req: Request) {
  const { token } = await req.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ ok: false, error: "Token is required" }, { status: 400 });
  }

  try {
    execSync(
      `openclaw models auth paste-token --provider anthropic --profile-id anthropic:default`,
      {
        input: token.trim(),
        encoding: "utf8",
        timeout: 10_000,
        env: { ...process.env, HOME },
      },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Failed to store token: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
