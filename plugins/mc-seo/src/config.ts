import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

function _resolveBotId(): string {
  if (process.env.OPENCLAW_BOT_ID) return process.env.OPENCLAW_BOT_ID;
  const stateDir = process.env.OPENCLAW_STATE_DIR ?? path.join(os.homedir(), ".openclaw");
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(stateDir, "openclaw.json"), "utf-8"));
    if (cfg.botId) return cfg.botId as string;
  } catch {}
  throw new Error("OPENCLAW_BOT_ID not set and botId not found in openclaw.json — run the setup wizard");
}

export type DomainConfig = {
  sitemapUrl?: string;
  targetKeywords: string[];
  devUrl?: string;
};

export type SeoConfig = {
  stateDir: string;
  indexNowKey?: string;
  googleSearchApiKey?: string;
  googleSearchCx?: string;
  bingApiKey?: string;
  domains: Record<string, DomainConfig>;
};

export function resolveConfig(raw: Record<string, unknown>, botId = _resolveBotId()): SeoConfig {
  const defaultStateDir = path.join(os.homedir(), ".openclaw", "USER", botId, "seo");

  const domains: Record<string, DomainConfig> = {};
  const rawDomains = (raw["domains"] ?? {}) as Record<string, Record<string, unknown>>;
  for (const [domain, cfg] of Object.entries(rawDomains)) {
    domains[domain] = {
      sitemapUrl: cfg["sitemapUrl"] as string | undefined,
      targetKeywords: (cfg["targetKeywords"] as string[] | undefined) ?? [],
      devUrl: cfg["devUrl"] as string | undefined,
    };
  }

  return {
    stateDir: (raw["stateDir"] as string | undefined) ?? defaultStateDir,
    indexNowKey: raw["indexNowKey"] as string | undefined,
    googleSearchApiKey: raw["googleSearchApiKey"] as string | undefined,
    googleSearchCx: raw["googleSearchCx"] as string | undefined,
    bingApiKey: raw["bingApiKey"] as string | undefined,
    domains,
  };
}
