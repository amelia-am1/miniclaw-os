#!/usr/bin/env node

/**
 * mc-oauth-guard CLI
 * 
 * Commands:
 * - status [provider]: Show OAuth guard state
 * - clear [provider]: Clear failure state for a provider
 * - help: Show help
 */

import { OAuthGuard } from '../index';

const args = process.argv.slice(2);
const command = args[0] || 'status';

// Placeholder CLI - actual implementation would connect to running OpenClaw instance
export function run(guard: OAuthGuard): void {
  switch (command) {
    case 'status': {
      const provider = args[1];
      const state = guard.getState();

      if (provider) {
        const key = `oauth:${provider}`;
        const providerState = state[key];
        if (providerState) {
          console.log(`\nOAuth Guard Status for "${provider}":`);
          console.log(`  Status: ${providerState.isDisabled ? 'DISABLED' : 'ACTIVE'}`);
          console.log(`  Consecutive Failures: ${providerState.consecutiveFailures}`);
          console.log(`  Last Failure: ${new Date(providerState.lastFailureTime).toISOString()}`);
          if (providerState.disabledAt) {
            console.log(`  Disabled At: ${new Date(providerState.disabledAt).toISOString()}`);
          }
          if (providerState.isDisabled) {
            console.log(`  Next Retry: ${new Date(providerState.nextRetryTime).toISOString()}`);
          }
        } else {
          console.log(`No failure state recorded for "${provider}"`);
        }
      } else {
        console.log('\nOAuth Guard Status:');
        if (Object.keys(state).length === 0) {
          console.log('  No OAuth profiles with failures recorded');
        } else {
          for (const [key, providerState] of Object.entries(state)) {
            const provider = key.replace('oauth:', '');
            console.log(`\n  ${provider}:`);
            console.log(`    Status: ${providerState.isDisabled ? 'DISABLED' : 'ACTIVE'}`);
            console.log(`    Failures: ${providerState.consecutiveFailures}`);
          }
        }
      }
      break;
    }

    case 'clear': {
      const provider = args[1];
      if (!provider) {
        console.error('Error: provider name required');
        console.error('Usage: oauth-guard clear <provider>');
        process.exit(1);
      }
      guard.clearFailures(provider);
      console.log(`Cleared failure state for "${provider}"`);
      break;
    }

    case 'help':
    default:
      console.log(`
mc-oauth-guard CLI

Usage: oauth-guard [command] [options]

Commands:
  status [provider]    Show OAuth guard state (optional: filter by provider)
  clear <provider>     Clear failure state for a provider
  help                 Show this help message

Examples:
  oauth-guard status
  oauth-guard status anthropic
  oauth-guard clear anthropic

To re-enable a disabled OAuth profile:
  openclaw models auth paste-token --provider <provider>
      `);
      break;
  }
}

if (require.main === module) {
  console.error('Note: This CLI is a placeholder. Use "openclaw oauth-guard" from OpenClaw.');
  process.exit(1);
}
