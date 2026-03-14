import type { TaskSummary, StandupSummary } from '../domain/types';

export interface SummaryGenerator {
  generateSummary(
    completed: TaskSummary[],
    active: TaskSummary[]
  ): Promise<StandupSummary>;
}
