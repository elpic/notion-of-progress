import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      Status: { type: 'select', select: { name: 'Done' } },
      Priority: { type: 'select', select: { name: 'High' } },
      'Due Date': { type: 'date', date: { start: '2026-03-13' } },
    },
    ...overrides,
  };
}

describe('NotionTaskRepository', () => {
  let mockQuery: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockQuery = vi.fn().mockResolvedValue({ results: [], has_more: false, next_cursor: null });
    const { getNotionClient } = await import('../src/notion/client');
    (getNotionClient as ReturnType<typeof vi.fn>).mockReturnValue({
      databases: { query: mockQuery },
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
});
