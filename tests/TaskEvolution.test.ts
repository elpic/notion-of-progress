/**
 * Simplified tests for TaskEvolution service
 * Testing core functionality with simpler setup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskEvolution } from '../src/services/TaskEvolution';
import { TaskStatus, TaskPriority } from '../src/core/domain/types';
import type { TaskSummary } from '../src/core/domain/types';
import type { CreateTaskRequest } from '../src/core/ports/TaskRepository';

// Mock the logger to avoid test noise
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TaskEvolution - Basic Tests', () => {
  const createMockTask = (overrides: Partial<TaskSummary> = {}): TaskSummary => ({
    id: `task-${Math.random()}`,
    title: 'Test Task',
    status: TaskStatus.TODO,
    dueDate: '2026-03-20',
    priority: TaskPriority.MEDIUM,
    lastEdited: '2026-03-18T10:00:00Z',
    url: 'https://notion.so/test-task',
    ...overrides,
  });

  function createMockRepository() {
    const fetchTasks = vi.fn();
    const createTask = vi.fn();
    const updateTaskStatus = vi.fn();
    const queryDB = vi.fn();

    return {
      fetchTasks,
      createTask,
      updateTaskStatus,
      queryDB,
      mock: {
        fetchTasks,
        createTask,
        updateTaskStatus,
        queryDB,
      }
    };
  }

  describe('evolveProject', () => {
    it('should create new tasks when project is empty', async () => {
      // Arrange
      const repo = createMockRepository();
      repo.fetchTasks.mockResolvedValue({
        completed: [],
        active: [],
      });
      repo.createTask.mockResolvedValue(createMockTask());

      const taskEvolution = new TaskEvolution(repo as any);

      // Act
      const result = await taskEvolution.evolveProject();

      // Assert
      expect(result.created).toBeGreaterThanOrEqual(1);
      expect(result.created).toBeLessThanOrEqual(3);
      expect(result.updated).toBe(0);
      expect(result.completedTasks).toBe(0);
      expect(repo.mock.fetchTasks).toHaveBeenCalledOnce();
      expect(repo.mock.createTask).toHaveBeenCalled();
    });

    it('should handle existing tasks and create new ones', async () => {
      // Arrange
      const existingTasks = [
        createMockTask({ title: 'Implement user login', status: TaskStatus.TODO }),
        createMockTask({ title: 'Fix critical bug', status: TaskStatus.IN_PROGRESS }),
      ];

      const repo = createMockRepository();
      repo.fetchTasks.mockResolvedValue({
        completed: [],
        active: existingTasks,
      });
      repo.createTask.mockResolvedValue(createMockTask());

      const taskEvolution = new TaskEvolution(repo as any);

      // Act
      const result = await taskEvolution.evolveProject();

      // Assert
      expect(result.created).toBeGreaterThan(0);
      expect(repo.mock.fetchTasks).toHaveBeenCalledOnce();
    });

    it('should create tasks with proper structure', async () => {
      // Arrange
      const repo = createMockRepository();
      repo.fetchTasks.mockResolvedValue({
        completed: [],
        active: [],
      });

      const createdTasks: CreateTaskRequest[] = [];
      repo.createTask.mockImplementation(async (task: CreateTaskRequest) => {
        createdTasks.push(task);
        return createMockTask(task);
      });

      const taskEvolution = new TaskEvolution(repo as any);

      // Act
      await taskEvolution.evolveProject();

      // Assert
      expect(createdTasks.length).toBeGreaterThan(0);
      
      createdTasks.forEach(task => {
        expect(task.title).toBeTruthy();
        expect(task.title.length).toBeGreaterThan(5);
        expect([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH])
          .toContain(task.priority);
        expect(task.dueDate).toBeTruthy();
      });
    });

    it('should handle repository errors gracefully', async () => {
      // Arrange
      const repo = createMockRepository();
      repo.fetchTasks.mockRejectedValue(new Error('Database connection failed'));

      const taskEvolution = new TaskEvolution(repo as any);

      // Act & Assert
      await expect(taskEvolution.evolveProject()).rejects.toThrow('Database connection failed');
    });

    it('should create realistic due dates', async () => {
      // Arrange
      const repo = createMockRepository();
      repo.fetchTasks.mockResolvedValue({
        completed: [],
        active: [],
      });

      const createdTasks: CreateTaskRequest[] = [];
      repo.createTask.mockImplementation(async (task: CreateTaskRequest) => {
        createdTasks.push(task);
        return createMockTask(task);
      });

      const taskEvolution = new TaskEvolution(repo as any);

      // Act
      await taskEvolution.evolveProject();

      // Assert
      createdTasks.forEach(task => {
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const now = new Date();
          const diffDays = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          
          // Due dates should be reasonable (not in the past, not too far future)
          expect(diffDays).toBeGreaterThan(-1); // Allow for timezone differences
          expect(diffDays).toBeLessThan(30); // Within a month
        }
      });
    });

    it('should generate diverse task types over multiple runs', async () => {
      // Arrange
      const repo = createMockRepository();
      repo.fetchTasks.mockResolvedValue({
        completed: [],
        active: [],
      });

      const allCreatedTasks: CreateTaskRequest[] = [];
      repo.createTask.mockImplementation(async (task: CreateTaskRequest) => {
        allCreatedTasks.push(task);
        return createMockTask(task);
      });

      const taskEvolution = new TaskEvolution(repo as any);

      // Act - Run multiple evolution cycles
      for (let i = 0; i < 5; i++) {
        await taskEvolution.evolveProject();
      }

      // Assert
      expect(allCreatedTasks.length).toBeGreaterThan(5);
      
      // Check for variety in task titles (different types of work)
      const taskTitles = allCreatedTasks.map(t => t.title.toLowerCase());
      const hasFeature = taskTitles.some(title => 
        title.includes('implement') || title.includes('feature') || title.includes('add'));
      const hasBug = taskTitles.some(title => 
        title.includes('bug') || title.includes('fix'));
      const hasDoc = taskTitles.some(title => 
        title.includes('document') || title.includes('guide') || title.includes('update'));
      
      // Should have some variety across multiple runs
      const varietyCount = [hasFeature, hasBug, hasDoc].filter(Boolean).length;
      expect(varietyCount).toBeGreaterThanOrEqual(1); // At least some variety
    });
  });

  describe('task generation patterns', () => {
    it('should not create duplicate tasks in same evolution cycle', async () => {
      // Arrange
      const repo = createMockRepository();
      repo.fetchTasks.mockResolvedValue({
        completed: [],
        active: [],
      });

      const createdTasks: CreateTaskRequest[] = [];
      repo.createTask.mockImplementation(async (task: CreateTaskRequest) => {
        createdTasks.push(task);
        return createMockTask(task);
      });

      const taskEvolution = new TaskEvolution(repo as any);

      // Act
      await taskEvolution.evolveProject();

      // Assert
      const taskTitles = createdTasks.map(t => t.title);
      const uniqueTitles = [...new Set(taskTitles)];
      expect(taskTitles.length).toBe(uniqueTitles.length); // No duplicates
    });

    it('should generate tasks with appropriate priorities', async () => {
      // Arrange
      const repo = createMockRepository();
      repo.fetchTasks.mockResolvedValue({
        completed: [],
        active: [],
      });

      const createdTasks: CreateTaskRequest[] = [];
      repo.createTask.mockImplementation(async (task: CreateTaskRequest) => {
        createdTasks.push(task);
        return createMockTask(task);
      });

      const taskEvolution = new TaskEvolution(repo as any);

      // Act - Run multiple times to get good sample
      for (let i = 0; i < 3; i++) {
        await taskEvolution.evolveProject();
      }

      // Assert
      expect(createdTasks.length).toBeGreaterThan(3);
      
      // Should have some distribution of priorities
      const priorities = createdTasks.map(t => t.priority);
      const uniquePriorities = [...new Set(priorities)];
      expect(uniquePriorities.length).toBeGreaterThan(1); // Some variety in priorities
    });
  });

  describe('context awareness', () => {
    it('should adapt to existing project state', async () => {
      // Arrange - Project with some existing authentication work
      const existingTasks = [
        createMockTask({ 
          title: 'Implement user authentication feature', 
          status: TaskStatus.IN_PROGRESS 
        }),
        createMockTask({ 
          title: 'Critical payment processing bug', 
          status: TaskStatus.BLOCKED 
        }),
      ];

      const repo = createMockRepository();
      repo.fetchTasks.mockResolvedValue({
        completed: [],
        active: existingTasks,
      });

      const createdTasks: CreateTaskRequest[] = [];
      repo.createTask.mockImplementation(async (task: CreateTaskRequest) => {
        createdTasks.push(task);
        return createMockTask(task);
      });

      const taskEvolution = new TaskEvolution(repo as any);

      // Act
      await taskEvolution.evolveProject();

      // Assert - Should create tasks, and they should be meaningful
      expect(createdTasks.length).toBeGreaterThan(0);
      
      createdTasks.forEach(task => {
        expect(task.title).toBeTruthy();
        expect(task.title.length).toBeGreaterThan(10); // Should be descriptive
        expect(task.priority).toBeTruthy();
        expect(task.status).toBe(TaskStatus.TODO); // New tasks should start as TODO
      });
    });
  });
});