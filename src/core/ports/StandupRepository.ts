import type { StandupSummary, TaskSummary } from '../domain/types';

export interface StandupRepository {
  findTodayPageId(): Promise<string | null>;
  writeStandup(summary: StandupSummary, completed: TaskSummary[], active: TaskSummary[], existingPageId?: string): Promise<string>;
  writeFailedStandup(error: string): Promise<void>;
}
