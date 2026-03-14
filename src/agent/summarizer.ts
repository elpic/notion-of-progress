// TODO (Day 5): Implement Claude API summarizer
// - Build system + user prompt from TaskSummary[] arrays
// - Call claude-sonnet-4-6 and parse JSON response
// - Fallback: regex extractor if JSON is wrapped in markdown code block

import type { TaskSummary, StandupSummary } from '../notion/types.js';

export async function generateSummary(
  completed: TaskSummary[],
  active: TaskSummary[]
): Promise<StandupSummary> {
  throw new Error('Not implemented yet');
}
