-- mc-board seed data — default projects and starter cards
-- Run AFTER schema.sql. Safe to re-run (uses INSERT OR IGNORE).

INSERT OR IGNORE INTO projects (id, name, slug, description, status, created_at, updated_at)
VALUES
  ('prj_uncategorized', 'Uncategorized', 'uncategorized', 'Default project for unassigned cards', 'active', datetime('now'), datetime('now')),
  ('prj_miniclaw_enh', 'MiniClaw Enhancements', 'miniclaw-enhancements', 'Improvements and new features for MiniClaw', 'active', datetime('now'), datetime('now')),
  ('prj_setup', 'Setup finalization', 'setup-finalization', 'MiniClaw setup finalization and verification', 'active', datetime('now'), datetime('now'));

-- Starter cards (safe to re-run — uses INSERT OR IGNORE with fixed IDs)
INSERT OR IGNORE INTO cards (id, title, col, priority, tags, project_id, created_at, updated_at, problem_description, acceptance_criteria)
VALUES
  ('crd_seed_verify', 'Verify MiniClaw installation', 'backlog', 'high', '["setup","verification"]', 'prj_setup', datetime('now'), datetime('now'),
    'Run mc-smoke and verify all checks pass. If any fail, run mc-doctor --auto to fix them.',
    'mc-smoke reports 0 failures.'),
  ('crd_seed_cron_backlog', 'Enable backlog cron worker', 'backlog', 'high', '["setup","cron"]', 'prj_setup', datetime('now'), datetime('now'),
    'The backlog cron worker automatically triages new cards every 5 minutes. Verify it is registered in ~/.openclaw/cron/jobs.json and the gateway is running to execute it.',
    'board-worker-backlog job exists in jobs.json and gateway is running.'),
  ('crd_seed_cron_workers', 'Enable in-progress and in-review cron workers', 'backlog', 'medium', '["setup","cron"]', 'prj_setup', datetime('now'), datetime('now'),
    'The in-progress worker does one unit of work per card every 5 minutes. The in-review worker verifies completed work and ships or sends back. Both should be in jobs.json.',
    'board-worker-in-progress and board-worker-in-review jobs exist in jobs.json.'),
  ('crd_seed_meet_human', 'Get to know my human', 'backlog', 'high', '["onboarding","human"]', 'prj_setup', datetime('now'), datetime('now'),
    'Collect basic information from your human: their name, email address, what they do, and what they would like help with. Save this to the workspace memory so you can personalize your interactions.',
    'Human name, email, and general instructions are saved to workspace memory.');
