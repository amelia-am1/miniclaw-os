# mc-smoke failures & warnings — 2026-03-14 (install #3)

## Score: 106 passed, 5 warned, 6 failed

## Failures (6)

### 1. mc-designer load failed
- `115 | }` — the `@google/genai` module fails at import time
- Likely the genai SDK has a compatibility issue with Node v24.9.0 or missing peer dep
- **Fix:** check if `@google/genai` needs a newer version, or lazy-load it so register() doesn't fail

### 2. mc-board tests — 1 failing
- Need to run `cd ~/.openclaw/miniclaw/plugins/mc-board/ && bun test` to see which test
- Likely better-sqlite3 path issue in test context (tests run from miniclaw/plugins, not extensions)

### 3. mc-booking tests — 3 failing
- `@hono/node-server` missing in test context
- mc-booking uses hono for its embedded web server but deps are in shared extensions/node_modules, not in miniclaw/plugins

### 4. mc-reflection tests — 5 failing
- Need to investigate — run: `cd ~/.openclaw/miniclaw/plugins/mc-reflection/ && bun test`

### 5. mc-rolodex tests — 1 failing
- Need to investigate — run: `cd ~/.openclaw/miniclaw/plugins/mc-rolodex/ && bun test`

### 6. mc-stripe tests — 1 failing
- Likely missing stripe secret key in test env or API mock issue

## Warnings (5)

### 1. no backup dir
- Expected on fresh install. First backup creates it.
- **Not a real issue** — mc-backup runs on cron nightly

### 2. gemini-api-key missing
- Optional — mc-designer needs it for image generation
- Users configure in settings if they want it

### 3. stripe-secret-key missing
- Optional — mc-stripe payment processing
- Users configure if they use Stripe

### 4. square-access-token missing
- Optional — mc-square payment processing
- Users configure if they use Square

### 5. turso-booking-url missing
- Optional — mc-booking needs Turso DB for appointment scheduling
- Users configure if they use booking

## Feature: Concurrent card processing per column

OpenClaw cron fires one agent session per job — cards are processed sequentially within that session. True concurrent processing needs one of:

1. **Web app self-tick** — setInterval in the web app calls `/api/cron/tick` every 5m. The tick endpoint fires cards via `Promise.allSettled` = real parallelism. Runs alongside gateway cron.
2. **Multiple cron jobs per column** — e.g. 3 separate backlog jobs each picking 1 card. OpenClaw runs them as separate sessions = true parallel.
3. **Keep sequential** — agent picks up N cards but works them one at a time. Fine for light workloads.

Option 1 is the fastest to implement.

---

## Fixed since last run
- board.db read error — FIXED (was a query/path issue in mc-smoke)
- QMD mc-memory collection — FIXED (grep pattern was wrong)
- AGENTS.md template missing — FIXED (openclaw fork 2026.3.12)
- Anthropic API key missing — FIXED (keychain sync in Step 15d)
- better-sqlite3 NODE_MODULE_VERSION mismatch — FIXED (rebuild in Step 7)
