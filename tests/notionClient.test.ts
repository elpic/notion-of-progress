/**
 * Tests for Notion Client
 * 
 * Tests the Notion client singleton pattern and initialization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Notion Client constructor
const mockNotionClient = {
  databases: {},
  pages: {},
  blocks: {},
};

vi.mock('@notionhq/client', () => ({
  Client: vi.fn().mockImplementation((options) => ({
    ...mockNotionClient,
    _auth: options.auth, // Store auth for testing
  })),
}));

vi.mock('../src/config/index', () => ({
  config: {
    notion: {
      apiKey: 'test-api-key',
    },
  },
}));

describe('Notion Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module cache to ensure clean state
    vi.resetModules();
  });

  it('should create client with correct API key', async () => {
    const { getNotionClient } = await import('../src/notion/client');
    const { Client } = await import('@notionhq/client');

    const client = getNotionClient();

    expect(Client).toHaveBeenCalledWith({ auth: 'test-api-key' });
    expect((client as any)._auth).toBe('test-api-key');
  });

  it('should return the same client instance (singleton pattern)', async () => {
    const { getNotionClient } = await import('../src/notion/client');
    const { Client } = await import('@notionhq/client');

    const client1 = getNotionClient();
    const client2 = getNotionClient();

    // Should only call Client constructor once
    expect(Client).toHaveBeenCalledTimes(1);
    
    // Should return the same instance
    expect(client1).toBe(client2);
  });

  it('should create new client after module reset', async () => {
    const { getNotionClient } = await import('../src/notion/client');
    const { Client } = await import('@notionhq/client');

    // Get client first time
    const client1 = getNotionClient();
    expect(Client).toHaveBeenCalledTimes(1);

    // Reset modules to clear singleton
    vi.resetModules();

    // Import again and get client
    const { getNotionClient: getNotionClient2 } = await import('../src/notion/client');
    const client2 = getNotionClient2();
    
    // Should have called constructor twice (once for each import)
    expect(Client).toHaveBeenCalledTimes(2);
    
    // Should be different instances due to module reset
    expect(client1).not.toBe(client2);
  });

  it('should handle client creation with different config values', async () => {
    // Test that changes to config affect new client creation
    vi.doMock('../src/config/index', () => ({
      config: {
        notion: {
          apiKey: 'different-api-key',
        },
      },
    }));

    const { getNotionClient } = await import('../src/notion/client');
    const { Client } = await import('@notionhq/client');

    getNotionClient();

    expect(Client).toHaveBeenCalledWith({ auth: 'different-api-key' });
  });
});