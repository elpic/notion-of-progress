/**
 * Global test setup configuration
 * 
 * This file is executed before all tests run. It sets up:
 * - Environment variables for testing
 * - Global mocks and utilities
 * - Common test configurations
 */

import { vi, afterEach } from 'vitest';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.NOTION_API_KEY = 'test-notion-key';
process.env.NOTION_DATABASE_ID = 'test-database-id';
process.env.NOTION_STANDUP_DATABASE_ID = 'test-standup-database-id';

// Global test utilities
global.createMockTask = (overrides = {}) => ({
  id: 'test-task-id',
  title: 'Test Task',
  status: 'To Do',
  dueDate: '2026-03-20',
  priority: 'Medium',
  lastEdited: '2026-03-18T10:00:00Z',
  url: 'https://notion.so/test-task',
  ...overrides,
});

global.createMockStandupSummary = (overrides = {}) => ({
  yesterday: [{ text: 'Completed test setup', taskId: 'task-1' }],
  today: [{ text: 'Write more tests' }],
  blockers: [],
  ...overrides,
});

// Mock console to prevent test noise (unless debugging)
if (!process.env.DEBUG_TESTS) {
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  });
}

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});