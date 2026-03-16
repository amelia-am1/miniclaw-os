# BOARD_WORKFLOW.md — Verification System & Priority Levels

## Overview

The board implements a **verification workflow** that pairs work cards with verify cards. This ensures work is properly validated before shipping, and automatically resets work cards when verification fails.

**Key insight:** A work card is an **implementation task**. A verify card is a **validation task**. They are linked: work card ships, verify card runs, if verify fails the work card resets to in-progress with criteria cleared.

---

## Priority Levels

| Level | When to Use | Examples |
|-------|------------|---------|
| **CRITICAL** | Production bugs, release blockers, security incidents | System down, security vuln, blocking multiple cards |
| **HIGH** | Important work actively blocking other cards | Feature needed for next release, staging bug |
| **MEDIUM** | Important but not blocking | Performance optimization, UI polish |
| **LOW** | Default for most work | Backlog items, docs, cleanup, experiments |

Board sorts by priority (CRITICAL first), then by creation date within each level.

All priorities require: title, problem, plan, and acceptance criteria before moving to in-progress.

---

## Work vs Verify Cards

**Work Card** — Implement or create something.
- Lifecycle: backlog -> in-progress -> in-review -> shipped
- Must have all acceptance criteria checked before shipping

**Verify Card** — Validate that work actually works.
- Created after the work card ships
- Linked to the work card via `linked_card_id`
- Title starts with "VERIFY: "
- If validation fails: create a bug card, don't ship the verify card

---

## Auto-Archive Behavior

When a work card fails to ship (unchecked criteria at the in-review -> shipped gate):

1. All verify cards linked to that work card get auto-archived
2. Work card moves back to in-progress
3. All acceptance criteria on the work card get cleared
4. Work card is ready for re-work

**Purpose:** If work doesn't ship, there's nothing to verify.

---

## Card Lifecycle

```
WORK CARD:
  backlog -> in-progress -> in-review -> [GATE: all criteria checked?]
    YES -> shipped (ready for verification)
    NO  -> reset to in-progress, criteria cleared, linked verify cards archived

VERIFY CARD:
  backlog -> in-progress -> in-review
    PASS (all criteria checked) -> shipped
    FAIL (issues found) -> create bug card, don't ship, auto-archived when work resets
```

---

## Creating a Work/Verify Pair

1. **Create work card** in backlog with title, problem, plan, criteria
2. **Work through it**: backlog -> in-progress -> in-review -> shipped
3. **Create verify card** after shipping: "VERIFY: [what you're validating]"
   - Set `linked_card_id` to the work card's ID
   - Tag with: `verify`, `verification`, `work_type:verify`
4. **Run validation**: move verify card through the board, check criteria as you go
5. **If validation fails**: create a bug card, don't ship the verify card

---

## Best Practices

- **Work card titles**: Action verbs + object ("Deploy X", "Build Y", "Fix Z")
- **Verify card titles**: "VERIFY: " + what you're validating
- **Always set `linked_card_id`** on verify cards — without it, auto-archive won't trigger
- **Work criteria** = implementation steps (what done means)
- **Verify criteria** = validation steps (what correct means)

---

## Troubleshooting

- **Verify card won't ship?** Check all criteria. Mark complete only when validation is done.
- **Work card auto-reset but verify card gone?** Correct behavior — verify card was auto-archived because the work didn't ship. Fix the work, re-ship, create a fresh verify card.
- **Multiple verifications needed?** One verify card per work card. Use criteria to cover multiple scenarios, or split into separate work cards.
