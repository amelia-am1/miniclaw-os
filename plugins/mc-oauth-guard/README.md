# mc-oauth-guard

Monitor OAuth token refresh failures and implement automatic recovery.

## Problem

When multiple OAuth-using applications share the same tokens (e.g., Claude Code and OpenClaw both using Anthropic credentials), one application may rotate the refresh token, invalidating the other's copy. This causes:

- Repeated OAuth refresh failures (95+ retries logged every 5 minutes)
- Error logs filling with retry storms
- No automatic recovery mechanism
- Manual re-authentication required

## Solution

mc-oauth-guard provides:

1. **Failure Detection**: Tracks consecutive OAuth refresh failures per provider
2. **Auto-Disable**: After N consecutive failures, automatically disables the failing OAuth profile
3. **Exponential Backoff**: Prevents retry storms by implementing exponential backoff
4. **Clear Messaging**: Logs clear recovery instructions
5. **Automatic Recovery**: Attempts to recover from macOS keychain credentials (when available)

## Installation

```bash
# The plugin is included in MiniClaw
# It loads automatically when OpenClaw starts
```

## Configuration

Edit `~/.openclaw/openclaw.json` to customize:

```json
{
  "plugins": {
    "mc-oauth-guard": {
      "failureThreshold": 3,
      "initialBackoffMs": 300000,
      "maxBackoffMs": 3600000,
      "backoffMultiplier": 2,
      "enableKeychainRecovery": true
    }
  }
}
```

- **failureThreshold** (default: 3): Number of consecutive failures before auto-disable
- **initialBackoffMs** (default: 300000): Starting backoff time (5 minutes)
- **maxBackoffMs** (default: 3600000): Maximum backoff time (1 hour)
- **backoffMultiplier** (default: 2): Exponential backoff multiplier
- **enableKeychainRecovery** (default: true): Auto-attempt keychain recovery

## Usage

### View Status

```bash
# Show all OAuth profiles with failures
openclaw oauth-guard status

# Show status for a specific provider
openclaw oauth-guard status anthropic
```

### Clear Failure State

```bash
# Clear failure tracking (allows immediate retry)
openclaw oauth-guard clear anthropic
```

### Re-Enable a Profile

When an OAuth profile is auto-disabled, you'll see a message like:

```
[mc-oauth-guard] OAuth profile "anthropic" auto-disabled after 3 consecutive failures
[mc-oauth-guard] To re-enable, run: openclaw models auth paste-token --provider anthropic
```

Run the suggested command:

```bash
openclaw models auth paste-token --provider anthropic
```

## How It Works

1. **Monitoring**: Gateway hooks track OAuth refresh successes and failures
2. **Counting**: Consecutive failures are counted per provider
3. **Threshold**: After reaching the threshold, the profile is marked as disabled
4. **Backoff**: Disabled profiles implement exponential backoff to prevent retry storms
5. **Recovery**: User runs the re-auth command to restore the profile
6. **Keychain**: Future versions will auto-recover from keychain credentials

## Logs

Look for `[mc-oauth-guard]` messages in the gateway logs:

```bash
# Watch real-time logs
openclaw gateway logs --follow | grep oauth-guard

# Check historical logs
grep oauth-guard /tmp/openclaw/openclaw-*.log
```

## Troubleshooting

**Q: My OAuth profile keeps getting disabled**

A: This means the token is being rotated by another application. Options:
   1. Don't run Claude Code and OpenClaw simultaneously
   2. Use separate OAuth tokens for each application
   3. Implement token-sharing mechanism between Claude Code and OpenClaw

**Q: How do I prevent auto-disable?**

A: Increase `failureThreshold` in the config, but this just delays the inevitable. Better to fix the root cause (duplicate token rotation).

**Q: Can keychain recovery be enabled?**

A: It's enabled by default, but full implementation requires macOS keychain API integration. Currently logs attempts but does not auto-recover.

## Development

### Build

```bash
cd ~/.openclaw/miniclaw/plugins/mc-oauth-guard
npm run build
```

### Test

```bash
npm test
```

## Upstream

This plugin is designed for miniclaw-os. To contribute improvements:

1. Create a branch: `contrib/mc-oauth-guard-<feature>`
2. Push and open a PR to `augmentedmike/miniclaw-os`
3. Reference upstream issue: #157 (OAuth token refresh failures)

## Related

- **Upstream Issue**: augmentedmike/miniclaw-os#157
- **Card**: crd_66b04ec7 (OAuth token refresh fails for Anthropic Claude Max subscription)
