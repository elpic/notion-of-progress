import type { StandupSummary } from '../domain/types';

export interface StandupRepository {
  writeStandup(summary: StandupSummary, taskCount: number): Promise<string>;
  writeFailedStandup(error: string): Promise<void>;
}
