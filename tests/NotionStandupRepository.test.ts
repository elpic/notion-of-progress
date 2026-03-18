/**
 * Tests for NotionStandupRepository
 * 
 * Comprehensive test suite for the Notion standup page creation and management.
 * Tests rich text formatting, block building, and Notion API integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StandupSummary, TaskSummary } from '../src/core/domain/types';
import { TaskStatus, TaskPriority } from '../src/core/domain/types';

// Mock dependencies
const mockNotionClient = {
  databases: {
    query: vi.fn(),
  },
  pages: {
    create: vi.fn(),
    update: vi.fn(),
  },
  blocks: {
    children: {
      list: vi.fn(),
      append: vi.fn(),
    },
    delete: vi.fn(),
  },
};

vi.mock('../src/notion/client', () => ({
  getNotionClient: () => mockNotionClient,
}));

vi.mock('../src/config/index', () => ({
  config: {
    notion: {
      standupLogDbId: 'test-standup-db-id',
    },
  },
}));

vi.mock('../src/utils/retry', () => ({
  withRetry: vi.fn((fn) => fn()),
  isNotionRateLimit: vi.fn(),
}));

vi.mock('../src/utils/dateHelpers', () => ({
  todayISO: () => '2026-03-18',
  todayFormatted: () => 'March 18, 2026',
}));

vi.mock('../src/utils/icons', () => ({
  randomIcon: () => '🚀',
}));

// Helper function to create test data
function createMockTask(overrides: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: TaskStatus.DONE,
    priority: TaskPriority.HIGH,
    dueDate: '2026-03-18',
    lastEdited: '2026-03-18T10:00:00Z',
    url: 'https://notion.so/task-1',
    ...overrides,
  };
}

function createMockSummary(overrides: Partial<StandupSummary> = {}): StandupSummary {
  return {
    yesterday: [
      { text: 'Completed feature A', taskId: 'task-1' },
      { text: 'Fixed bug in component B' },
    ],
    today: [
      { text: 'Start working on feature C', taskId: 'task-2' },
      { text: 'Review pull requests' },
    ],
    blockers: [
      { text: 'Waiting for API documentation' },
    ],
    ...overrides,
  };
}

describe('NotionStandupRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotionClient.databases.query.mockResolvedValue({
      results: [],
    });
    mockNotionClient.pages.create.mockResolvedValue({
      id: 'new-page-id',
      url: 'https://notion.so/new-page-id',
    });
    mockNotionClient.pages.update.mockResolvedValue({
      id: 'updated-page-id',
      url: 'https://notion.so/updated-page-id',
    });
    mockNotionClient.blocks.children.list.mockResolvedValue({
      results: [],
      has_more: false,
      next_cursor: null,
    });
  });

  describe('findTodayPageId', () => {
    it('should return null when no page exists for today', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });

      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();

      // Act
      const result = await repo.findTodayPageId();

      // Assert
      expect(result).toBeNull();
      expect(mockNotionClient.databases.query).toHaveBeenCalledWith({
        database_id: 'test-standup-db-id',
        filter: { property: 'Date', date: { equals: '2026-03-18' } },
        page_size: 1,
      });
    });

    it('should return page ID when page exists for today', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [{ id: 'existing-page-id' }],
      });

      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();

      // Act
      const result = await repo.findTodayPageId();

      // Assert
      expect(result).toBe('existing-page-id');
    });

    it('should handle database query errors gracefully', async () => {
      // Arrange
      mockNotionClient.databases.query.mockRejectedValue(new Error('Database error'));

      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();

      // Act & Assert
      await expect(repo.findTodayPageId()).rejects.toThrow('Database error');
    });
  });

  describe('writeStandup', () => {
    it('should create new standup page with correct structure', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const summary = createMockSummary();
      const completed = [createMockTask({ id: 'task-1', status: TaskStatus.DONE })];
      const active = [createMockTask({ id: 'task-2', status: TaskStatus.IN_PROGRESS })];

      // Act
      const result = await repo.writeStandup(summary, completed, active);

      // Assert
      expect(result).toBe('https://notion.so/new-page-id');
      expect(mockNotionClient.pages.create).toHaveBeenCalledWith({
        parent: { database_id: 'test-standup-db-id' },
        icon: { type: 'emoji', emoji: '🚀' },
        properties: {
          Title: { title: [{ type: 'text', text: { content: 'Standup · March 18, 2026' } }] },
          Date: { date: { start: '2026-03-18' } },
          Status: { select: { name: 'Generated' } },
          'Tasks Reviewed': { number: 2 },
        },
        children: expect.arrayContaining([
          // Summary callout
          expect.objectContaining({
            type: 'callout',
            callout: expect.objectContaining({
              rich_text: [expect.objectContaining({
                text: { content: '1 completed · 1 active · 1 blocker', link: null },
              })],
              color: 'gray_background',
            }),
          }),
          // Yesterday section
          expect.objectContaining({
            type: 'callout',
            callout: expect.objectContaining({
              rich_text: [expect.objectContaining({
                text: { content: 'Yesterday', link: null },
              })],
              color: 'green_background',
            }),
          }),
          // Today section  
          expect.objectContaining({
            type: 'callout',
            callout: expect.objectContaining({
              rich_text: [expect.objectContaining({
                text: { content: 'Today', link: null },
              })],
              color: 'blue_background',
            }),
          }),
          // Blockers section
          expect.objectContaining({
            type: 'callout',
            callout: expect.objectContaining({
              rich_text: [expect.objectContaining({
                text: { content: 'Blockers', link: null },
              })],
              color: 'red_background',
            }),
          }),
        ]),
      });
    });

    it('should create page with linked task bullets', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const summary = createMockSummary({
        yesterday: [{ text: 'Completed feature A', taskId: 'task-1' }],
        today: [{ text: 'Start feature B', taskId: 'task-2' }],
        blockers: [],
      });
      const completed = [createMockTask({ 
        id: 'task-1', 
        title: 'Feature A',
        url: 'https://notion.so/task-1',
        status: TaskStatus.DONE 
      })];
      const active = [createMockTask({ 
        id: 'task-2', 
        title: 'Feature B',
        url: 'https://notion.so/task-2',
        status: TaskStatus.IN_PROGRESS 
      })];

      // Act
      await repo.writeStandup(summary, completed, active);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const bullets = createCall.children.filter((child: any) => child.type === 'bulleted_list_item');
      
      // Should have yesterday bullet with link
      const yesterdayBullet = bullets.find((b: any) => 
        b.bulleted_list_item.rich_text.some((rt: any) => rt.text.content === 'Completed feature A')
      );
      expect(yesterdayBullet).toBeDefined();
      expect(yesterdayBullet.bulleted_list_item.rich_text).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: { content: ' ↗', link: { url: 'https://notion.so/task-1' } },
          }),
        ])
      );

      // Should have today bullet with link
      const todayBullet = bullets.find((b: any) => 
        b.bulleted_list_item.rich_text.some((rt: any) => rt.text.content === 'Start feature B')
      );
      expect(todayBullet).toBeDefined();
      expect(todayBullet.bulleted_list_item.rich_text).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: { content: ' ↗', link: { url: 'https://notion.so/task-2' } },
          }),
        ])
      );
    });

    it('should handle empty sections with default messages', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const summary = createMockSummary({
        yesterday: [],
        today: [],
        blockers: [],
      });

      // Act
      await repo.writeStandup(summary, [], []);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const bullets = createCall.children.filter((child: any) => child.type === 'bulleted_list_item');
      
      const bulletTexts = bullets.map((b: any) => 
        b.bulleted_list_item.rich_text[0].text.content
      );
      
      expect(bulletTexts).toContain('Nothing completed yesterday.');
      expect(bulletTexts).toContain('Nothing planned for today.');
      expect(bulletTexts).toContain('No blockers.');
    });

    it('should update existing page when existingPageId is provided', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const summary = createMockSummary();
      const existingBlocks = [
        { id: 'block-1' },
        { id: 'block-2' },
      ];
      
      mockNotionClient.blocks.children.list.mockResolvedValue({
        results: existingBlocks,
        has_more: false,
        next_cursor: null,
      });

      // Act
      const result = await repo.writeStandup(summary, [], [], 'existing-page-id');

      // Assert
      expect(result).toBe('https://notion.so/updated-page-id');
      
      // Should delete existing blocks
      expect(mockNotionClient.blocks.delete).toHaveBeenCalledTimes(2);
      expect(mockNotionClient.blocks.delete).toHaveBeenCalledWith({ block_id: 'block-1' });
      expect(mockNotionClient.blocks.delete).toHaveBeenCalledWith({ block_id: 'block-2' });
      
      // Should append new blocks
      expect(mockNotionClient.blocks.children.append).toHaveBeenCalledWith({
        block_id: 'existing-page-id',
        children: expect.any(Array),
      });
      
      // Should update page properties
      expect(mockNotionClient.pages.update).toHaveBeenCalledWith({
        page_id: 'existing-page-id',
        properties: expect.objectContaining({
          Title: { title: [{ type: 'text', text: { content: 'Standup · March 18, 2026' } }] },
          Date: { date: { start: '2026-03-18' } },
          Status: { select: { name: 'Generated' } },
          'Tasks Reviewed': { number: 0 },
        }),
      });
    });

    it('should handle paginated block deletion for large pages', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      // Mock paginated response
      mockNotionClient.blocks.children.list
        .mockResolvedValueOnce({
          results: [{ id: 'block-1' }, { id: 'block-2' }],
          has_more: true,
          next_cursor: 'cursor-1',
        })
        .mockResolvedValueOnce({
          results: [{ id: 'block-3' }],
          has_more: false,
          next_cursor: null,
        });

      // Act
      await repo.writeStandup(createMockSummary(), [], [], 'existing-page-id');

      // Assert
      expect(mockNotionClient.blocks.children.list).toHaveBeenCalledTimes(2);
      expect(mockNotionClient.blocks.children.list).toHaveBeenNthCalledWith(1, {
        block_id: 'existing-page-id',
        start_cursor: undefined,
      });
      expect(mockNotionClient.blocks.children.list).toHaveBeenNthCalledWith(2, {
        block_id: 'existing-page-id',
        start_cursor: 'cursor-1',
      });
      
      // Should delete all blocks across pages
      expect(mockNotionClient.blocks.delete).toHaveBeenCalledTimes(3);
    });

    it('should handle tasks reviewed count correctly', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const completed = [
        createMockTask({ id: 'task-1' }),
        createMockTask({ id: 'task-2' }),
      ];
      const active = [
        createMockTask({ id: 'task-3' }),
        createMockTask({ id: 'task-4' }),
        createMockTask({ id: 'task-5' }),
      ];

      // Act
      await repo.writeStandup(createMockSummary(), completed, active);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties['Tasks Reviewed']).toEqual({ number: 5 });
    });

    it('should handle Notion API errors gracefully', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      mockNotionClient.pages.create.mockRejectedValue(new Error('Notion API error'));

      // Act & Assert
      await expect(repo.writeStandup(createMockSummary(), [], [])).rejects.toThrow('Notion API error');
    });

    it('should handle unexpected partial response from Notion', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'new-page-id',
        // Missing url property (partial response)
      });

      // Act & Assert
      await expect(repo.writeStandup(createMockSummary(), [], []))
        .rejects.toThrow('Unexpected partial response from Notion');
    });
  });

  describe('writeFailedStandup', () => {
    it('should create failed standup page with error message', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const errorMessage = 'Claude API timeout';

      // Act
      await repo.writeFailedStandup(errorMessage);

      // Assert
      expect(mockNotionClient.pages.create).toHaveBeenCalledWith({
        parent: { database_id: 'test-standup-db-id' },
        properties: {
          Title: { title: [{ type: 'text', text: { content: 'Standup — 2026-03-18 (Failed)' } }] },
          Date: { date: { start: '2026-03-18' } },
          Status: { select: { name: 'Failed' } },
          'Tasks Reviewed': { number: 0 },
        },
        children: [
          expect.objectContaining({
            type: 'callout',
            callout: expect.objectContaining({
              rich_text: [expect.objectContaining({
                text: { content: 'Standup generation failed: Claude API timeout', link: null },
              })],
              color: 'red_background',
            }),
          }),
        ],
      });
    });

    it('should handle errors gracefully without throwing', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      mockNotionClient.pages.create.mockRejectedValue(new Error('Network error'));

      // Act & Assert - should not throw
      await expect(repo.writeFailedStandup('Original error')).resolves.toBeUndefined();
    });

    it('should handle different error message types', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const errorMessages = [
        'Simple error',
        'Error with "quotes" and special chars: &<>',
        'Very long error message that might exceed typical limits and contains detailed stack traces with lots of information',
      ];

      for (const errorMessage of errorMessages) {
        vi.clearAllMocks();
        
        // Act
        await repo.writeFailedStandup(errorMessage);

        // Assert
        const createCall = mockNotionClient.pages.create.mock.calls[0][0];
        const calloutText = createCall.children[0].callout.rich_text[0].text.content;
        expect(calloutText).toBe(`Standup generation failed: ${errorMessage}`);
      }
    });
  });

  describe('page content structure validation', () => {
    it('should include all required page sections', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      // Act
      await repo.writeStandup(createMockSummary(), [createMockTask()], [createMockTask()]);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const content = JSON.stringify(createCall.children);
      
      // Should contain all major sections
      expect(content).toContain('Yesterday');
      expect(content).toContain('Today');
      expect(content).toContain('Blockers');
      expect(content).toContain('Generated by Notion of Progress');
      
      // Should have dividers for structure
      expect(createCall.children).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'divider' }),
        ])
      );
    });

    it('should format blockers section color based on presence of blockers', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      // Test with blockers
      await repo.writeStandup(createMockSummary({ blockers: [{ text: 'API issue' }] }), [], []);
      const withBlockersCall = mockNotionClient.pages.create.mock.calls[0][0];
      const blockersCalloutWithBlockers = withBlockersCall.children.find((child: any) =>
        child.type === 'callout' && 
        child.callout.rich_text.some((rt: any) => rt.text.content === 'Blockers')
      );
      expect(blockersCalloutWithBlockers.callout.color).toBe('red_background');

      vi.clearAllMocks();

      // Test without blockers
      await repo.writeStandup(createMockSummary({ blockers: [] }), [], []);
      const withoutBlockersCall = mockNotionClient.pages.create.mock.calls[0][0];
      const blockersCalloutWithoutBlockers = withoutBlockersCall.children.find((child: any) =>
        child.type === 'callout' && 
        child.callout.rich_text.some((rt: any) => rt.text.content === 'Blockers')
      );
      expect(blockersCalloutWithoutBlockers.callout.color).toBe('gray_background');
    });

    it('should include timestamp in footer', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
      Date.prototype.toLocaleTimeString = vi.fn().mockReturnValue('3:45:12 PM');

      // Act
      await repo.writeStandup(createMockSummary(), [], []);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const footerParagraph = createCall.children.find((child: any) =>
        child.type === 'paragraph' && 
        child.paragraph.rich_text.some((rt: any) => 
          rt.text.content.includes('Generated by Notion of Progress')
        )
      );
      expect(footerParagraph).toBeDefined();
      expect(footerParagraph.paragraph.rich_text[0].text.content).toContain('3:45:12 PM');
      
      // Cleanup
      Date.prototype.toLocaleTimeString = originalToLocaleTimeString;
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle bullets without taskId gracefully', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const summary = createMockSummary({
        yesterday: [
          { text: 'Task with ID', taskId: 'task-1' },
          { text: 'Task without ID' }, // No taskId
        ],
      });

      // Act
      await repo.writeStandup(summary, [createMockTask({ id: 'task-1' })], []);

      // Assert - should not throw and handle both cases
      expect(mockNotionClient.pages.create).toHaveBeenCalled();
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const bullets = createCall.children.filter((child: any) => child.type === 'bulleted_list_item');
      
      // Should have both bullets
      expect(bullets.length).toBeGreaterThanOrEqual(2);
      
      // One with link, one without
      const bulletWithLink = bullets.find((b: any) => 
        b.bulleted_list_item.rich_text.some((rt: any) => rt.text.link)
      );
      const bulletWithoutLink = bullets.find((b: any) => 
        b.bulleted_list_item.rich_text.length === 1 &&
        b.bulleted_list_item.rich_text[0].text.content === 'Task without ID'
      );
      
      expect(bulletWithLink).toBeDefined();
      expect(bulletWithoutLink).toBeDefined();
    });

    it('should handle tasks with missing URLs', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      const summary = createMockSummary({
        yesterday: [{ text: 'Completed task', taskId: 'task-1' }],
      });
      const taskWithoutUrl = createMockTask({ id: 'task-1', url: undefined as any });

      // Act
      await repo.writeStandup(summary, [taskWithoutUrl], []);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const bullets = createCall.children.filter((child: any) => child.type === 'bulleted_list_item');
      const yesterdayBullet = bullets.find((b: any) => 
        b.bulleted_list_item.rich_text.some((rt: any) => rt.text.content === 'Completed task')
      );
      
      expect(yesterdayBullet).toBeDefined();
      expect(yesterdayBullet.bulleted_list_item.rich_text.length).toBe(1); // No link added
    });

    it('should handle very large number of tasks', async () => {
      // Arrange
      const { NotionStandupRepository } = await import('../src/adapters/notion/NotionStandupRepository');
      const repo = new NotionStandupRepository();
      
      // Create 100 completed tasks and 50 active tasks
      const completed = Array.from({ length: 100 }, (_, i) => 
        createMockTask({ id: `completed-${i}`, title: `Completed Task ${i}` })
      );
      const active = Array.from({ length: 50 }, (_, i) => 
        createMockTask({ id: `active-${i}`, title: `Active Task ${i}` })
      );

      const summary = createMockSummary({
        yesterday: [{ text: 'Completed many tasks' }],
        today: [{ text: 'Continue with active tasks' }],
        blockers: [],
      });

      // Act
      await repo.writeStandup(summary, completed, active);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties['Tasks Reviewed']).toEqual({ number: 150 });
      
      // Should contain summary with correct counts
      const summaryCallout = createCall.children.find((child: any) =>
        child.type === 'callout' && 
        child.callout.rich_text.some((rt: any) => 
          rt.text.content.includes('100 completed · 50 active')
        )
      );
      expect(summaryCallout).toBeDefined();
    });
  });
});