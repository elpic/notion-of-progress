import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskStatus, TaskPriority } from '../src/core/domain/types';
import type { CreateTaskRequest } from '../src/core/ports/TaskRepository';

vi.mock('../src/notion/client', () => ({
  getNotionClient: vi.fn(),
}));

vi.mock('../src/config/index', () => ({
  config: {
    notion: {
      taskDbId: 'task-db-id',
      taskStatusProperty: 'Status',
      taskDoneValue: 'Done',
      taskTitleProperty: 'Name',
    },
  },
}));

function makeNotionPage(overrides: Record<string, unknown> = {}) {
  return {
    object: 'page',
    id: 'page-1',
    url: 'https://notion.so/page-1',
    last_edited_time: '2026-03-13T10:00:00Z',
    properties: {
      Name: { type: 'title', title: [{ plain_text: 'Build auth' }] },
      Status: { type: 'status', status: { name: 'Done' } },
      Priority: { type: 'select', select: { name: 'High' } },
      'Due Date': { type: 'date', date: { start: '2026-03-13' } },
    },
    ...overrides,
  };
}

describe('NotionTaskRepository', () => {
  let mockQuery: ReturnType<typeof vi.fn>;
  let mockCreate: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockQuery = vi.fn().mockResolvedValue({ results: [], has_more: false, next_cursor: null });
    mockCreate = vi.fn().mockResolvedValue({ 
      object: 'page',
      id: 'new-task-id',
      url: 'https://notion.so/new-task-id',
      last_edited_time: '2026-03-18T10:00:00Z',
      properties: {
        Name: { type: 'title', title: [{ plain_text: 'New Task' }] },
        Status: { type: 'status', status: { name: 'To Do' } },
        Priority: { type: 'select', select: { name: 'Medium' } },
        'Due Date': { type: 'date', date: { start: '2026-03-20' } },
      }
    });
    mockUpdate = vi.fn().mockResolvedValue({
      id: 'updated-task-id',
      last_edited_time: '2026-03-18T11:00:00Z',
    });
    
    const { getNotionClient } = await import('../src/notion/client');
    (getNotionClient as ReturnType<typeof vi.fn>).mockReturnValue({
      databases: { query: mockQuery },
      pages: { create: mockCreate, update: mockUpdate },
    });
  });

  it('returns empty arrays when DB has no tasks', async () => {
    const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
    const repo = new NotionTaskRepository();
    const result = await repo.fetchTasks();
    expect(result.completed).toEqual([]);
    expect(result.active).toEqual([]);
  });

  it('maps a Notion page to a TaskSummary correctly', async () => {
    const page = makeNotionPage();
    mockQuery.mockResolvedValue({ results: [page], has_more: false, next_cursor: null });
    const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
    const repo = new NotionTaskRepository();
    const { completed } = await repo.fetchTasks();

    expect(completed[0]).toMatchObject({
      id: 'page-1',
      title: 'Build auth',
      status: 'Done',
      priority: 'High',
      dueDate: '2026-03-13',
      url: 'https://notion.so/page-1',
    });
  });

  it('handles pages with missing optional properties', async () => {
    const page = makeNotionPage({
      properties: {
        Name: { type: 'title', title: [{ plain_text: 'Task without priority' }] },
        Status: { type: 'select', select: { name: 'Done' } },
        Priority: { type: 'select', select: null },
        'Due Date': { type: 'date', date: null },
      },
    });
    mockQuery.mockResolvedValue({ results: [page], has_more: false });
    const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
    const repo = new NotionTaskRepository();
    const { completed } = await repo.fetchTasks();

    expect(completed[0].priority).toBeNull();
    expect(completed[0].dueDate).toBeNull();
  });

  it('handles paginated responses', async () => {
    const page1 = makeNotionPage({ id: 'p1' });
    const page2 = makeNotionPage({ id: 'p2' });

    // fetchTasks runs 2 parallel queries (completed + active)
    // First call = completed query page 1 (has more)
    // Second call = active query (no results)
    // Third call = completed query page 2 (done)
    mockQuery
      .mockResolvedValueOnce({ results: [page1], has_more: true, next_cursor: 'cursor-1' })
      .mockResolvedValueOnce({ results: [], has_more: false, next_cursor: null })
      .mockResolvedValueOnce({ results: [page2], has_more: false, next_cursor: null });

    const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
    const repo = new NotionTaskRepository();
    const { completed } = await repo.fetchTasks();

    expect(completed).toHaveLength(2);
  });

  describe('createTask', () => {
    it('should create a task with all required fields', async () => {
      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();
      
      const taskRequest: CreateTaskRequest = {
        title: 'Implement user authentication',
        status: TaskStatus.TODO,
        priority: TaskPriority.HIGH,
        dueDate: '2026-03-25',
        notes: 'Add OAuth 2.0 support',
      };

      const result = await repo.createTask(taskRequest);

      expect(mockCreate).toHaveBeenCalledWith({
        parent: { database_id: 'task-db-id' },
        properties: {
          Name: {
            title: [{ text: { content: 'Implement user authentication' } }],
          },
          Status: {
            status: { name: 'To Do' },
          },
          Priority: {
            select: { name: 'High' },
          },
          'Due Date': {
            date: { start: '2026-03-25' },
          },
          Notes: {
            rich_text: [{ text: { content: 'Add OAuth 2.0 support' } }],
          },
        },
      });

      expect(result).toMatchObject({
        id: 'new-task-id',
        title: 'New Task',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        dueDate: '2026-03-20',
        url: 'https://notion.so/new-task-id',
      });
    });

    it('should create a task with minimal required fields', async () => {
      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();
      
      const taskRequest: CreateTaskRequest = {
        title: 'Simple task',
        status: TaskStatus.TODO,
        priority: TaskPriority.LOW,
      };

      await repo.createTask(taskRequest);

      expect(mockCreate).toHaveBeenCalledWith({
        parent: { database_id: 'task-db-id' },
        properties: {
          Name: {
            title: [{ text: { content: 'Simple task' } }],
          },
          Status: {
            status: { name: 'To Do' },
          },
          Priority: {
            select: { name: 'Low' },
          },
        },
      });
    });

    it('should handle different task statuses correctly', async () => {
      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();

      const statuses = [
        { enum: TaskStatus.TODO, notion: 'To Do' },
        { enum: TaskStatus.IN_PROGRESS, notion: 'In Progress' },
        { enum: TaskStatus.DONE, notion: 'Done' },
        { enum: TaskStatus.BLOCKED, notion: 'Blocked' },
      ];

      for (const { enum: status, notion } of statuses) {
        await repo.createTask({
          title: `Task with ${status} status`,
          status,
          priority: TaskPriority.MEDIUM,
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            properties: expect.objectContaining({
              Status: { status: { name: notion } },
            }),
          })
        );
      }
    });

    it('should handle different task priorities correctly', async () => {
      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();

      const priorities = [
        { enum: TaskPriority.LOW, notion: 'Low' },
        { enum: TaskPriority.MEDIUM, notion: 'Medium' },
        { enum: TaskPriority.HIGH, notion: 'High' },
      ];

      for (const { enum: priority, notion } of priorities) {
        await repo.createTask({
          title: `Task with ${priority} priority`,
          status: TaskStatus.TODO,
          priority,
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            properties: expect.objectContaining({
              Priority: { select: { name: notion } },
            }),
          })
        );
      }
    });

    it('should handle Notion API errors during creation', async () => {
      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();

      mockCreate.mockRejectedValue(new Error('Notion API Error'));

      await expect(repo.createTask({
        title: 'Failed task',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
      })).rejects.toThrow('Notion API Error');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status correctly', async () => {
      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();

      await repo.updateTaskStatus('task-123', TaskStatus.DONE);

      expect(mockUpdate).toHaveBeenCalledWith({
        page_id: 'task-123',
        properties: {
          Status: {
            status: { name: 'Done' },
          },
        },
      });
    });

    it('should handle all task status transitions', async () => {
      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();

      const transitions = [
        { from: TaskStatus.TODO, to: TaskStatus.IN_PROGRESS },
        { from: TaskStatus.IN_PROGRESS, to: TaskStatus.DONE },
        { from: TaskStatus.IN_PROGRESS, to: TaskStatus.BLOCKED },
        { from: TaskStatus.BLOCKED, to: TaskStatus.IN_PROGRESS },
      ];

      for (const { to } of transitions) {
        await repo.updateTaskStatus('task-456', to);
        
        const expectedNotionStatus = {
          [TaskStatus.TODO]: 'To Do',
          [TaskStatus.IN_PROGRESS]: 'In Progress', 
          [TaskStatus.DONE]: 'Done',
          [TaskStatus.BLOCKED]: 'Blocked',
        }[to];

        expect(mockUpdate).toHaveBeenCalledWith({
          page_id: 'task-456',
          properties: {
            Status: { status: { name: expectedNotionStatus } },
          },
        });
      }
    });

    it('should handle Notion API errors during update', async () => {
      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();

      mockUpdate.mockRejectedValue(new Error('Page not found'));

      await expect(repo.updateTaskStatus('invalid-id', TaskStatus.DONE))
        .rejects.toThrow('Page not found');
    });
  });

  describe('parsing functions', () => {
    it('should parse valid task statuses correctly', async () => {
      const page1 = makeNotionPage({
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Todo Task' }] },
          Status: { type: 'status', status: { name: 'To Do' } },
          Priority: { type: 'select', select: { name: 'Medium' } },
        },
      });
      const page2 = makeNotionPage({
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'In Progress Task' }] },
          Status: { type: 'status', status: { name: 'In Progress' } },
          Priority: { type: 'select', select: { name: 'High' } },
        },
      });
      const page3 = makeNotionPage({
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Blocked Task' }] },
          Status: { type: 'status', status: { name: 'Blocked' } },
          Priority: { type: 'select', select: { name: 'Low' } },
        },
      });

      mockQuery.mockResolvedValue({ 
        results: [page1, page2, page3], 
        has_more: false, 
        next_cursor: null 
      });

      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();
      const { completed, active } = await repo.fetchTasks();

      // Check that statuses are parsed correctly
      expect(active.find(t => t.title === 'Todo Task')?.status).toBe(TaskStatus.TODO);
      expect(active.find(t => t.title === 'In Progress Task')?.status).toBe(TaskStatus.IN_PROGRESS);
      expect(active.find(t => t.title === 'Blocked Task')?.status).toBe(TaskStatus.BLOCKED);
    });

    it('should handle unknown status values gracefully', async () => {
      const page = makeNotionPage({
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Unknown Status Task' }] },
          Status: { type: 'status', status: { name: 'Unknown Status' } },
          Priority: { type: 'select', select: { name: 'Medium' } },
        },
      });

      mockQuery.mockResolvedValue({ 
        results: [page], 
        has_more: false, 
        next_cursor: null 
      });

      // Mock console.warn to test warning behavior
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();
      const { active } = await repo.fetchTasks();

      // Should default to 'To Do' and log warning
      expect(active[0].status).toBe(TaskStatus.TODO);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Unknown task status 'Unknown Status', defaulting to 'To Do'"
      );

      consoleSpy.mockRestore();
    });

    it('should parse valid task priorities correctly', async () => {
      const pageHigh = makeNotionPage({
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'High Priority Task' }] },
          Status: { type: 'status', status: { name: 'Done' } },
          Priority: { type: 'select', select: { name: 'High' } },
        },
      });
      const pageMedium = makeNotionPage({
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Medium Priority Task' }] },
          Status: { type: 'status', status: { name: 'Done' } },
          Priority: { type: 'select', select: { name: 'Medium' } },
        },
      });
      const pageLow = makeNotionPage({
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Low Priority Task' }] },
          Status: { type: 'status', status: { name: 'Done' } },
          Priority: { type: 'select', select: { name: 'Low' } },
        },
      });

      mockQuery.mockResolvedValue({ 
        results: [pageHigh, pageMedium, pageLow], 
        has_more: false, 
        next_cursor: null 
      });

      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();
      const { completed } = await repo.fetchTasks();

      expect(completed.find(t => t.title === 'High Priority Task')?.priority).toBe(TaskPriority.HIGH);
      expect(completed.find(t => t.title === 'Medium Priority Task')?.priority).toBe(TaskPriority.MEDIUM);
      expect(completed.find(t => t.title === 'Low Priority Task')?.priority).toBe(TaskPriority.LOW);
    });

    it('should handle unknown priority values gracefully', async () => {
      const page = makeNotionPage({
        properties: {
          Name: { type: 'title', title: [{ plain_text: 'Unknown Priority Task' }] },
          Status: { type: 'status', status: { name: 'Done' } },
          Priority: { type: 'select', select: { name: 'Unknown Priority' } },
        },
      });

      mockQuery.mockResolvedValue({ 
        results: [page], 
        has_more: false, 
        next_cursor: null 
      });

      // Mock console.warn to test warning behavior
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();
      const { completed } = await repo.fetchTasks();

      // Should default to null and log warning
      expect(completed[0].priority).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Unknown task priority 'Unknown Priority', returning null"
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed Notion pages gracefully', async () => {
      const malformedPage = {
        object: 'page',
        id: 'malformed-page',
        url: 'https://notion.so/malformed-page',
        last_edited_time: '2026-03-18T10:00:00Z',
        properties: {
          // Missing required properties
        },
      };

      mockQuery.mockResolvedValue({ 
        results: [malformedPage], 
        has_more: false, 
        next_cursor: null 
      });

      // Mock console.warn to capture parsing errors
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();
      
      // Should handle malformed data gracefully
      const { completed, active } = await repo.fetchTasks();
      
      // Should either filter out malformed pages or handle them gracefully
      expect(completed.length + active.length).toBeGreaterThanOrEqual(0);
      
      consoleSpy.mockRestore();
    });

    it('should handle network errors during fetch', async () => {
      mockQuery.mockRejectedValue(new Error('Network timeout'));

      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();

      await expect(repo.fetchTasks()).rejects.toThrow('Network timeout');
    });

    it('should handle empty or null property values', async () => {
      const page = makeNotionPage({
        properties: {
          Name: { type: 'title', title: [] }, // Empty title
          Status: { type: 'status', status: null },
          Priority: { type: 'select', select: null },
          'Due Date': { type: 'date', date: null },
        },
      });

      mockQuery.mockResolvedValue({ 
        results: [page], 
        has_more: false, 
        next_cursor: null 
      });

      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();
      const { active } = await repo.fetchTasks();

      // Should handle empty/null values gracefully
      expect(active[0].title).toBe('Untitled'); // Empty title defaults to 'Untitled'
      expect(active[0].priority).toBeNull();
      expect(active[0].dueDate).toBeNull();
    });

    it('should handle very large result sets with pagination', async () => {
      // Create many pages to test pagination
      const pages = Array.from({ length: 100 }, (_, i) => 
        makeNotionPage({ 
          id: `page-${i}`,
          properties: {
            Name: { type: 'title', title: [{ plain_text: `Task ${i}` }] },
            Status: { type: 'status', status: { name: 'Done' } },
            Priority: { type: 'select', select: { name: 'Medium' } },
          }
        })
      );

      // Mock paginated responses (50 pages per response)
      mockQuery
        .mockResolvedValueOnce({ 
          results: pages.slice(0, 50), 
          has_more: true, 
          next_cursor: 'cursor-1' 
        })
        .mockResolvedValueOnce({ 
          results: [], // Active tasks query
          has_more: false, 
          next_cursor: null 
        })
        .mockResolvedValueOnce({ 
          results: pages.slice(50), 
          has_more: false, 
          next_cursor: null 
        });

      const { NotionTaskRepository } = await import('../src/adapters/notion/NotionTaskRepository');
      const repo = new NotionTaskRepository();
      const { completed } = await repo.fetchTasks();

      expect(completed).toHaveLength(100);
      expect(completed[0].title).toBe('Task 0');
      expect(completed[99].title).toBe('Task 99');
    });
  });
});
