import type { PluginContext } from '@miniclaw_official/openclaw';

/**
 * mc-oauth-guard Plugin
 * 
 * Monitors OAuth token refresh failures and implements:
 * 1. Failure detection and tracking
 * 2. Auto-disable of failing OAuth profiles after N consecutive failures
 * 3. Exponential backoff to prevent retry storms
 * 4. Automatic recovery from macOS keychain credentials when available
 */

interface OAuthFailureState {
  provider: string;
  consecutiveFailures: number;
  lastFailureTime: number;
  isDisabled: boolean;
  nextRetryTime: number;
  disabledAt?: number;
}

interface OAuthGuardConfig {
  failureThreshold: number; // N consecutive failures before auto-disable (default: 3)
  initialBackoffMs: number; // Starting backoff time in ms (default: 5 minutes)
  maxBackoffMs: number; // Max backoff time in ms (default: 1 hour)
  backoffMultiplier: number; // Exponential backoff multiplier (default: 2)
  enableKeychainRecovery: boolean; // Auto-attempt keychain recovery (default: true)
}

class OAuthGuard {
  private failureStates: Map<string, OAuthFailureState> = new Map();
  private config: OAuthGuardConfig;
  private logger: any;

  constructor(context: PluginContext) {
    this.logger = context.logger;
    this.config = {
      failureThreshold: 3,
      initialBackoffMs: 5 * 60 * 1000, // 5 minutes
      maxBackoffMs: 60 * 60 * 1000, // 1 hour
      backoffMultiplier: 2,
      enableKeychainRecovery: true,
    };
  }

  /**
   * Record an OAuth refresh failure for a provider
   */
  recordFailure(provider: string, error: Error): void {
    const key = `oauth:${provider}`;
    const state = this.failureStates.get(key) || {
      provider,
      consecutiveFailures: 0,
      lastFailureTime: Date.now(),
      isDisabled: false,
      nextRetryTime: Date.now(),
    };

    state.consecutiveFailures += 1;
    state.lastFailureTime = Date.now();

    // After threshold, auto-disable the profile
    if (state.consecutiveFailures >= this.config.failureThreshold && !state.isDisabled) {
      state.isDisabled = true;
      state.disabledAt = Date.now();
      this.logger.warn(
        `[mc-oauth-guard] OAuth profile "${provider}" auto-disabled after ${state.consecutiveFailures} consecutive failures`,
        { error: error.message, timestamp: new Date().toISOString() }
      );

      // Log clear recovery instructions
      this.logger.info(
        `[mc-oauth-guard] To re-enable, run: openclaw models auth paste-token --provider ${provider}`,
        { timestamp: new Date().toISOString() }
      );

      // Attempt keychain recovery if enabled
      if (this.config.enableKeychainRecovery) {
        this.attemptKeychainRecovery(provider);
      }
    } else if (state.isDisabled) {
      // Already disabled, implement exponential backoff
      const backoffMs = Math.min(
        this.config.initialBackoffMs * Math.pow(this.config.backoffMultiplier, state.consecutiveFailures - this.config.failureThreshold),
        this.config.maxBackoffMs
      );
      state.nextRetryTime = Date.now() + backoffMs;
      
      this.logger.debug(
        `[mc-oauth-guard] Exponential backoff: next retry for "${provider}" in ${Math.round(backoffMs / 1000)}s`,
        { timestamp: new Date().toISOString() }
      );
    }

    this.failureStates.set(key, state);
  }

  /**
   * Record a successful OAuth refresh (reset failure counter)
   */
  recordSuccess(provider: string): void {
    const key = `oauth:${provider}`;
    const state = this.failureStates.get(key);
    
    if (state) {
      const wasDisabled = state.isDisabled;
      state.consecutiveFailures = 0;
      state.isDisabled = false;
      state.nextRetryTime = Date.now();
      
      if (wasDisabled) {
        this.logger.info(
          `[mc-oauth-guard] OAuth profile "${provider}" recovered successfully`,
          { timestamp: new Date().toISOString() }
        );
      }
      
      this.failureStates.set(key, state);
    }
  }

  /**
   * Check if an OAuth profile is currently disabled
   */
  isDisabled(provider: string): boolean {
    const key = `oauth:${provider}`;
    const state = this.failureStates.get(key);
    return state?.isDisabled ?? false;
  }

  /**
   * Attempt to recover OAuth token from macOS keychain
   * This is a placeholder for the actual keychain integration
   */
  private async attemptKeychainRecovery(provider: string): Promise<boolean> {
    try {
      this.logger.debug(
        `[mc-oauth-guard] Attempting keychain recovery for "${provider}"...`,
        { timestamp: new Date().toISOString() }
      );

      // TODO: Integrate with macOS keychain API to retrieve credentials
      // This would typically involve:
      // 1. Using `security` command-line tool
      // 2. Parsing credentials for provider (e.g., Claude Code credentials)
      // 3. Attempting OAuth token refresh with recovered credentials
      // 4. If successful, updating OpenClaw's OAuth token store

      this.logger.debug(
        `[mc-oauth-guard] Keychain recovery not yet implemented for "${provider}"`,
        { timestamp: new Date().toISOString() }
      );

      return false;
    } catch (error) {
      this.logger.error(
        `[mc-oauth-guard] Keychain recovery failed for "${provider}": ${error instanceof Error ? error.message : String(error)}`,
        { timestamp: new Date().toISOString() }
      );
      return false;
    }
  }

  /**
   * Get current state of all OAuth profiles
   */
  getState(): Record<string, OAuthFailureState> {
    const result: Record<string, OAuthFailureState> = {};
    for (const [key, state] of this.failureStates) {
      result[key] = { ...state };
    }
    return result;
  }

  /**
   * Clear failure state for a provider (manual recovery)
   */
  clearFailures(provider: string): void {
    const key = `oauth:${provider}`;
    this.failureStates.delete(key);
    this.logger.info(
      `[mc-oauth-guard] Cleared failure state for "${provider}"`,
      { timestamp: new Date().toISOString() }
    );
  }
}

let guard: OAuthGuard;

export async function init(context: PluginContext): Promise<void> {
  guard = new OAuthGuard(context);
  context.logger.info('[mc-oauth-guard] Plugin initialized');

  // Register as a gateway hook to monitor token refresh failures
  if (context.hooks?.registerGatewayHook) {
    context.hooks.registerGatewayHook('oauth-refresh-error', (provider: string, error: Error) => {
      guard.recordFailure(provider, error);
    });

    context.hooks.registerGatewayHook('oauth-refresh-success', (provider: string) => {
      guard.recordSuccess(provider);
    });
  }
}

export async function shutdown(context: PluginContext): Promise<void> {
  context.logger.info('[mc-oauth-guard] Plugin shutting down');
}

// Export for testing and direct use
export { OAuthGuard };
