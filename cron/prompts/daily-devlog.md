# Daily Devlog Cron

## Job
Aggregate yesterday's work across git commits, merged PRs, closed issues, and shipped board cards. Credit every contributor by name. Publish as devlog post to GitHub Discussions, blog, and optionally Substack.

## What to Do

1. Run: `openclaw mc-devlog run`
   - Gathers yesterday's activity from:
     - Git commits: `git log --since yesterday --until today`
     - Merged PRs: `gh pr list --state merged`
     - Closed issues: `gh issue list --state closed`
     - Shipped board cards: `openclaw mc-board board --column done`
   
2. Formats as devlog markdown with:
   - Title with date
   - List of changes grouped by contributor
   - Counts of PRs, issues, cards
   - Canonical footer

3. Publishes to:
   - GitHub Discussions (primary)
   - mc-blog (local post)
   - mc-substack (if configured)
   - Flags mc-reddit for weekly digest

## Expected Output

- GitHub Discussion created in "Devlog" category
- Blog post written to postsDir
- Console shows formatted devlog
- Exit code 0 on success

## Configuration

- Timezone: America/Chicago (8am CT daily)
- Repository: augmentedmike/miniclaw-os
- Contributor mapping: via mc-devlog config

## On Failure

- Check: `gh auth status`
- Check: git log access in repo directory
- Check: mc-board accessibility
- Logs available in OpenClaw session transcript
