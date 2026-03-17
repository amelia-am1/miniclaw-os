#!/usr/bin/env bash
# ensure-card.sh — verify a board card exists for the current branch's issue
#
# Called by: post-checkout hook, or manually before starting work
# Extracts issue number from branch name (e.g. feat/123-foo → #123)
# Creates a card if one doesn't exist for that issue.

set -euo pipefail

BRANCH=$(git branch --show-current 2>/dev/null || echo "")
[[ -z "$BRANCH" ]] && exit 0
[[ "$BRANCH" == "main" ]] && exit 0

# Extract issue number from branch name
ISSUE_NUM=$(echo "$BRANCH" | grep -oE '[0-9]+' | head -1)
[[ -z "$ISSUE_NUM" ]] && exit 0

# Check if a card already exists for this issue
EXISTING=$(openclaw mc-board board 2>/dev/null | grep -i "#${ISSUE_NUM}\|issue.*${ISSUE_NUM}" || true)
if [[ -n "$EXISTING" ]]; then
  exit 0
fi

# Get issue title from GitHub
ISSUE_TITLE=$(gh issue view "$ISSUE_NUM" --json title --jq .title 2>/dev/null || echo "")
if [[ -z "$ISSUE_TITLE" ]]; then
  echo "⚠️  Branch references #${ISSUE_NUM} but no GitHub issue found"
  exit 0
fi

# Create the card
echo "📋 Creating board card for #${ISSUE_NUM}: ${ISSUE_TITLE}"
openclaw mc-board create \
  --title "#${ISSUE_NUM}: ${ISSUE_TITLE}" \
  --priority medium \
  --problem "Tracking work for GitHub issue #${ISSUE_NUM}. See: https://github.com/augmentedmike/miniclaw-os/issues/${ISSUE_NUM}" \
  2>/dev/null | tail -1

echo "✓ Card created"
