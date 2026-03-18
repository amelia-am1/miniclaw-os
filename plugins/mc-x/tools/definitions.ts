import type { AnyAgentTool } from "openclaw/plugin-sdk";
import * as path from "node:path";
import * as os from "node:os";
import { getBearerToken } from "../src/vault.js";
import { XClient } from "../src/client.js";

type Logger = { info(m: string): void; warn(m: string): void; error(m: string): void };

const STATE_DIR = process.env.OPENCLAW_STATE_DIR ?? path.join(os.homedir(), ".openclaw");
const VAULT_BIN = path.join(STATE_DIR, "miniclaw", "SYSTEM", "bin", "mc-vault");

function ok(text: string) {
  return { content: [{ type: "text" as const, text: text.trim() }], details: {} };
}

function getClient(): XClient {
  const token = getBearerToken(VAULT_BIN);
  if (!token) {
    throw new Error("No X bearer token in vault. Run: mc mc-x auth --token <bearer>");
  }
  return new XClient(token);
}

export function createXTools(logger: Logger): AnyAgentTool[] {
  return [
    // ── Post a tweet ──────────────────────────────────────────────────────
    {
      name: "x_post",
      label: "x_post",
      description: "Post a new tweet on X/Twitter.",
      parameters: {
        type: "object",
        required: ["text"],
        properties: {
          text: { type: "string", description: "The tweet text (max 280 characters)" },
        },
      },
      async execute(_id: string, params: unknown) {
        const p = params as { text: string };
        try {
          const client = getClient();
          const result = await client.postTweet(p.text);
          logger.info(`x_post: tweet ${result.id} posted`);
          return ok(`Tweet posted successfully.\nID: ${result.id}\nText: ${result.text}`);
        } catch (err: unknown) {
          return ok(`Error posting tweet: ${(err as Error).message}`);
        }
      },
    },

    // ── Read timeline ─────────────────────────────────────────────────────
    {
      name: "x_timeline",
      label: "x_timeline",
      description: "Read recent tweets from a user's X/Twitter timeline.",
      parameters: {
        type: "object",
        required: ["user_id"],
        properties: {
          user_id: { type: "string", description: "X/Twitter user ID" },
          count: { type: "number", description: "Number of tweets to fetch (5-100, default 10)" },
        },
      },
      async execute(_id: string, params: unknown) {
        const p = params as { user_id: string; count?: number };
        try {
          const client = getClient();
          const result = await client.getTimeline(p.user_id, p.count ?? 10);
          if (result.tweets.length === 0) {
            return ok("No tweets found.");
          }
          const lines = result.tweets.map(
            (t) => `[${t.id}] (${t.created_at ?? "unknown"}) ${t.text}`
          );
          return ok(lines.join("\n"));
        } catch (err: unknown) {
          return ok(`Error reading timeline: ${(err as Error).message}`);
        }
      },
    },

    // ── Reply to a tweet ──────────────────────────────────────────────────
    {
      name: "x_reply",
      label: "x_reply",
      description: "Reply to a tweet on X/Twitter.",
      parameters: {
        type: "object",
        required: ["tweet_id", "text"],
        properties: {
          tweet_id: { type: "string", description: "ID of the tweet to reply to" },
          text: { type: "string", description: "Reply text (max 280 characters)" },
        },
      },
      async execute(_id: string, params: unknown) {
        const p = params as { tweet_id: string; text: string };
        try {
          const client = getClient();
          const result = await client.replyToTweet(p.tweet_id, p.text);
          logger.info(`x_reply: reply ${result.id} posted`);
          return ok(`Reply posted successfully.\nID: ${result.id}\nText: ${result.text}`);
        } catch (err: unknown) {
          return ok(`Error replying to tweet: ${(err as Error).message}`);
        }
      },
    },
  ];
}
