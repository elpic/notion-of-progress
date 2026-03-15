import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry, isNotionRateLimit } from '../src/utils/retry';

// Speed up tests — no real delays
vi.useFakeTimers();

afterEach(() => {
  vi.clearAllTimers();
});

describe('withRetry', () => {
  it('returns the result immediately on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { attempts: 3, delayMs: 100 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { attempts: 3, delayMs: 100 });
    await vi.runAllTimersAsync();
    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent'));

    const promise = withRetry(fn, { attempts: 3, delayMs: 100 });
    promise.catch(() => {}); // prevent unhandled rejection warning while timers advance
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('persistent');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops retrying immediately when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'));

    const promise = withRetry(fn, { attempts: 3, delayMs: 100, shouldRetry: () => false });
    promise.catch(() => {}); // prevent unhandled rejection warning while timers advance
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('fatal');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('isNotionRateLimit', () => {
  it('returns true for rate_limited errors', () => {
    expect(isNotionRateLimit({ code: 'rate_limited' })).toBe(true);
  });

  it('returns false for other error codes', () => {
    expect(isNotionRateLimit({ code: 'unauthorized' })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isNotionRateLimit('string error')).toBe(false);
    expect(isNotionRateLimit(null)).toBe(false);
    expect(isNotionRateLimit(undefined)).toBe(false);
  });
});
