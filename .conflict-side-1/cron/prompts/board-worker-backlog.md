Board worker — BACKLOG triage.

MAX_CONCURRENT_COLUMN_TASKS=3.

0. INTEGRITY CHECK: openclaw mc-board check-dupes --fix
   (removes stale duplicate card files before any work begins)

1. Check what is already being worked: openclaw mc-board active
2. Get full column context (excludes on-hold cards): openclaw mc-board context --column backlog --skip-hold
3. Group cards by project. For each project pick at most 1 card — highest priority, then oldest. Skip any card already in the active list.
   If 0 cards available: Stop here. Silent exit. Do NOT send any Telegram message.
4. For each selected card:
   a. Register pickup: openclaw mc-board pickup <id> --worker board-worker-backlog
   b. Read full detail: openclaw mc-board show <id>
   c. Fill any missing fields (problem, plan, criteria) — research what is needed
   d. Move to in-progress: openclaw mc-board move <id> in-progress
   e. Release: openclaw mc-board release <id> --worker board-worker-backlog
5. Done. Silent exit.
