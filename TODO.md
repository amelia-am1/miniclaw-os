# MiniClaw TODO — 2026-03-14

## Install bugs — found during dev1-4 clean test

- [x] Node version pinning — release.sh records .node-version, install.sh enforces + pins NODE_BIN
- [x] install.sh must rebuild ALL better-sqlite3 copies with the pinned node (not just shared)
- [x] install.sh must generate agent-runner LaunchAgent plist (currently manual)
- [x] mc-kb embedder hardcodes node-llama-cpp path — needs dynamic resolution
- [x] Persona files not copied during install — chat-persona.md and telegram.md added to workspace/refs templates
- [x] Assistant name displays lowercase on Anthropic setup page — .toLowerCase() on assistantName
- [x] Board log viewer stuck on "waiting for log file" when agent runner not installed
- [x] Shipped cards show no agent runs (runner never wrote them)
- [x] New cards not moving through queue — nothing calls /api/cron/tick
- [x] Board chat was Haiku API — now Claude Code CLI (haiku model) with tools, alerts, and filtered output
- [x] Telegram gateway prompt hardcoded in mc-queue — now loads from refs/telegram.md

## Clean test

- [ ] Full clean e2e test on fresh machine
- [ ] Verify triage apply works (`openclaw mc-board update`) with plugins loaded
