# @miniclaw/logging

Structured JSON logger for the miniclaw-os plugin ecosystem.

## JSON Output Format

Every log entry is a single-line JSON object:

```json
{
  "timestamp": "2026-03-06T19:00:00.000Z",
  "level": "info",
  "name": "mc-board",
  "message": "Card created",
  "context": { "cardId": "crd_abc123", "priority": "high" }
}
```

Fields:
- `timestamp` — ISO-8601 UTC string
- `level` — one of `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- `name` — logger name (plugin id or subsystem path like `mc-board/triage`)
- `message` — human-readable description
- `context` — optional structured key/value pairs (omitted when empty)

## Usage

```ts
import { createLogger } from "../shared/logging/logger.js";

const log = createLogger("mc-board");
log.info("Card created", { cardId: "crd_abc123" });

// Child logger for a subsystem — name becomes "mc-board/triage"
const triageLog = log.child("triage");
triageLog.warn("Retrying after error", { attempt: 2 });
```

## Configuration

All options can be set via constructor options or environment variables.

### Log level

```
MINICLAW_LOG_LEVEL=debug   # trace | debug | info | warn | error | fatal | silent
```

Default: `info`

### Output format

```
MINICLAW_LOG_FORMAT=json   # json | text
```

Default: `json` when stdout is not a TTY (e.g. in production/CI), `text` in an interactive terminal.

Text format: `[HH:MM:SS] [LEVEL] [name] message {"key":"val"}`

### File logging with rotation

```ts
const log = createLogger("mc-board", {
  file: "/path/to/mc-board.log",
  maxFileBytes: 50 * 1024 * 1024,  // rotate at 50 MB (default)
  maxBackups: 5,                    // keep 5 rotated files (default)
});
```

Environment variable overrides:
```
MINICLAW_LOG_MAX_FILE_BYTES=52428800   # bytes (default: 50 MB)
MINICLAW_LOG_MAX_BACKUPS=5             # number of backup files (default: 5)
```

Rotation behaviour:
- When the active log file exceeds `maxFileBytes`, it is renamed to `<file>.1`.
- Existing backups are shifted: `.1` → `.2`, `.2` → `.3`, etc.
- The oldest backup beyond `maxBackups` is deleted.
- A rotation notice (JSON line) is written at the top of the new active file.
- Set `maxBackups=0` to disable rotation — writes stop when the cap is reached and a single warning is emitted to stderr.

File output is always JSON regardless of the console format setting.

## Querying logs

Because every line is a valid JSON object, logs are easily queried with standard tools:

```bash
# Show all errors
grep '"level":"error"' mc-board.log | jq .

# Filter by context field
jq 'select(.context.cardId == "crd_abc123")' mc-board.log

# Show last 100 lines across rotated files
cat mc-board.log.5 mc-board.log.4 mc-board.log.3 mc-board.log.2 mc-board.log.1 mc-board.log | tail -100 | jq .
```

## Running tests

```bash
cd plugins/shared/logging
bun run test
```

All 25 tests cover: JSON schema compliance, level filtering, text format, child loggers, file writing, rotation, backup retention, and the `maxBackups=0` cap behaviour.
