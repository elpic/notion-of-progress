// TODO (Day 5): Implement Claude API summary generator
// - Build system + user prompt from TaskSummary arrays
// - Call claude-sonnet-4-6 and parse JSON response
// - Fallback: regex extractor if JSON is wrapped in markdown code block

import type { SummaryGenerator } from '../../core/ports/SummaryGenerator';
import type { TaskSummary, StandupSummary } from '../../core/domain/types';

export class ClaudeSummaryGenerator implements SummaryGenerator {
  async generateSummary(
    _completed: TaskSummary[],
    _active: TaskSummary[]
  ): Promise<StandupSummary> {
    throw new Error('Not implemented yet');
  }
}
