import type { TaskSummary } from '../domain/types';

export interface TaskRepository {
  fetchTasks(): Promise<{
    completed: TaskSummary[];
    active: TaskSummary[];
  }>;
}
