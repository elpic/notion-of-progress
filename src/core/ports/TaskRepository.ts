import type { TaskSummary, TaskStatus, TaskPriority } from '../domain/types';

/**
 * Request object for creating a new task.
 */
export interface CreateTaskRequest {
  /** Human-readable title for the task */
  title: string;
  /** Priority level for the task */
  priority: TaskPriority;
  /** Initial status for the task */
  status: TaskStatus;
  /** Due date in ISO string format (optional) */
  dueDate?: string;
  /** Additional notes or description (optional) */
  notes?: string;
}

/**
 * Repository interface for managing task data operations.
 * Provides methods for fetching, creating, and updating tasks.
 * 
 * This follows the Repository pattern from Domain-Driven Design,
 * allowing the core domain to remain independent of specific
 * data storage implementations.
 */
export interface TaskRepository {
  /**
   * Fetches all tasks, separated by completion status.
   * @returns Promise resolving to completed and active tasks
   * @throws Error if database connection or query fails
   */
  fetchTasks(): Promise<{
    completed: TaskSummary[];
    active: TaskSummary[];
  }>;
  
  /**
   * Creates a new task with the specified properties.
   * @param task - Task creation request data
   * @returns Promise resolving to the created task summary
   * @throws Error if task creation fails or validation errors occur
   */
  createTask(task: CreateTaskRequest): Promise<TaskSummary>;
  
  /**
   * Updates the status of an existing task.
   * @param taskId - Unique identifier of the task
   * @param newStatus - New status value to set
   * @throws Error if task doesn't exist or update fails
   */
  updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void>;
}
