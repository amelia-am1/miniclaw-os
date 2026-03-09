/**
 * mc-seo — CLI commands
 *
 *   mc mc-seo check <url>           — full on-page audit of a single URL
 *   mc mc-seo crawl <url>           — crawl entire site, score all pages
 *   mc mc-seo rank <domain> <kw>    — check Google/Bing ranking for keyword
 *   mc mc-seo rank-all <domain>     — check all configured keywords
 *   mc mc-seo ping <sitemap-url>    — submit sitemap to Google/Bing/IndexNow
 *   mc mc-seo track add             — record a directory/outreach submission
 *   mc mc-seo track list [domain]   — list tracked submissions
 *   mc mc-seo board <domain>        — auto-create mc-board cards from audit
 *   mc mc-seo domains               — list configured domains
 */

import type { Command } from "commander";
import type { SeoConfig } from "../src/config.js";
import { auditPage } from "../src/audit.js";
import { crawlSite } from "../src/crawler.js";
import { checkRank } from "../src/rank-checker.js";
import { pingSitemaps, fetchSitemap } from "../src/sitemap.js";
import { formatPageAudit, formatSiteSummary } from "../src/reporter.js";
import { SeoDb } from "../src/db.js";
import * as path from "node:path";
import * as child_process from "node:child_process";

type Logger = { info(m: string): void; warn(m: string): void; error(m: string): void };

function getDb(cfg: SeoConfig): SeoDb {
  return new SeoDb(path.join(cfg.stateDir, "seo.db"));
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function getDomainConfig(cfg: SeoConfig, domain: string) {
  return cfg.domains[domain] ?? cfg.domains[`www.${domain}`] ?? { targetKeywords: [] };
}

export function registerSeoCommands(
  ctx: { program: Command; logger: Logger },
  cfg: SeoConfig
): void {
  const { program, logger } = ctx;

  const seo = program
    .command("mc-seo")
    .description("SEO automation — audit, crawl, rank check, sitemap submission, backlink tracking");

  // ── mc mc-seo check <url> ────────────────────────────────────────────────
  seo
    .command("check <url>")
    .description("Full on-page SEO audit of a single URL")
    .option("-v, --verbose", "Show all checks including passes")
    .option("-k, --keyword <kw>", "Primary target keyword to check against")
    .option("--json", "Output raw JSON")
    .action(async (url: string, opts: { verbose?: boolean; keyword?: string; json?: boolean }) => {
      if (!url.startsWith("http")) url = `https://${url}`;
      const domain = domainOf(url);
      const domCfg = getDomainConfig(cfg, domain);
      const keywords = opts.keyword ? [opts.keyword] : domCfg.targetKeywords;

      logger.info(`mc-seo: auditing ${url}${keywords.length ? ` (keyword: ${keywords[0]})` : ""}`);
      const audit = await auditPage(url, keywords);

      if (opts.json) {
        console.log(JSON.stringify(audit, null, 2));
      } else {
        console.log("\n" + formatPageAudit(audit, opts.verbose));
      }

      // Save to db
      const db = getDb(cfg);
      db.saveAudit(domain, url, audit.score, audit.issues, audit.suggestions, audit);
      db.close();
    });

  // ── mc mc-seo crawl <url> ────────────────────────────────────────────────
  seo
    .command("crawl <url>")
    .description("Crawl entire site and audit every page")
    .option("--max-pages <n>", "Max pages to crawl", "100")
    .option("--max-depth <n>", "Max crawl depth", "10")
    .option("-v, --verbose", "Show full audit for each page")
    .option("--json", "Output raw JSON")
    .action(async (url: string, opts: { maxPages: string; maxDepth: string; verbose?: boolean; json?: boolean }) => {
      if (!url.startsWith("http")) url = `https://${url}`;
      const domain = domainOf(url);
      const domCfg = getDomainConfig(cfg, domain);

      console.log(`\n🕷️  Crawling ${url} (max ${opts.maxPages} pages)…\n`);

      const crawl = await crawlSite(url, {
        maxPages: parseInt(opts.maxPages),
        maxDepth: parseInt(opts.maxDepth),
        onProgress: (done, total, current) => {
          process.stdout.write(`\r  ${done}/${total} pages… ${current.slice(0, 60)}`);
        },
      });

      console.log(`\n\n📊 Auditing ${crawl.pages.filter(p => p.status === 200).length} pages…\n`);

      const db = getDb(cfg);
      const audits = await Promise.all(
        crawl.pages
          .filter(p => p.status === 200 && !p.error)
          .map(p => auditPage(p.url, domCfg.targetKeywords))
      );

      for (const audit of audits) {
        db.saveAudit(domain, audit.url, audit.score, audit.issues, audit.suggestions, audit);
        if (opts.verbose) {
          console.log(formatPageAudit(audit, false));
          console.log("─".repeat(60));
        }
      }
      db.close();

      if (opts.json) {
        console.log(JSON.stringify({ crawl, audits }, null, 2));
      } else {
        console.log(formatSiteSummary(crawl, audits));
      }
    });

  // ── mc mc-seo rank <domain> <keyword> ───────────────────────────────────
  seo
    .command("rank <domain> <keyword>")
    .description("Check Google/Bing ranking for a keyword")
    .action(async (domain: string, keyword: string) => {
      console.log(`\n🔍 Checking rank for "${keyword}" on ${domain}…\n`);

      const result = await checkRank(keyword, domain.replace(/^www\./, ""), {
        googleApiKey: cfg.googleSearchApiKey,
        googleCx: cfg.googleSearchCx,
        bingApiKey: cfg.bingApiKey,
      });

      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      } else if (result.position === null) {
        console.log(`📉 "${keyword}" — Not found in top 100 on ${result.engine}`);
      } else {
        const medal = result.position === 1 ? "🥇" : result.position <= 3 ? "🥈" : result.position <= 10 ? "🟢" : "🟡";
        console.log(`${medal} Position #${result.position} on ${result.engine}`);
        if (result.url) console.log(`   URL: ${result.url}`);
      }

      // Save to db
      const db = getDb(cfg);
      db.saveAudit(domain, `rank:${keyword}`, result.position ?? -1, [], [], result);
      db.close();
    });

  // ── mc mc-seo rank-all <domain> ─────────────────────────────────────────
  seo
    .command("rank-all <domain>")
    .description("Check rankings for all configured target keywords")
    .action(async (domain: string) => {
      const domCfg = getDomainConfig(cfg, domain);
      if (domCfg.targetKeywords.length === 0) {
        console.log(`No target keywords configured for ${domain}. Add them to mc-seo.domains in openclaw.json`);
        return;
      }

      console.log(`\n🔍 Checking ${domCfg.targetKeywords.length} keywords for ${domain}…\n`);
      const db = getDb(cfg);

      for (const kw of domCfg.targetKeywords) {
        const result = await checkRank(kw, domain.replace(/^www\./, ""), {
          googleApiKey: cfg.googleSearchApiKey,
          googleCx: cfg.googleSearchCx,
          bingApiKey: cfg.bingApiKey,
        });

        if (result.error) {
          console.log(`  ❌ "${kw}" — ${result.error}`);
        } else if (result.position === null) {
          console.log(`  📉 "${kw}" — Not in top 100 (${result.engine})`);
        } else {
          const medal = result.position === 1 ? "🥇" : result.position <= 3 ? "🏅" : result.position <= 10 ? "🟢" : "🟡";
          console.log(`  ${medal} #${result.position} — "${kw}" (${result.engine})`);
        }

        db.saveAudit(domain, `rank:${kw}`, result.position ?? -1, [], [], result);
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 1500));
      }

      db.close();
    });

  // ── mc mc-seo ping <sitemap-url> ─────────────────────────────────────────
  seo
    .command("ping <sitemapUrl>")
    .description("Submit sitemap to Google, Bing, and IndexNow")
    .action(async (sitemapUrl: string) => {
      console.log(`\n📡 Submitting sitemap: ${sitemapUrl}\n`);

      // Validate first
      const validation = await fetchSitemap(sitemapUrl);
      if (!validation.valid) {
        console.log(`❌ Sitemap invalid: ${validation.error}`);
        return;
      }
      console.log(`✅ Sitemap valid — ${validation.urls.length} URLs found\n`);

      const results = await pingSitemaps(sitemapUrl, cfg.indexNowKey);
      for (const r of results) {
        const icon = r.status === "ok" ? "✅" : "❌";
        console.log(`${icon} ${r.engine}: ${r.message}`);
      }
    });

  // ── mc mc-seo track add ──────────────────────────────────────────────────
  seo
    .command("track-add")
    .description("Record a directory/outreach submission")
    .requiredOption("--domain <domain>")
    .requiredOption("--service <service>", "e.g. Futurepedia, ProductHunt, BensBites")
    .option("--url <url>", "Listing URL")
    .option("--status <status>", "pending|submitted|live|rejected|n/a", "submitted")
    .option("--notes <notes>", "Any notes")
    .action((opts: { domain: string; service: string; url?: string; status: string; notes?: string }) => {
      const db = getDb(cfg);
      db.upsertSubmission(opts.domain, opts.service, opts.url ?? "", opts.status, opts.notes ?? "");
      db.close();
      console.log(`✅ Tracked: ${opts.domain} → ${opts.service} [${opts.status}]`);
    });

  // ── mc mc-seo track list ─────────────────────────────────────────────────
  seo
    .command("track-list [domain]")
    .description("List all tracked submissions")
    .action((domain?: string) => {
      const db = getDb(cfg);
      const rows = db.getSubmissions(domain);
      db.close();

      if (rows.length === 0) {
        console.log("No submissions tracked yet.");
        return;
      }

      const statusIcon = (s: string) =>
        s === "live" ? "🟢" : s === "submitted" ? "🟡" : s === "rejected" ? "🔴" : s === "n/a" ? "⚪" : "⏳";

      let lastDomain = "";
      for (const row of rows) {
        if (row.domain !== lastDomain) {
          console.log(`\n📍 ${row.domain}`);
          lastDomain = row.domain;
        }
        const date = row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : "–";
        console.log(`  ${statusIcon(row.status)} ${row.service.padEnd(25)} [${row.status}]  ${date}  ${row.notes || ""}`);
      }
      console.log("");
    });

  // ── mc mc-seo board <domain> ─────────────────────────────────────────────
  seo
    .command("board <domain>")
    .description("Auto-create mc-board cards from latest audit findings")
    .option("--project <id>", "mc-board project ID (auto-detected if not set)")
    .action(async (domain: string, opts: { project?: string }) => {
      const db = getDb(cfg);
      const audits = db.getLatestAudits(domain);
      db.close();

      if (audits.length === 0) {
        console.log(`No audit data for ${domain}. Run: mc mc-seo crawl ${domain} first.`);
        return;
      }

      // Determine project
      const projectMap: Record<string, string> = {
        "helloam.bot": "prj_c115269f",
        "miniclaw.bot": "prj_aeaba884",
        "augmentedmike.com": "prj_c7043d4f",
        "blog.helloam.bot": "prj_983dfad4",
      };
      const projectId = opts.project ?? projectMap[domain];
      if (!projectId) {
        console.log(`Unknown domain ${domain}. Pass --project <id>`);
        return;
      }

      // Group issues by type across all pages
      const issueGroups = new Map<string, string[]>(); // issue text → pages
      for (const row of audits) {
        const issues = JSON.parse(row.issues) as string[];
        for (const issue of issues) {
          const key = issue.replace(/:\s*.+$/, "").replace(/\d+\/\d+/g, "N/M");
          if (!issueGroups.has(key)) issueGroups.set(key, []);
          issueGroups.get(key)!.push(row.url);
        }
      }

      let created = 0;
      for (const [issue, pages] of issueGroups) {
        const title = `[${domain}] ${issue} (${pages.length} page${pages.length > 1 ? "s" : ""})`;
        const plan = `Affected pages:\n${pages.slice(0, 10).map(p => `- ${p}`).join("\n")}`;
        const priority = pages.length >= 3 ? "high" : "medium";

        const result = child_process.spawnSync("mc", [
          "mc-board", "create",
          "--project", projectId,
          "--title", title,
          "--priority", priority,
          "--tags", "seo,auto-generated",
          "--problem", issue,
          "--plan", plan,
        ], { encoding: "utf8" });

        if (result.status === 0) {
          created++;
          console.log(`✅ Created: ${title}`);
        }
      }

      console.log(`\nCreated ${created} cards for ${domain}`);
    });

  // ── mc mc-seo domains ────────────────────────────────────────────────────
  seo
    .command("domains")
    .description("List configured domains")
    .action(() => {
      if (Object.keys(cfg.domains).length === 0) {
        console.log("No domains configured. Add mc-seo.domains to openclaw.json");
        return;
      }
      for (const [domain, dcfg] of Object.entries(cfg.domains)) {
        console.log(`\n📍 ${domain}`);
        if (dcfg.sitemapUrl) console.log(`   Sitemap:  ${dcfg.sitemapUrl}`);
        if (dcfg.devUrl) console.log(`   Dev URL:  ${dcfg.devUrl}`);
        if (dcfg.targetKeywords.length > 0) {
          console.log(`   Keywords: ${dcfg.targetKeywords.join(", ")}`);
        }
      }
    });
}
