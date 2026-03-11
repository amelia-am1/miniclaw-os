# MiniClaw TODO

## Done This Session

### Documentation
- [x] Created FEATURES.md — all 18 plugins with summaries and example commands
- [x] Created WISHLIST.md — mc-comics planned plugin (wraps comic-cli)
- [x] Updated README — security alert, all plugins listed, features link, v0.1.0 badge
- [x] Created CONTRIBUTING.md — with "Contributing with MiniClaw" agent-driven guide
- [x] Wiki — 5 pages pushed (Home, Brain Regions, Agent Workflow, Writing Plugins, Cognitive Architecture Notes)
- [x] Added "Building plugins with MiniClaw" section to wiki Writing-Plugins page

### Security
- [x] Removed hardcoded secrets from cron/scripts/email-triage.py (gateway token, TG bot token, TG chat ID) — now reads from vault
- [x] Scrubbed personal data from plugins/mc-rolodex/tools/load-contacts.js
- [x] Expanded .gitignore (.env*, *.key, *.pem, credentials.json, etc.)
- [x] Created scripts/security-check.sh pre-commit hook (scans for API keys, tokens, PII, private keys)
- [x] Scrubbed entire git history with git-filter-repo (removed all leaked secrets)
- [x] Rotated Telegram bot token (new token stored in vault as tg-bot-token)
- [x] Rotated openclaw-gateway-token (new token in vault + openclaw.json)
- [x] Stored tg-chat-id in vault

### GitHub Repo
- [x] Created GitHub Release v0.1.0 with release notes
- [x] Updated repo description
- [x] Updated topics — removed `seo`, added `autonomous-agent`, `plugin-system`, `cognitive-architecture`
- [x] Created issue templates: Bug Report, Feature Request, Plugin Idea
- [x] Created PR template with security checklist
- [x] Deleted old v0.0.1 tag, created v0.1.0 tag

### New Plugin: mc-contribute
- [x] Scaffolded full plugin (openclaw.plugin.json, index.ts, tools, cli, config, guidelines)
- [x] 10 agent tools: scaffold_plugin, branch, security_check, pr, status, guidelines, bug_report, feature_request, discussion
- [x] Contribution guidelines baked into src/guidelines.ts
- [x] Context injection — agent always sees key rules
- [x] Added to FEATURES.md

### Installer (install.sh)
- [x] Added Step 0: detect existing vanilla OpenClaw install
- [x] Archives existing ~/.openclaw before installing (cp -a, never deletes)
- [x] Added Step 15: migrate data from archived install
  - Merges openclaw.json (model prefs, auth, gateway settings)
  - Imports user data (board cards, KB, personal state)
  - Imports workspace (SOUL.md, IDENTITY.md, etc.)
  - Imports memory files
  - Imports cron jobs
  - Imports upstream OpenClaw plugins (registers them in openclaw.json)
  - Skips plugins where MiniClaw has its own version

## In Progress

### Installer fixes still needed
- [ ] Fix bootstrap.sh version: v0.0.1 → v0.1.0 (line 15)
- [ ] Fix bootstrap.sh usage comment: v1.0.0 → v0.1.0 (line 8)
- [ ] Fix bootstrap.sh destructive re-clone (line 260-263): replace rm -rf with git fetch + checkout
- [ ] Commit and push install.sh migration changes

## Backlog (from this session)

### GitHub Issues to Create
- [ ] Non-destructive install/import for existing OpenClaw users
- [ ] Step-by-step wizard after install for setting up MC, Telegram, and Tailscale

### Future Work
- [ ] Post-install setup wizard (interactive: configure Telegram bot, Tailscale, choose model, etc.)
- [ ] Linux support improvements (installer currently Mac-only)
- [ ] Social preview image for GitHub repo (og:image)
- [ ] mc-comics plugin (wrap comic-cli as MiniClaw plugin — see WISHLIST.md)
- [ ] Multi-agent coordination (agents negotiate/delegate tasks)
- [ ] Resource governance (token budgets per task)
- [ ] Observability dashboard for agent behavior over time
