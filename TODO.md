# MiniClaw Install TODO — 2026-03-14

## Critical — must fix before next clean test

- [x] 1. Publish openclaw 2026.3.10 (mc-* security scan skip + root-alias fix)
- [x] 2. Fix plugins not loading — removed required fields from mc-designer, mc-substack, mc-trust
- [x] 3. Wire LogDisplay component into InstallOverlay + TriageModal
- [ ] 4. Welcome wizard cron enable — needs clean test to verify

## Ready for clean test

- [ ] 5. Rebuild release zip + full clean e2e test
- [ ] 6. Verify triage apply works (`openclaw mc-board update`) with plugins loaded
- [ ] 7. Yank old openclaw npm versions

## Nice to have

- [ ] 8. Refactor wizard state to context/provider/hook pattern
- [ ] 9. Rename PascalCase files to kebab-case
