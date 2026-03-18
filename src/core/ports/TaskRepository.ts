import type { TaskSummary } from '../domain/types';

export interface CreateTaskRequest {
  title: string;
  priority: string;
  status: string;
  dueDate?: string;
  notes?: string;
}

export interface TaskRepository {
  fetchTasks(): Promise<{
    completed: TaskSummary[];
    active: TaskSummary[];
  }>;
  
  createTask(task: CreateTaskRequest): Promise<TaskSummary>;
  
  updateTaskStatus(taskId: string, newStatus: string): Promise<void>;
}
