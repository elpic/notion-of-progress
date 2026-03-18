/**
 * Tests for application configuration module
 * 
 * Tests the environment variable loading and validation logic
 * that's critical for application startup.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Config Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment to clean state for each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('required environment variables', () => {
    it('should load config successfully with all required variables', async () => {
      // Arrange
      process.env.NOTION_API_KEY = 'test-notion-key';
      process.env.NOTION_TASK_DB_ID = 'test-task-db-id';
      process.env.NOTION_STANDUP_LOG_DB_ID = 'test-standup-db-id';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Act
      const { config } = await import('../src/config/index');

      // Assert
      expect(config.notion.apiKey).toBe('test-notion-key');
      expect(config.notion.taskDbId).toBe('test-task-db-id');
      expect(config.notion.standupLogDbId).toBe('test-standup-db-id');
      expect(config.anthropic.apiKey).toBe('test-anthropic-key');
      expect(config.anthropic.model).toBe('claude-sonnet-4-6');
    });

    it('should throw error when NOTION_API_KEY is missing', async () => {
      // Arrange
      delete process.env.NOTION_API_KEY;
      process.env.NOTION_TASK_DB_ID = 'test-task-db-id';
      process.env.NOTION_STANDUP_LOG_DB_ID = 'test-standup-db-id';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Act & Assert
      await expect(() => import('../src/config/index')).rejects.toThrow(
        'Missing required environment variable: NOTION_API_KEY'
      );
    });

    it('should throw error when ANTHROPIC_API_KEY is missing', async () => {
      // Arrange
      process.env.NOTION_API_KEY = 'test-notion-key';
      process.env.NOTION_TASK_DB_ID = 'test-task-db-id';
      process.env.NOTION_STANDUP_LOG_DB_ID = 'test-standup-db-id';
      delete process.env.ANTHROPIC_API_KEY;

      // Act & Assert
      await expect(() => import('../src/config/index')).rejects.toThrow(
        'Missing required environment variable: ANTHROPIC_API_KEY'
      );
    });

    it('should throw error when NOTION_TASK_DB_ID is missing', async () => {
      // Arrange
      process.env.NOTION_API_KEY = 'test-notion-key';
      delete process.env.NOTION_TASK_DB_ID;
      process.env.NOTION_STANDUP_LOG_DB_ID = 'test-standup-db-id';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Act & Assert
      await expect(() => import('../src/config/index')).rejects.toThrow(
        'Missing required environment variable: NOTION_TASK_DB_ID'
      );
    });

    it('should throw error when NOTION_STANDUP_LOG_DB_ID is missing', async () => {
      // Arrange
      process.env.NOTION_API_KEY = 'test-notion-key';
      process.env.NOTION_TASK_DB_ID = 'test-task-db-id';
      delete process.env.NOTION_STANDUP_LOG_DB_ID;
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Act & Assert
      await expect(() => import('../src/config/index')).rejects.toThrow(
        'Missing required environment variable: NOTION_STANDUP_LOG_DB_ID'
      );
    });

    it('should throw error for empty string environment variables', async () => {
      // Arrange
      process.env.NOTION_API_KEY = '';
      process.env.NOTION_TASK_DB_ID = 'test-task-db-id';
      process.env.NOTION_STANDUP_LOG_DB_ID = 'test-standup-db-id';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Act & Assert
      await expect(() => import('../src/config/index')).rejects.toThrow(
        'Missing required environment variable: NOTION_API_KEY'
      );
    });
  });

  describe('optional environment variables', () => {
    beforeEach(() => {
      // Set all required variables for optional tests
      process.env.NOTION_API_KEY = 'test-notion-key';
      process.env.NOTION_TASK_DB_ID = 'test-task-db-id';
      process.env.NOTION_STANDUP_LOG_DB_ID = 'test-standup-db-id';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    });

    it('should use default values for optional scheduler configuration', async () => {
      // Arrange - No scheduler environment variables set

      // Act
      const { config } = await import('../src/config/index');

      // Assert
      expect(config.scheduler.cronSchedule).toBe('0 8 * * 1-5'); // Default weekday 8am
      expect(config.scheduler.digestCronSchedule).toBe('0 17 * * 5'); // Default Friday 5pm
      expect(config.scheduler.timezone).toBe('America/New_York'); // Default timezone
    });

    it('should use custom scheduler configuration when provided', async () => {
      // Arrange
      process.env.CRON_SCHEDULE = '0 9 * * 1-5';
      process.env.DIGEST_CRON_SCHEDULE = '0 18 * * 5';
      process.env.TZ = 'UTC';

      // Act
      const { config } = await import('../src/config/index');

      // Assert
      expect(config.scheduler.cronSchedule).toBe('0 9 * * 1-5');
      expect(config.scheduler.digestCronSchedule).toBe('0 18 * * 5');
      expect(config.scheduler.timezone).toBe('UTC');
    });

    it('should handle optional Discord webhook URL', async () => {
      // Act
      const { config } = await import('../src/config/index');

      // Assert - Should be null when not provided
      expect(config.discord.webhookUrl).toBeNull();
    });

    it('should use Discord webhook URL when provided', async () => {
      // Arrange
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/abc';

      // Act
      const { config } = await import('../src/config/index');

      // Assert
      expect(config.discord.webhookUrl).toBe('https://discord.com/api/webhooks/123/abc');
    });

    it('should handle optional Notion system status database ID', async () => {
      // Act
      const { config } = await import('../src/config/index');

      // Assert - Should be null when not provided
      expect(config.notion.systemStatusDbId).toBeNull();
    });

    it('should use custom Notion property names when provided', async () => {
      // Arrange
      process.env.TASK_STATUS_PROPERTY = 'CustomStatus';
      process.env.TASK_DONE_VALUE = 'Complete';
      process.env.TASK_TITLE_PROPERTY = 'Title';

      // Act
      const { config } = await import('../src/config/index');

      // Assert
      expect(config.notion.taskStatusProperty).toBe('CustomStatus');
      expect(config.notion.taskDoneValue).toBe('Complete');
      expect(config.notion.taskTitleProperty).toBe('Title');
    });

    it('should use default Notion property names when not provided', async () => {
      // Act
      const { config } = await import('../src/config/index');

      // Assert
      expect(config.notion.taskStatusProperty).toBe('Status');
      expect(config.notion.taskDoneValue).toBe('Done');
      expect(config.notion.taskTitleProperty).toBe('Name');
    });
  });

  describe('configuration structure validation', () => {
    beforeEach(() => {
      // Set all required variables
      process.env.NOTION_API_KEY = 'test-notion-key';
      process.env.NOTION_TASK_DB_ID = 'test-task-db-id';
      process.env.NOTION_STANDUP_LOG_DB_ID = 'test-standup-db-id';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    });

    it('should have correct configuration structure', async () => {
      // Act
      const { config } = await import('../src/config/index');

      // Assert - Validate complete structure
      expect(config).toMatchObject({
        notion: {
          apiKey: expect.any(String),
          taskDbId: expect.any(String),
          standupLogDbId: expect.any(String),
          systemStatusDbId: null,
          taskStatusProperty: expect.any(String),
          taskDoneValue: expect.any(String),
          taskTitleProperty: expect.any(String),
        },
        anthropic: {
          apiKey: expect.any(String),
          model: expect.any(String),
        },
        scheduler: {
          cronSchedule: expect.any(String),
          digestCronSchedule: expect.any(String),
          timezone: expect.any(String),
        },
        discord: {
          webhookUrl: null,
        },
      });
    });

    it('should have sensible default values', async () => {
      // Act
      const { config } = await import('../src/config/index');

      // Assert - Validate defaults make sense
      expect(config.anthropic.model).toBe('claude-sonnet-4-6');
      expect(config.scheduler.cronSchedule).toMatch(/^\d+\s+\d+\s+\*\s+\*\s+\d+-\d+$/); // Cron pattern
      expect(config.scheduler.timezone).toBeTruthy();
      expect(config.notion.taskStatusProperty).toBeTruthy();
      expect(config.notion.taskDoneValue).toBeTruthy();
      expect(config.notion.taskTitleProperty).toBeTruthy();
    });
  });

  describe('environment edge cases', () => {
    it('should accept whitespace-only environment variables as valid', async () => {
      // Arrange
      process.env.NOTION_API_KEY = '   ';
      process.env.NOTION_TASK_DB_ID = 'test-task-db-id';
      process.env.NOTION_STANDUP_LOG_DB_ID = 'test-standup-db-id';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Act
      const { config } = await import('../src/config/index');

      // Assert - The config accepts whitespace as valid (validation can happen elsewhere)
      expect(config.notion.apiKey).toBe('   ');
    });

    it('should preserve actual values with whitespace', async () => {
      // Arrange
      process.env.NOTION_API_KEY = '  test-key-with-spaces  ';
      process.env.NOTION_TASK_DB_ID = 'test-task-db-id';
      process.env.NOTION_STANDUP_LOG_DB_ID = 'test-standup-db-id';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Act
      const { config } = await import('../src/config/index');

      // Assert - Should preserve the value as-is (trimming is not the config module's job)
      expect(config.notion.apiKey).toBe('  test-key-with-spaces  ');
    });
  });
});