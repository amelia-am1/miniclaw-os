/**
 * shared/logging/logger.ts
 *
 * Structured JSON logger for the miniclaw-os plugin ecosystem.
 *
 * JSON Schema:
 *   { timestamp, level, name, message, ...context }
 *
 * Output format is controlled by the MINICLAW_LOG_FORMAT env var:
 *   json   → one JSON object per line (default in non-TTY)
 *   text   → human-readable "[HH:MM:SS] [LEVEL] [name] message" (default in TTY)
 *
 * File logging with rotation:
 *   Set `file` in LoggerOptions to write JSON logs to a file.
 *   Set `maxFileBytes` (default: 50 MB) to trigger rotation when the file grows past this size.
 *   Set `maxBackups` (default: 5) to keep N rotated files (file.1, file.2, …).
 *   Set maxBackups=0 to disable rotation (writes stop when cap is reached).
 *
 * Usage:
 *   import { createLogger } from "../shared/logging/logger.js";
 *   const log = createLogger("mc-board");
 *   log.info("Card created", { cardId: "crd_abc123" });
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ── Level definitions ──────────────────────────────────────────────────────

export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const LEVEL_RANK: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Infinity,
};

// ── JSON log entry schema ──────────────────────────────────────────────────

/**
 * The canonical structured log entry.
 * All fields except `context` are always present in JSON output.
 */
export interface LogEntry {
  /** ISO-8601 UTC timestamp, e.g. "2026-03-06T19:00:00.000Z" */
  timestamp: string;
  /** Severity level */
  level: Exclude<LogLevel, "silent">;
  /** Logger name (plugin id or subsystem) */
  name: string;
  /** Human-readable message */
  message: string;
  /** Optional structured context fields */
  context?: Record<string, unknown>;
}

// ── Output format ──────────────────────────────────────────────────────────

export type OutputFormat = "json" | "text";

function resolveFormat(): OutputFormat {
  const env = process.env.MINICLAW_LOG_FORMAT?.trim().toLowerCase();
  if (env === "json") return "json";
  if (env === "text") return "text";
  // Auto-detect: use text when stdout is a TTY, JSON otherwise.
  return process.stdout.isTTY ? "text" : "json";
}

// ── Text formatting helpers ────────────────────────────────────────────────

const LEVEL_LABELS: Record<Exclude<LogLevel, "silent">, string> = {
  trace: "TRACE",
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
  fatal: "FATAL",
};

function formatTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatTextLine(
  level: Exclude<LogLevel, "silent">,
  name: string,
  message: string,
  context?: Record<string, unknown>,
): string {
  const time = formatTimestamp();
  const label = LEVEL_LABELS[level];
  const ctx =
    context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : "";
  return `[${time}] [${label}] [${name}] ${message}${ctx}`;
}

function formatJsonLine(
  level: Exclude<LogLevel, "silent">,
  name: string,
  message: string,
  context?: Record<string, unknown>,
): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    name,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  };
  return JSON.stringify(entry);
}

// ── Console sink ───────────────────────────────────────────────────────────

function writeLine(level: Exclude<LogLevel, "silent">, line: string): void {
  if (level === "error" || level === "fatal") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

// ── File sink with rotation ─────────────────────────────────────────────────

const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const DEFAULT_MAX_BACKUPS = 5;

function resolveMaxFileBytes(raw: number | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  const env = Number(process.env.MINICLAW_LOG_MAX_FILE_BYTES);
  if (Number.isFinite(env) && env > 0) return Math.floor(env);
  return DEFAULT_MAX_FILE_BYTES;
}

function resolveMaxBackups(raw: number | undefined): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return Math.floor(raw);
  const env = Number(process.env.MINICLAW_LOG_MAX_BACKUPS);
  if (Number.isFinite(env) && env >= 0) return Math.floor(env);
  return DEFAULT_MAX_BACKUPS;
}

function rotateLogFile(file: string, maxBackups: number): void {
  try {
    // Remove the oldest backup
    try { fs.rmSync(`${file}.${maxBackups}`, { force: true }); } catch { /* ignore */ }
    // Shift backups: file.(N-1) → file.N (from highest to lowest)
    for (let i = maxBackups - 1; i >= 1; i--) {
      try { fs.renameSync(`${file}.${i}`, `${file}.${i + 1}`); } catch { /* ignore */ }
    }
    // Rename current log → .1
    try { fs.renameSync(file, `${file}.1`); } catch { /* ignore */ }
  } catch { /* never block */ }
}

/**
 * Build a file-logging sink that appends JSON lines with size-based rotation.
 * Returns an emit function or null if no file is configured.
 */
function buildFileSink(
  opts: LoggerOptions,
): ((level: Exclude<LogLevel, "silent">, entry: LogEntry) => void) | null {
  if (!opts.file) return null;

  const filePath = opts.file;
  const maxFileBytes = resolveMaxFileBytes(opts.maxFileBytes);
  const maxBackups = resolveMaxBackups(opts.maxBackups);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let currentBytes = (() => {
    try { return fs.statSync(filePath).size; } catch { return 0; }
  })();
  let warnedAboutCap = false;

  return (_level, entry) => {
    try {
      const payload = `${JSON.stringify(entry)}\n`;
      const payloadBytes = Buffer.byteLength(payload, "utf8");

      if (currentBytes + payloadBytes > maxFileBytes) {
        if (maxBackups > 0) {
          rotateLogFile(filePath, maxBackups);
          currentBytes = 0;
          // Write a rotation notice to the fresh file
          const notice = `${JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "info" as const,
            name: "logging",
            message: `log rotated; previous archived to ${filePath}.1 maxFileBytes=${maxFileBytes} maxBackups=${maxBackups}`,
          })}\n`;
          try {
            fs.appendFileSync(filePath, notice, "utf8");
            currentBytes += Buffer.byteLength(notice, "utf8");
          } catch { /* ignore */ }
        } else {
          if (!warnedAboutCap) {
            warnedAboutCap = true;
            process.stderr.write(
              `[miniclaw] log file size cap reached; suppressing writes file=${filePath} maxFileBytes=${maxFileBytes}\n`,
            );
          }
          return;
        }
      }

      fs.appendFileSync(filePath, payload, "utf8");
      currentBytes += payloadBytes;
    } catch { /* never block on logging failures */ }
  };
}

// ── Logger factory ─────────────────────────────────────────────────────────

export interface LoggerOptions {
  /** Minimum level to emit. Defaults to MINICLAW_LOG_LEVEL env var, then "info". */
  level?: LogLevel;
  /** Output format override. Defaults to MINICLAW_LOG_FORMAT env var, then auto-detect. */
  format?: OutputFormat;
  /**
   * Optional file path to write JSON logs to.
   * When set, all log entries are appended as JSON lines to this file
   * in addition to console output.
   */
  file?: string;
  /**
   * Maximum file size in bytes before rotation is triggered.
   * Defaults to MINICLAW_LOG_MAX_FILE_BYTES env var, then 50 MB.
   * Only used when `file` is set.
   */
  maxFileBytes?: number;
  /**
   * Number of rotated backup files to keep (file.1, file.2, …).
   * Defaults to MINICLAW_LOG_MAX_BACKUPS env var, then 5.
   * Set to 0 to disable rotation (writes stop when cap is reached).
   * Only used when `file` is set.
   */
  maxBackups?: number;
}

export interface Logger {
  readonly name: string;
  readonly level: LogLevel;
  readonly format: OutputFormat;

  isEnabled(level: LogLevel): boolean;

  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  fatal(message: string, context?: Record<string, unknown>): void;

  /** Return a child logger that inherits format/level but adds a subsystem suffix. */
  child(subsystem: string): Logger;
}

function resolveMinLevel(opts?: LoggerOptions): LogLevel {
  if (opts?.level && LOG_LEVELS.includes(opts.level)) {
    return opts.level;
  }
  const env = process.env.MINICLAW_LOG_LEVEL?.trim().toLowerCase() as LogLevel | undefined;
  if (env && LOG_LEVELS.includes(env)) {
    return env;
  }
  return "info";
}

export function createLogger(name: string, opts?: LoggerOptions): Logger {
  const level = resolveMinLevel(opts);
  const format = opts?.format ?? resolveFormat();
  const minRank = LEVEL_RANK[level];
  const fileSink = buildFileSink(opts ?? {});

  const emit = (
    lvl: Exclude<LogLevel, "silent">,
    message: string,
    context?: Record<string, unknown>,
  ) => {
    if (LEVEL_RANK[lvl] < minRank) return;
    const line =
      format === "json"
        ? formatJsonLine(lvl, name, message, context)
        : formatTextLine(lvl, name, message, context);
    writeLine(lvl, line);
    if (fileSink) {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: lvl,
        name,
        message,
        ...(context && Object.keys(context).length > 0 ? { context } : {}),
      };
      fileSink(lvl, entry);
    }
  };

  const logger: Logger = {
    name,
    level,
    format,
    isEnabled: (lvl) => LEVEL_RANK[lvl] >= minRank && lvl !== "silent",
    trace: (msg, ctx) => emit("trace", msg, ctx),
    debug: (msg, ctx) => emit("debug", msg, ctx),
    info: (msg, ctx) => emit("info", msg, ctx),
    warn: (msg, ctx) => emit("warn", msg, ctx),
    error: (msg, ctx) => emit("error", msg, ctx),
    fatal: (msg, ctx) => emit("fatal", msg, ctx),
    child: (subsystem) =>
      createLogger(`${name}/${subsystem}`, {
        level,
        format,
        file: opts?.file,
        maxFileBytes: opts?.maxFileBytes,
        maxBackups: opts?.maxBackups,
      }),
  };

  return logger;
}
