/**
 * chat-session.ts — Claude Code session manager.
 *
 * Each message spawns `claude -p` with `--continue --session-id` to maintain
 * conversation context across turns. Claude Code handles history internally.
 */

import { spawn } from "node:child_process";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { EventEmitter } from "node:events";

const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";

interface ChatEvent {
  type: "delta" | "tool" | "system" | "done" | "error";
  text?: string;
  name?: string;
  detail?: string;
}

export class ChatSession extends EventEmitter {
  readonly sessionId: string;
  private firstMessage = true;

  constructor(
    private systemPrompt: string,
    private cwd: string = os.homedir(),
    sessionId?: string,
  ) {
    super();
    this.sessionId = sessionId || crypto.randomUUID();
  }

  async send(message: string): Promise<void> {
    const { CLAUDECODE: _cc, ...env } = process.env;

    const args = [
      "-p", message,
      "--output-format", "stream-json",
      "--model", "claude-haiku-4-5-20251001",
      "--dangerously-skip-permissions",
      "--verbose",
      "--session-id", this.sessionId,
    ];

    if (this.firstMessage) {
      args.push("--system-prompt", this.systemPrompt);
      this.firstMessage = false;
    } else {
      args.push("--continue");
    }

    const proc = spawn(CLAUDE_BIN, args, {
      env,
      cwd: this.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let buf = "";
    let lastText = "";

    const processLine = (line: string) => {
      if (!line.trim()) return;
      try {
        const msg = JSON.parse(line);

        // Text from assistant messages (full content, diff to get delta)
        if (msg.type === "assistant" && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "text" && block.text && block.text.length > lastText.length) {
              const delta = block.text.slice(lastText.length);
              lastText = block.text;
              this.emit("event", { type: "delta", text: delta } as ChatEvent);
            }
            if (block.type === "tool_use") {
              const name = block.name ?? "tool";
              let detail = "";
              try {
                const input = block.input ?? {};
                detail = String(input.command ?? input.path ?? input.file_path ?? input.query ?? input.pattern ?? "")
                  .split("\n")[0].slice(0, 100);
              } catch {}
              this.emit("event", { type: "tool", name, detail } as ChatEvent);
            }
          }
        }

        // Result — end of turn
        if (msg.type === "result") {
          this.emit("event", { type: "done" } as ChatEvent);
        }

        // System (skip init)
        if (msg.type === "system" && msg.subtype !== "init") {
          const text = msg.message ?? msg.text ?? "";
          if (text) this.emit("event", { type: "system", text } as ChatEvent);
        }
      } catch {}
    };

    proc.stdout.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text && /login|auth|compact|warning|limit|quota/i.test(text)) {
        this.emit("event", { type: "system", text } as ChatEvent);
      }
    });

    return new Promise<void>((resolve) => {
      proc.on("close", (code) => {
        if (buf.trim()) processLine(buf);
        if (code && code !== 0) {
          this.emit("event", { type: "system", text: `Session ended (code ${code})` } as ChatEvent);
        }
        this.emit("event", { type: "done" } as ChatEvent);
        resolve();
      });

      proc.on("error", (err) => {
        this.emit("event", { type: "error", text: err.message } as ChatEvent);
        resolve();
      });
    });
  }

  get alive(): boolean { return true; }
  kill() {}
}

// Session store
const sessions = new Map<string, ChatSession>();
const sessionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function touchSession(id: string) {
  if (sessionTimers.has(id)) clearTimeout(sessionTimers.get(id)!);
  sessionTimers.set(id, setTimeout(() => {
    sessions.delete(id);
    sessionTimers.delete(id);
  }, SESSION_TTL_MS));
}

export function getOrCreateSession(id: string, systemPrompt: string, cwd?: string): ChatSession {
  let session = sessions.get(id);
  if (session) {
    touchSession(id);
    return session;
  }
  session = new ChatSession(systemPrompt, cwd, id);
  sessions.set(id, session);
  touchSession(id);
  return session;
}

export function destroySession(id: string) {
  sessions.delete(id);
  if (sessionTimers.has(id)) {
    clearTimeout(sessionTimers.get(id)!);
    sessionTimers.delete(id);
  }
}
