const runId = Math.random().toString(36).slice(2, 8).toUpperCase();

function timestamp() {
  return new Date().toISOString();
}

export const logger = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`[${timestamp()}][${runId}] INFO  ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`[${timestamp()}][${runId}] ERROR ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[${timestamp()}][${runId}] WARN  ${msg}`, ...args),
};
