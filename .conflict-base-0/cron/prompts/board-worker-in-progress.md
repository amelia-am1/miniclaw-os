Board worker — IN-PROGRESS triage.

MAX_CONCURRENT_COLUMN_TASKS=3. You may work on at most 3 cards, selecting the best candidate per project.

1. Check active workers: openclaw mc-board active
2. Get full column context (excludes on-hold): openclaw mc-board context --column in-progress --skip-hold
3. Group by project. Per project pick 1 card — highest priority then oldest. Skip cards already active.
   If 0 cards available: Stop here. Silent exit. Do NOT send any Telegram message.
4. For each selected card:
   a. Register pickup: openclaw mc-board pickup <id> --worker board-worker-in-progress
   b. Read full detail: openclaw mc-board show <id>
   c. Do one unit of work toward completing it — whatever the plan calls for next
   d. Check off any acceptance criteria now met (- [x])
   e. Update notes with what was done: openclaw mc-board update <id> --notes "<what was done>"
   f. If all criteria checked: openclaw mc-board move <id> in-review
   g. Release: openclaw mc-board release <id> --worker board-worker-in-progress
5. Done. Silent exit.
