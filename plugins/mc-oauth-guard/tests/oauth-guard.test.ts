import { OAuthGuard } from '../index';

describe('OAuthGuard', () => {
  let guard: OAuthGuard;
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
      hooks: {
        registerGatewayHook: jest.fn(),
      },
    };

    guard = new OAuthGuard(mockContext);
  });

  describe('Failure tracking', () => {
    it('should track consecutive failures', () => {
      const error = new Error('Token refresh failed');
      
      guard.recordFailure('anthropic', error);
      const state = guard.getState();
      
      expect(state['oauth:anthropic']).toBeDefined();
      expect(state['oauth:anthropic'].consecutiveFailures).toBe(1);
      expect(state['oauth:anthropic'].isDisabled).toBe(false);
    });

    it('should increment failure count on multiple failures', () => {
      const error = new Error('Token refresh failed');
      
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      
      const state = guard.getState();
      expect(state['oauth:anthropic'].consecutiveFailures).toBe(3);
    });

    it('should auto-disable after threshold', () => {
      const error = new Error('Token refresh failed');
      
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      
      const state = guard.getState();
      expect(state['oauth:anthropic'].isDisabled).toBe(true);
      expect(mockContext.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('auto-disabled'),
        expect.any(Object)
      );
    });

    it('should track multiple providers independently', () => {
      const error = new Error('Token refresh failed');
      
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      guard.recordFailure('openai', error);
      
      const state = guard.getState();
      expect(state['oauth:anthropic'].consecutiveFailures).toBe(2);
      expect(state['oauth:openai'].consecutiveFailures).toBe(1);
    });
  });

  describe('Success handling', () => {
    it('should reset failure count on success', () => {
      const error = new Error('Token refresh failed');
      
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      guard.recordSuccess('anthropic');
      
      const state = guard.getState();
      expect(state['oauth:anthropic'].consecutiveFailures).toBe(0);
      expect(state['oauth:anthropic'].isDisabled).toBe(false);
    });

    it('should log recovery when re-enabled', () => {
      const error = new Error('Token refresh failed');
      
      // Disable the profile first
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      
      mockContext.logger.info.mockClear();
      
      // Record success to re-enable
      guard.recordSuccess('anthropic');
      
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('recovered'),
        expect.any(Object)
      );
    });
  });

  describe('Status checking', () => {
    it('should report disabled status correctly', () => {
      const error = new Error('Token refresh failed');
      
      expect(guard.isDisabled('anthropic')).toBe(false);
      
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      
      expect(guard.isDisabled('anthropic')).toBe(true);
    });
  });

  describe('Failure state management', () => {
    it('should clear failure state', () => {
      const error = new Error('Token refresh failed');
      
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      guard.recordFailure('anthropic', error);
      
      guard.clearFailures('anthropic');
      
      const state = guard.getState();
      expect(state['oauth:anthropic']).toBeUndefined();
    });
  });

  describe('Exponential backoff', () => {
    it('should implement exponential backoff for disabled profiles', () => {
      const error = new Error('Token refresh failed');
      
      // Auto-disable
      for (let i = 0; i < 3; i++) {
        guard.recordFailure('anthropic', error);
      }
      
      const state1 = guard.getState();
      const nextRetry1 = state1['oauth:anthropic'].nextRetryTime;
      
      // Record another failure after disabling
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      
      guard.recordFailure('anthropic', error);
      
      const state2 = guard.getState();
      const nextRetry2 = state2['oauth:anthropic'].nextRetryTime;
      
      // Second backoff should be longer than first
      expect(nextRetry2 - nextRetry1).toBeGreaterThan(0);
      
      jest.useRealTimers();
    });
  });
});
