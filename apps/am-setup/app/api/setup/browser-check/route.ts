export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

export async function GET() {
  const issues: string[] = [];
  const passed: string[] = [];

  // 1. Chrome installed?
  if (existsSync("/Applications/Google Chrome.app")) {
    passed.push("Chrome installed");
  } else {
    issues.push("Chrome not installed");
  }

  // 2. Chrome managed policy exists?
  const policyFile = "/Library/Google/Chrome/Managed Preferences/com.google.Chrome.plist";
  if (existsSync(policyFile)) {
    // Check RemoteDebuggingAllowed
    try {
      const val = execFileSync("defaults", ["read", policyFile, "RemoteDebuggingAllowed"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (val === "1") {
        passed.push("Remote debugging allowed");
      } else {
        issues.push("RemoteDebuggingAllowed not enabled");
      }
    } catch {
      issues.push("RemoteDebuggingAllowed policy not set");
    }
  } else {
    issues.push("Chrome managed policy not found");
  }

  // 3. Browser Relay extension present?
  const stateDir = process.env.OPENCLAW_STATE_DIR || join(homedir(), ".openclaw");
  const extDir = join(stateDir, "miniclaw/plugins/mc-browser/assets/extension/manifest.json");
  if (existsSync(extDir)) {
    passed.push("Browser Relay extension installed");
  } else {
    issues.push("Browser Relay extension not found");
  }

  // 4. mc-chrome launcher present?
  const mcChrome = join(stateDir, "miniclaw/SYSTEM/bin/mc-chrome");
  if (existsSync(mcChrome)) {
    passed.push("mc-chrome launcher present");
  } else {
    issues.push("mc-chrome launcher not found");
  }

  // 5. LaunchAgent installed?
  const plistPath = join(homedir(), "Library/LaunchAgents/com.miniclaw.mc-chrome.plist");
  if (existsSync(plistPath)) {
    passed.push("LaunchAgent installed");
  } else {
    issues.push("LaunchAgent not installed");
  }

  const ok = issues.length === 0;
  const detail = ok
    ? `${passed.length} checks passed — Chrome + remote debugging + extension ready`
    : `${passed.length} passed, ${issues.length} issues: ${issues.join(", ")}`;

  return NextResponse.json({ ok, detail, passed, issues });
}
