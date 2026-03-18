/**
 * mc-x — CLI commands (commander integration)
 *
 * Registers the "mc-x" command group so the plugin can be used via:
 *   mc mc-x <subcommand> [options]
 */

import type { Command } from "commander";
import { getBearerToken, saveBearerToken } from "../src/vault.js";
import { XClient } from "../src/client.js";

export interface XCliContext {
  program: Command;
  vaultBin: string;
  logger: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void };
}

export function registerXCommands(ctx: XCliContext): void {
  const { program, vaultBin, logger } = ctx;

  const cmd = program
    .command("mc-x")
    .description("X/Twitter integration — post tweets, read timelines, reply");

  // ── auth ──────────────────────────────────────────────────────────────
  cmd
    .command("auth")
    .description("Store X/Twitter Bearer token in vault")
    .requiredOption("--token <bearer>", "Bearer token from X developer portal")
    .action((opts: { token: string }) => {
      saveBearerToken(opts.token, vaultBin);
      logger.info("Bearer token saved to vault.");
    });

  // ── post ──────────────────────────────────────────────────────────────
  cmd
    .command("post <text>")
    .description("Post a new tweet")
    .action(async (text: string) => {
      const token = getBearerToken(vaultBin);
      if (!token) {
        logger.error("No bearer token found. Run: mc mc-x auth --token <bearer>");
        return;
      }
      const client = new XClient(token);
      try {
        const result = await client.postTweet(text);
        logger.info(`Tweet posted: id=${result.id} text="${result.text}"`);
      } catch (err: unknown) {
        logger.error(`Failed to post tweet: ${(err as Error).message}`);
      }
    });

  // ── timeline ──────────────────────────────────────────────────────────
  cmd
    .command("timeline")
    .description("Read recent tweets from a user timeline")
    .option("--user-id <id>", "User ID to fetch timeline for")
    .option("--count <n>", "Number of tweets to fetch", "10")
    .action(async (opts: { userId?: string; count: string }) => {
      const token = getBearerToken(vaultBin);
      if (!token) {
        logger.error("No bearer token found. Run: mc mc-x auth --token <bearer>");
        return;
      }
      if (!opts.userId) {
        logger.error("--user-id is required for timeline.");
        return;
      }
      const client = new XClient(token);
      try {
        const result = await client.getTimeline(opts.userId, parseInt(opts.count, 10));
        for (const tweet of result.tweets) {
          logger.info(`[${tweet.id}] ${tweet.text}`);
        }
        if (result.tweets.length === 0) {
          logger.info("No tweets found.");
        }
      } catch (err: unknown) {
        logger.error(`Failed to fetch timeline: ${(err as Error).message}`);
      }
    });

  // ── reply ─────────────────────────────────────────────────────────────
  cmd
    .command("reply <tweetId> <text>")
    .description("Reply to a tweet")
    .action(async (tweetId: string, text: string) => {
      const token = getBearerToken(vaultBin);
      if (!token) {
        logger.error("No bearer token found. Run: mc mc-x auth --token <bearer>");
        return;
      }
      const client = new XClient(token);
      try {
        const result = await client.replyToTweet(tweetId, text);
        logger.info(`Reply posted: id=${result.id} text="${result.text}"`);
      } catch (err: unknown) {
        logger.error(`Failed to reply: ${(err as Error).message}`);
      }
    });
}
