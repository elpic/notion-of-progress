import { logger } from './logger';

interface RetryOptions {
  attempts: number;
  delayMs: number;
  shouldRetry?: (err: unknown) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { attempts, delayMs, shouldRetry = () => true } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !shouldRetry(err)) throw err;
      logger.warn(`Attempt ${attempt}/${attempts} failed — retrying in ${delayMs}ms`, (err as Error).message);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError;
}

export function isNotionRateLimit(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'rate_limited'
  );
}
