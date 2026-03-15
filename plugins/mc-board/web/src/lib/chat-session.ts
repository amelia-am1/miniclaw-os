/**
 * chat-session.ts — Interactive Claude Code session via PTY.
 *
 * Spawns `claude` in a pseudo-terminal so it runs in full interactive mode
 * with tools, file access, and conversation history. Communicates with the
 * web server via EventEmitter. The PTY keeps claude alive across messages.
 */

import * as pty from "node-pty";
import * as os from "node:os";
import { EventEmitter } from "node:events";

const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";

interface ChatEvent {
  type: "delta" | "tool" | "system" | "done" | "error";
  text?: string;
  name?: string;
  detail?: string;
}

// Strip ANSI escape sequences from terminal output
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[()][0-9A-B]|\x1b\[[\?]?[0-9;]*[a-zA-Z]|\x1b[>=<]|\x1b\[[0-9]*[a-zA-Z]/g, "");
}

export class ChatSession extends EventEmitter {
  private term: pty.IPty | null = null;
  private ready = false;
  private buf = "";
  private turnActive = false;
  private turnResolve: (() => void) | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private outputLines: string[] = [];

  constructor(
    private systemPrompt: string,
    private cwd: string = os.homedir(),
  ) {
    super();
  }

  private ensureTerm() {
    if (this.term) return;

    const env = { ...process.env };
    delete env.CLAUDECODE;
    // Force plain output
    env.TERM = "dumb";
    env.NO_COLOR = "1";
    env.FORCE_COLOR = "0";
    env.COLUMNS = "120";
    env.LINES = "50";

    this.term = pty.spawn(CLAUDE_BIN, [
      "--dangerously-skip-permissions",
      "--model", "claude-haiku-4-5-20251001",
      "--system-prompt", this.systemPrompt,
    ], {
      name: "dumb",
      cols: 120,
      rows: 50,
      cwd: this.cwd,
      env,
    });

    this.term.onData((data: string) => {
      const clean = stripAnsi(data);
      if (!clean.trim()) return;

      // Accumulate output
      this.buf += clean;

      // Reset idle timer — when output stops for 500ms, consider turn done
      if (this.turnActive) {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => this.flushTurn(), 500);
      }
    });

    this.term.onExit(({ exitCode }) => {
      this.emit("event", { type: "system", text: `Session ended (code ${exitCode})` } as ChatEvent);
      this.emit("event", { type: "done" } as ChatEvent);
      this.term = null;
      if (this.turnResolve) {
        this.turnResolve();
        this.turnResolve = null;
      }
    });

    // Wait for claude to be ready (prompt appears)
    this.ready = true;
  }

  private flushTurn() {
    if (!this.turnActive) return;

    const text = this.buf.trim();
    this.buf = "";

    if (text) {
      // Parse out tool calls and text
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Skip prompt lines
        if (trimmed.startsWith(">") && trimmed.length < 5) continue;
        if (trimmed.startsWith("╭") || trimmed.startsWith("╰") || trimmed.startsWith("│")) continue;

        // Tool use indicators
        if (trimmed.startsWith("⏺") || trimmed.match(/^[A-Z][a-z]+\(/)) {
          this.emit("event", { type: "tool", name: trimmed.slice(0, 60) } as ChatEvent);
        } else {
          this.emit("event", { type: "delta", text: trimmed + "\n" } as ChatEvent);
        }
      }
    }

    this.turnActive = false;
    this.emit("event", { type: "done" } as ChatEvent);
    if (this.turnResolve) {
      this.turnResolve();
      this.turnResolve = null;
    }
  }

  async send(message: string): Promise<void> {
    this.ensureTerm();
    if (!this.term) {
      this.emit("event", { type: "error", text: "Failed to start Claude Code" } as ChatEvent);
      this.emit("event", { type: "done" } as ChatEvent);
      return;
    }

    this.buf = "";
    this.turnActive = true;

    // Write message + enter
    this.term.write(message + "\r");

    return new Promise<void>((resolve) => {
      this.turnResolve = resolve;
      // Safety timeout — 5 minutes
      setTimeout(() => {
        if (this.turnActive) {
          this.flushTurn();
          resolve();
        }
      }, 300_000);
    });
  }

  kill() {
    if (this.term) {
      this.term.kill();
      this.term = null;
    }
  }

  get alive(): boolean {
    return this.term !== null;
  }
}

// Session store
const sessions = new Map<string, ChatSession>();
const sessionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function touchSession(id: string) {
  if (sessionTimers.has(id)) clearTimeout(sessionTimers.get(id)!);
  sessionTimers.set(id, setTimeout(() => {
    const s = sessions.get(id);
    if (s) s.kill();
    sessions.delete(id);
    sessionTimers.delete(id);
  }, SESSION_TTL_MS));
}

export function getOrCreateSession(id: string, systemPrompt: string, cwd?: string): ChatSession {
  let session = sessions.get(id);
  if (session && session.alive) {
    touchSession(id);
    return session;
  }
  session = new ChatSession(systemPrompt, cwd);
  sessions.set(id, session);
  touchSession(id);
  return session;
}

export function destroySession(id: string) {
  const s = sessions.get(id);
  if (s) s.kill();
  sessions.delete(id);
  if (sessionTimers.has(id)) {
    clearTimeout(sessionTimers.get(id)!);
    sessionTimers.delete(id);
  }
}
