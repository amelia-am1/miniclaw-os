# COMMS.md — Communication Architecture

## Overview

When multiple agents need to communicate across channels, coordinate work, and log activities, this document defines the communication layer, message routing, and identity verification system.

---

## Message Types

### 1. Direct Command
From a human to the agent, requesting action.

**Handler:** Process inline or create a board card for async work.

### 2. Cross-Agent Signal
From one agent to another, coordinating work or sharing status.

**Signal types:**
- `working_on` — agent X is working on card Y (prevents duplicate work)
- `blocked` — agent X is blocked on Y (waiting for human decision)
- `escalate` — needs human input
- `status` — heartbeat/checkpoint
- `done` — card completed

**Rules:**
- Recipient processes signal in private log (not in user-facing chat)
- Does NOT respond inline (avoids infinite loops)
- Logs to coordination channel

### 3. Status Log
Summary of work completed, board moves, etc. Async, to log channel.

### 4. Escalation
Signal that requires human attention or decision. Gets sent as DM to the human with summary and link to the relevant card.

### 5. Notification
System events — deployments, errors, alerts. Routes to log channel and DM to human if critical.

---

## Routing Rules

**From Human -> Agent:**
```
Message received
  Is it a command?
    YES -> Classify: immediate, quick, or task
      Immediate: respond from memory/KB
      Quick: tool lookup, respond in chat
      Task: create board card, ack, cron executes
    NO -> Conversational, respond naturally
```

**From Agent -> Human:**
```
  Critical/escalation -> DM to human directly
  Routine notification -> Log channel
  Success/completion -> Log channel or board card note
```

**From Agent -> Agent (via signal):**
```
  Verify sender identity (trust session, signature check)
  Route via configured delivery (API, file-based, etc.)
  Recipient processes in private log, no inline response
```

---

## Security

1. **Signed messages:** All cross-agent communication must be signed
2. **Rate limiting:** Prevent spam from malicious actors
3. **Audit trail:** Every signal logged for review
4. **Access control:** Define what each agent can ask others to do
5. **No direct state access:** Agents can't modify each other's state directly (only via signals)

---

## Configuration

Required environment variables:

```bash
# Agent bot credentials
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN_HERE"
TELEGRAM_LOG_CHAT_ID="-100XXXXXXXXXX"

# Trust/Identity
MC_TRUST_DIR="~/.openclaw/trust"
COMMS_SIGNATURE_KEY="base64_encoded_key"

# Routing
COMMS_DELIVERY_MODE="telegram|redis|file"
```

See `refs/COMMS_CONFIG.md` for detailed setup instructions.
