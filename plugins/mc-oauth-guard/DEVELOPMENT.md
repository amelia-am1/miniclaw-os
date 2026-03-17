# mc-oauth-guard Development Guide

## Architecture

### Core Components

1. **OAuthGuard Class**: Main state machine tracking OAuth failures
2. **Failure State**: Per-provider failure tracking with disable/backoff logic
3. **CLI Command**: User interface for viewing and managing state
4. **Gateway Hooks**: Integration points with OpenClaw gateway

### Flow Diagram

```
OAuth Refresh Attempt
        |
        v
    Success? ----Yes-----> recordSuccess()
        |                      |
       No                      v
        |                  Reset failures
        v                  Re-enable profile
   recordFailure()
        |
        v
   Increment counter
        |
        v
   Counter >= Threshold?
        |
    Yes |  No
    |    |----> Log warning, disable profile
    |
    v
Log recovery instructions
Attempt keychain recovery
Implement exponential backoff
```

## Key Classes

### OAuthGuard

```typescript
class OAuthGuard {
  // Track failure state per provider
  private failureStates: Map<string, OAuthFailureState>

  // Record a failed refresh attempt
  recordFailure(provider: string, error: Error): void

  // Record a successful refresh
  recordSuccess(provider: string): void

  // Check if a provider is disabled
  isDisabled(provider: string): boolean

  // Get current state of all providers
  getState(): Record<string, OAuthFailureState>

  // Clear failure state (manual recovery)
  clearFailures(provider: string): void

  // Attempt keychain recovery
  private attemptKeychainRecovery(provider: string): Promise<boolean>
}
```

### OAuthFailureState

```typescript
interface OAuthFailureState {
  provider: string;
  consecutiveFailures: number;
  lastFailureTime: number;
  isDisabled: boolean;
  nextRetryTime: number;
  disabledAt?: number;
}
```

## Integration Points

### Gateway Hooks (Planned)

The plugin registers with the OpenClaw gateway to monitor OAuth operations:

```typescript
context.hooks.registerGatewayHook('oauth-refresh-error', 
  (provider: string, error: Error) => {
    guard.recordFailure(provider, error);
  }
);

context.hooks.registerGatewayHook('oauth-refresh-success',
  (provider: string) => {
    guard.recordSuccess(provider);
  }
);
```

**Note**: These hooks are not yet available in OpenClaw 0.1.5. This plugin provides the foundation; the gateway integration is a future enhancement.

## Keychain Integration (Future)

The keychain recovery feature is stubbed but not yet implemented. To complete it:

1. Use macOS `security` command to query keychain
2. Look for credentials matching the OAuth provider (e.g., Claude Code)
3. Attempt token refresh with recovered credentials
4. Store successful tokens in OpenClaw's token store

Example implementation:

```typescript
private async attemptKeychainRecovery(provider: string): Promise<boolean> {
  const keychainItem = `Claude Code - ${provider}`;
  
  try {
    const credentials = execSync(`security find-generic-password -a ${keychainItem} -w`, {
      encoding: 'utf8'
    }).trim();
    
    // Parse credentials and attempt token refresh
    const token = await refreshOAuthToken(provider, credentials);
    
    // Store in OpenClaw token store
    await saveOAuthToken(provider, token);
    
    this.recordSuccess(provider);
    return true;
  } catch (error) {
    return false;
  }
}
```

## Testing

Run tests:

```bash
npm test
```

Test coverage focuses on:
- Failure counting
- Auto-disable logic
- Exponential backoff calculation
- State reset on success
- Multi-provider independence

Add tests for:
- Keychain integration (once implemented)
- Gateway hook registration
- CLI command parsing
- Edge cases (rapid failures, clock skew)

## Future Enhancements

### Phase 1: Foundation (Current)
- [x] Failure tracking
- [x] Auto-disable logic
- [x] Exponential backoff
- [x] Clear logging
- [ ] Gateway hook integration (needs OpenClaw enhancement)

### Phase 2: Auto-Recovery
- [ ] Keychain credential extraction
- [ ] Automatic token refresh from keychain
- [ ] Store recovered tokens

### Phase 3: User Experience
- [ ] Dashboard widget showing OAuth profile health
- [ ] Browser notification on auto-disable
- [ ] Suggested actions in UI
- [ ] One-click re-auth button

### Phase 4: Ecosystem
- [ ] Cross-process token sharing
- [ ] OAuth token store abstraction
- [ ] Support for other OAuth providers (Google, GitHub, etc.)
- [ ] Centralized OAuth credential management

## Debugging

### Enable Debug Logs

```bash
# Run with debug logging
DEBUG=mc-oauth-guard openclaw gateway start
```

### Manual Testing

```bash
# Simulate failure
node -e "
const { OAuthGuard } = require('./dist/index');
const mockContext = {
  logger: {
    info: console.log,
    warn: console.log,
    error: console.error,
    debug: console.log,
  },
  hooks: { registerGatewayHook: () => {} }
};
const guard = new OAuthGuard(mockContext);
guard.recordFailure('anthropic', new Error('Test failure'));
guard.recordFailure('anthropic', new Error('Test failure'));
guard.recordFailure('anthropic', new Error('Test failure'));
console.log(guard.getState());
"
```

## Code Style

- TypeScript with strict mode enabled
- ESLint rules inherited from miniclaw-os
- Tests required for new features
- Documentation in JSDoc format

## Contribution Guidelines

1. Fork the miniclaw-os repo
2. Create a branch: `contrib/mc-oauth-guard-<feature>`
3. Make changes in this plugin directory
4. Add/update tests
5. Update README and DEVELOPMENT.md
6. Run `npm test` and `npm run build`
7. Commit with clear messages
8. Push and open PR

## Resources

- **OpenClaw Docs**: /opt/homebrew/lib/node_modules/@miniclaw_official/openclaw/docs/
- **MiniClaw Plugin Guide**: https://github.com/augmentedmike/miniclaw-os/blob/main/CONTRIBUTING.md
- **Upstream Issue**: augmentedmike/miniclaw-os#157

## Contact

- Report bugs: https://github.com/augmentedmike/miniclaw-os/issues
- Discuss features: https://github.com/augmentedmike/miniclaw-os/discussions
- Ask questions: support@miniclaw.bot
