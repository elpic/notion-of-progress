function timestamp() {
  return new Date().toISOString();
}

function newRunId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeLogger(runId: string) {
  return {
    info: (msg: string, ...args: unknown[]) =>
      console.log(`[${timestamp()}][${runId}] INFO  ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) =>
      console.error(`[${timestamp()}][${runId}] ERROR ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) =>
      console.warn(`[${timestamp()}][${runId}] WARN  ${msg}`, ...args),
  };
}

// Default logger — used outside of a run invocation (startup, scheduler lifecycle)
export const logger = makeLogger(newRunId());

// Creates a fresh logger with a new runId for each invocation
export function createRunLogger() {
  return makeLogger(newRunId());
}
