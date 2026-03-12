# MiniClaw TODO — v0.1.5

## This Session (2026-03-12)

### install.sh
- [x] Kill processes on ports 4210/4220 during pre-flight (Step 0b)
- [x] Suppress all bun/npm/brew install noise — output goes to log only
- [x] Progress lines: `[ ] Installing mc-foo` → `[✓] Installed mc-foo`
- [x] Plugin install shows summary count instead of per-plugin deps lines
- [x] Copy MANIFEST.json into `$MINICLAW_DIR/` for runtime version detection
- [x] Read pinned openclaw npm package from MANIFEST.json `openclaw.npm`
- [x] Remove Anthropic auth from terminal install (belongs in web wizard)
- [x] Remove plan tiers from terminal install (belongs in web wizard)
- [ ] Verify full e2e install on clean `~/.openclaw` — rerun after all changes

### OpenClaw fork (augmentedmike/openclaw)
- [x] MiniClaw banner: `🦀 MiniClaw {version}` for `mc-*` commands, normal `🦞 OpenClaw` otherwise
- [x] Version read dynamically from `~/.openclaw/miniclaw/MANIFEST.json`
- [x] Tagged `v0.1.5` on the fork
- [ ] Republish npm as `@miniclaw_official/openclaw@0.1.5` for version parity
- [ ] Pin MANIFEST.json `openclaw.npm` to `@miniclaw_official/openclaw@0.1.5` after publish

### am-setup wizard (port 4210)
- [x] Removed relocate step (no home dir moving)
- [x] Added Anthropic step — 3-page flow: explain compute → pick plan → paste token
- [x] Plan tiers: $20 Light / $100 Average (recommended) / $200 Power
- [x] "I already have my Claude subscription" link
- [x] Explains compute in normie-friendly language
- [x] Notes: subscription = cheaper than API, flat price, no surprise bills, gets better over time
- [x] Each wizard step has its own URL path (`/setup/meet`, `/setup/anthropic`, etc.)
- [x] API route `/api/setup/anthropic` to save token via `openclaw models auth paste-token`
- [ ] Bump text sizes across ALL wizard steps — text is way too small, pages can scroll vertically
- [ ] Test all step URLs load correctly after rebuild
- [ ] Test Anthropic token paste actually saves to auth-profiles
- [ ] Wire `claude setup-token` instructions — consider if we can trigger it from the web

### Pending from prior sessions
- [ ] Default crons not fully seeded: email heartbeat (15m), nightly reflection (3am) missing from Step 12
- [ ] boot.md inclusion in miniclaw-os install (user requested, not yet addressed)
- [ ] Store GitHub token in vault as `am-m3-dev`
- [ ] Migrate old data (board.db, KB, memos, workspace, memories) from `~/newam/` into fresh `~/.openclaw`

## Backlog

### Testing
- [ ] mc-board: `better-sqlite3` not supported in bun (43 failing tests)
- [ ] mc-vend: same `better-sqlite3` issue (31 failing)
- [ ] shared: same issue in logging tests (23 failing)
- [ ] mc-docs: 2 pre-existing failures
- [ ] openclaw CLI not on PATH in some shell contexts

### Plugin Registration
- [ ] Register missing plugins in MANIFEST.json: mc-blog, mc-contribute, mc-docs, mc-human, mc-memo, mc-seo, mc-voice

### Future
- [ ] Linux support (installer currently Mac-only)
- [ ] Multi-agent coordination
- [ ] Resource governance (token budgets per task)
- [ ] Observability dashboard
