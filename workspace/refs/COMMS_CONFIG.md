# COMMS_CONFIG.md — Communication Configuration

## Quick Start

### Environment Setup

Add to your OpenClaw environment (`.env` or LaunchAgent):

```bash
# Telegram bot credentials
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_HERE"
TELEGRAM_LOG_CHAT_ID="-100XXXXXXXXXX"  # Telegram group ID (negative number)

# Optional: board URL for log links
MINICLAW_BOARD_URL="http://localhost:4220"
```

### Plugin Configuration

In `plugins/mc-queue/openclaw.plugin.json`:

```json
{
  "name": "mc-queue",
  "config": {
    "enabled": true,
    "tgLogChatId": "-100XXXXXXXXXX",
    "boardUrl": "http://localhost:4220"
  }
}
```

---

## Log Channel Setup

1. Create or designate a Telegram group
2. Add your bot as a member with message send permissions
3. Get the group ID (negative number format: `-100XXXXX`)
4. Set `TELEGRAM_LOG_CHAT_ID` in your environment

---

## What Gets Logged

### Board Events (Automatic)

When a card moves through the board:

- **Ship** — Card moved to `shipped`
- **Blocked** — Card marked with blocker
- **Create** — New card created
- **Update** — Card notes updated
- **Move** — Card moved between columns

### Session Summaries

When a cron worker completes, a summary is posted to the log channel showing all events and duration.

---

## Configuration Validation

On startup, the plugin checks:
- Is bot token set in environment?
- Is chat ID set in config?
- Are formats valid?

If not configured, logging is silently disabled. Missing log events never crash the system.

---

## Troubleshooting

**Messages not appearing in log channel?**

1. Check environment variables are set
2. Verify bot is in the Telegram group
3. Check bot has "Post Messages" permission
4. Review gateway logs for errors
