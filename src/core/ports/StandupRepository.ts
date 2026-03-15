import type { StandupSummary, TaskSummary } from '../domain/types';

export interface StandupRepository {
  existsForToday(): Promise<boolean>;
  writeStandup(summary: StandupSummary, completed: TaskSummary[], active: TaskSummary[]): Promise<string>;
  writeFailedStandup(error: string): Promise<void>;
}
