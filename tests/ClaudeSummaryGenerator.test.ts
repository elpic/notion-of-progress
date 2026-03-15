import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TaskSummary } from '../src/core/domain/types';

// Mock the Anthropic SDK before importing the class
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

// Mock config to avoid needing a real .env
vi.mock('../src/config/index', () => ({
  config: {
    anthropic: { apiKey: 'test-key', model: 'claude-sonnet-4-6' },
  },
}));

const mockTask: TaskSummary = {
  id: '1',
  title: 'Implement auth',
  status: 'Done',
  dueDate: '2026-03-13',
  priority: 'High',
  lastEdited: '2026-03-13T10:00:00Z',
  url: 'https://notion.so/1',
};

describe('ClaudeSummaryGenerator', () => {
  let generator: InstanceType<typeof import('../src/adapters/claude/ClaudeSummaryGenerator').ClaudeSummaryGenerator>;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const Anthropic = (await import('@anthropic-ai/sdk')).default as ReturnType<typeof vi.fn>;
    mockCreate = vi.fn();
    Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));
    const { ClaudeSummaryGenerator } = await import('../src/adapters/claude/ClaudeSummaryGenerator');
    generator = new ClaudeSummaryGenerator();
  });

  it('parses a clean JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          yesterday: ['Completed auth module'],
          today: ['Start notifications'],
          blockers: [],
        }),
      }],
    });

    const result = await generator.generateSummary([mockTask], []);
    expect(result.yesterday).toEqual(['Completed auth module']);
    expect(result.today).toEqual(['Start notifications']);
    expect(result.blockers).toEqual([]);
  });

  it('strips markdown code blocks before parsing', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '```json\n{"yesterday":["Did stuff"],"today":["More stuff"],"blockers":[]}\n```',
      }],
    });

    const result = await generator.generateSummary([mockTask], []);
    expect(result.yesterday).toEqual(['Did stuff']);
  });

  it('returns empty arrays for missing fields in JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"yesterday":["Done something"]}' }],
    });

    const result = await generator.generateSummary([mockTask], []);
    expect(result.today).toEqual([]);
    expect(result.blockers).toEqual([]);
  });

  it('throws on invalid JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    });

    await expect(generator.generateSummary([mockTask], [])).rejects.toThrow();
  });

  it('throws on non-text response type', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
    });

    await expect(generator.generateSummary([mockTask], [])).rejects.toThrow('Unexpected response type');
  });
});
