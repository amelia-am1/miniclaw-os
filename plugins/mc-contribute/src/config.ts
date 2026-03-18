import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface ContributeConfig {
  upstreamRepo: string;
  forkRemote: string;
  agentName: string;
  ghUsername: string;
}

/**
 * Auto-resolve agent identity from available sources:
 * 1. IDENTITY.md in state dir
 * 2. agent.json in state dir
 * 3. hostname fallback
 */
function resolveAgentName(): string {
  const stateDir = process.env.OPENCLAW_STATE_DIR || "";

  // Try IDENTITY.md
  try {
    const identityPath = path.join(stateDir, "IDENTITY.md");
    if (fs.existsSync(identityPath)) {
      const content = fs.readFileSync(identityPath, "utf-8");
      const match = content.match(/^#\s*(.+)/m) || content.match(/name:\s*(.+)/im);
      if (match) return match[1].trim();
    }
  } catch {}

  // Try agent.json
  try {
    const agentConfig = path.join(stateDir, "agents", "main", "agent", "agent.json");
    if (fs.existsSync(agentConfig)) {
      const cfg = JSON.parse(fs.readFileSync(agentConfig, "utf-8"));
      if (cfg.name) return cfg.name;
      if (cfg.id) return cfg.id;
      if (cfg.botId) return cfg.botId;
    }
  } catch {}

  return os.hostname();
}

/**
 * Auto-resolve GitHub username from gh auth.
 * Falls back to "unknown" if gh is not authenticated.
 */
function resolveGhUsername(): string {
  try {
    return execFileSync("gh", ["api", "user", "--jq", ".login"], {
      encoding: "utf-8",
      timeout: 10_000,
    }).trim();
  } catch {}

  try {
    const output = execFileSync("gh", ["auth", "status"], {
      encoding: "utf-8",
      timeout: 10_000,
    });
    const match = output.match(/Logged in to.*as\s+(\S+)/);
    if (match) return match[1];
  } catch {}

  return "unknown";
}

export function resolveConfig(raw: Record<string, unknown>): ContributeConfig {
  return {
    upstreamRepo: (raw.upstreamRepo as string) || "augmentedmike/miniclaw-os",
    forkRemote: (raw.forkRemote as string) || "origin",
    agentName: (raw.agentName as string) || resolveAgentName(),
    ghUsername: (raw.ghUsername as string) || resolveGhUsername(),
  };
}
