/**
 * Tests for System Status Management
 * 
 * Tests the live system monitoring functionality that creates and updates
 * the operational dashboard in Notion.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
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

const mockConfig = {
  notion: {
    systemStatusDbId: 'test-status-db-id',
  },
};

vi.mock('../src/config/index', () => ({
  config: mockConfig,
}));

vi.mock('../src/utils/retry', () => ({
  withRetry: vi.fn((fn) => fn()),
  isNotionRateLimit: vi.fn(),
}));

vi.mock('../src/utils/dateHelpers', () => ({
  todayFormatted: () => '2026-03-18',
}));

vi.mock('../src/utils/icons', () => ({
  randomIcon: () => '🎯',
  DIGEST_ICONS: ['📊', '📈', '📉'],
}));

describe('System Status Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.notion.systemStatusDbId = 'test-status-db-id';
  });

  describe('updateSystemStatus', () => {
    it('should skip when system status database is not configured', async () => {
      // Arrange
      mockConfig.notion.systemStatusDbId = null as any;
      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const status = {
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 42,
        environment: 'GitHub Actions',
      };

      // Act
      const result = await updateSystemStatus(status);

      // Assert
      expect(result).toBe('');
      expect(mockNotionClient.databases.query).not.toHaveBeenCalled();
    });

    it('should create new status page when none exists for today', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [], // No existing pages
      });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'new-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const status = {
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 42,
        environment: 'Local',
      };

      // Act
      const result = await updateSystemStatus(status);

      // Assert
      expect(mockNotionClient.databases.query).toHaveBeenCalledWith({
        database_id: 'test-status-db-id',
        filter: {
          and: [{
            property: 'Last Run',
            date: { on_or_after: '2026-03-18' },
          }],
        },
        sorts: [{ property: 'Last Run', direction: 'descending' }],
        page_size: 1,
      });
      expect(mockNotionClient.pages.create).toHaveBeenCalled();
      expect(result).toBe('https://www.notion.so/newpageid');
    });

    it('should update existing status page when one exists for today', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [{ id: 'existing-page-id' }],
      });
      mockNotionClient.blocks.children.list.mockResolvedValue({
        results: [
          { id: 'block-1' },
          { id: 'block-2' },
        ],
      });
      mockNotionClient.pages.update.mockResolvedValue({
        id: 'existing-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const status = {
        lastRun: '2026-03-18T15:30:00Z',
        status: 'Degraded' as const,
        totalStandups: 43,
        environment: 'GitHub Actions',
      };

      // Act
      const result = await updateSystemStatus(status, 'API timeout error');

      // Assert
      expect(mockNotionClient.databases.query).toHaveBeenCalled();
      expect(mockNotionClient.pages.update).toHaveBeenCalled();
      expect(mockNotionClient.blocks.children.list).toHaveBeenCalledWith({
        block_id: 'existing-page-id',
        page_size: 100,
      });
      expect(result).toBe('https://www.notion.so/existingpageid');
    });

    it('should handle operational status correctly', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'operational-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const status = {
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 100,
        environment: 'Local',
      };

      // Act
      await updateSystemStatus(status);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties.Status.select.name).toBe('Operational');
    });

    it('should handle degraded status correctly', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'degraded-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const status = {
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Degraded' as const,
        totalStandups: 50,
        environment: 'GitHub Actions',
      };

      // Act
      await updateSystemStatus(status, 'Rate limit exceeded');

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties.Status.select.name).toBe('Degraded');
      
      // Should include error details in the page content
      const pageChildren = createCall.children;
      const errorSection = pageChildren.find((child: any) => 
        child.type === 'callout' && 
        child.callout.rich_text.some((text: any) => 
          text.text.content.includes('SYSTEM ALERT')
        )
      );
      expect(errorSection).toBeDefined();
    });

    it('should handle down status correctly', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'down-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const status = {
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Down' as const,
        totalStandups: 25,
        environment: 'Local',
      };

      // Act
      await updateSystemStatus(status, 'Database connection failed');

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties.Status.select.name).toBe('Down');
    });

    it('should format dates correctly in status display', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'date-test-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const status = {
        lastRun: '2026-03-18T14:30:45Z',
        status: 'Operational' as const,
        totalStandups: 1,
        environment: 'Local',
      };

      // Act
      await updateSystemStatus(status);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const lastRunText = createCall.children.find((child: any) =>
        child.type === 'paragraph' && 
        child.paragraph.rich_text.some((text: any) => 
          text.text.content.includes('Last Execution:')
        )
      );
      expect(lastRunText).toBeDefined();
    });

    it('should handle different environment values', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'env-test-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');

      // Test Local environment
      await updateSystemStatus({
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 1,
        environment: 'Local',
      });

      // Test GitHub Actions environment  
      await updateSystemStatus({
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 2,
        environment: 'GitHub Actions',
      });

      // Assert both calls were made correctly
      expect(mockNotionClient.pages.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('findTodayStatusPageId', () => {
    it('should return null when no status page exists for today', async () => {
      // This is tested indirectly through updateSystemStatus,
      // but we can verify the query structure
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      await updateSystemStatus({
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 1,
        environment: 'Local',
      });

      expect(mockNotionClient.databases.query).toHaveBeenCalledWith({
        database_id: 'test-status-db-id',
        filter: {
          and: [{
            property: 'Last Run',
            date: { on_or_after: '2026-03-18' },
          }],
        },
        sorts: [{ property: 'Last Run', direction: 'descending' }],
        page_size: 1,
      });
    });

    it('should return page ID when status page exists for today', async () => {
      mockNotionClient.databases.query.mockResolvedValue({
        results: [{ id: 'found-page-id' }],
      });
      mockNotionClient.blocks.children.list.mockResolvedValue({
        results: [],
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const result = await updateSystemStatus({
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 1,
        environment: 'Local',
      });

      expect(result).toBe('https://www.notion.so/foundpageid');
    });
  });

  describe('error handling', () => {
    it('should handle Notion API errors gracefully', async () => {
      // Arrange
      mockNotionClient.databases.query.mockRejectedValue(new Error('Notion API Error'));

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const status = {
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 1,
        environment: 'Local',
      };

      // Act & Assert - Should propagate error
      await expect(updateSystemStatus(status)).rejects.toThrow('Notion API Error');
    });

    it('should include error message in status page when provided', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'error-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      const status = {
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Down' as const,
        totalStandups: 10,
        environment: 'GitHub Actions',
      };

      const errorMessage = 'Database connection timeout after 30 seconds';

      // Act
      await updateSystemStatus(status, errorMessage);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const errorBlock = createCall.children.find((child: any) =>
        child.type === 'paragraph' && 
        child.paragraph.rich_text.some((text: any) => 
          text.text.content.includes(errorMessage)
        )
      );
      expect(errorBlock).toBeDefined();
    });
  });

  describe('page content structure', () => {
    it('should create page with correct title format', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'title-test-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      // Act
      await updateSystemStatus({
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 1,
        environment: 'Local',
      });

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      expect(createCall.properties.Title.title[0].text.content).toBe('🚀 System Dashboard - 2026-03-18');
    });

    it('should include all required metrics in page content', async () => {
      // Arrange
      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
      });
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'metrics-test-page-id',
      });

      const { updateSystemStatus } = await import('../src/utils/systemStatus');
      
      // Act
      await updateSystemStatus({
        lastRun: '2026-03-18T10:00:00Z',
        status: 'Operational' as const,
        totalStandups: 156,
        environment: 'GitHub Actions',
      });

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const content = JSON.stringify(createCall.children);
      
      // Should include all key metrics (using actual text from implementation)
      expect(content).toContain('Last Execution:');
      expect(content).toContain('Standups Generated:');
      expect(content).toContain('Infrastructure:');
      expect(content).toContain('156'); // standup count
      expect(content).toContain('GitHub Actions'); // environment
    });
  });
});