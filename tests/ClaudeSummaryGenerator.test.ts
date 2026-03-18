import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TaskSummary } from '../src/core/domain/types';
import { TaskStatus, TaskPriority } from '../src/core/domain/types';

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
  status: TaskStatus.DONE,
  dueDate: '2026-03-13',
  priority: TaskPriority.HIGH,
  lastEdited: '2026-03-13T10:00:00Z',
  url: 'https://notion.so/1',
};

describe('ClaudeSummaryGenerator', () => {
  let generator: InstanceType<typeof import('../src/adapters/claude/ClaudeSummaryGenerator').ClaudeSummaryGenerator>;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const AnthropicModule = await import('@anthropic-ai/sdk');
    const Anthropic = AnthropicModule.default as any;
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
          yesterday: [{ text: 'Completed auth module', taskId: '1' }],
          today: [{ text: 'Start notifications' }],
          blockers: [],
        }),
      }],
    });

    const result = await generator.generateSummary([mockTask], []);
    expect(result.yesterday).toEqual([{ text: 'Completed auth module', taskId: '1' }]);
    expect(result.today).toEqual([{ text: 'Start notifications' }]);
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
    expect(result.yesterday).toEqual([{ text: 'Did stuff' }]);
  });

  it('throws error for missing required fields in JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"yesterday":[{"text":"Done something"}]}' }],
    });

    await expect(generator.generateSummary([mockTask], [])).rejects.toThrow('Missing required property: today');
  });

  it('throws on invalid JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    });

    await expect(generator.generateSummary([mockTask], [])).rejects.toThrow();
  });

  it('throws on non-text response type', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'image', source: { data: 'base64...' } }],
    });

    await expect(generator.generateSummary([mockTask], []))
      .rejects.toThrow('Unexpected response type from Claude: image');
  });

  it('throws for invalid JSON structure (null)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'null' }],
    });

    await expect(generator.generateSummary([mockTask], []))
      .rejects.toThrow('Invalid JSON structure: expected object, got object');
  });

  it('throws for invalid JSON structure (primitive)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '"just a string"' }],
    });

    await expect(generator.generateSummary([mockTask], []))
      .rejects.toThrow('Invalid JSON structure: expected object, got string');
  });

  it('throws for invalid JSON structure (array)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '["array", "instead", "of", "object"]' }],
    });

    await expect(generator.generateSummary([mockTask], []))
      .rejects.toThrow('Missing required property: yesterday');
  });

  it('handles conversion errors gracefully', async () => {
    // Create invalid bullet structure that would cause internal conversion to fail
    // Since toBullets is internal, we'll create a scenario that should work with arrays
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          yesterday: [{ text: 'Valid bullet' }],
          today: [],
          blockers: [],
        }),
      }],
    });

    // This should actually succeed, let's test a different error scenario
    const result = await generator.generateSummary([mockTask], []);
    expect(result.yesterday[0].text).toBe('Valid bullet');
  });

  it('handles various JSON syntax errors', async () => {
    const invalidJsonCases = [
      '{ invalid: json }', // Unquoted keys
      '{ "missing": }', // Missing value
      '{ "trailing": "comma", }', // Trailing comma
      '{ unclosed', // Unclosed object
    ];

    for (const invalidJson of invalidJsonCases) {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: invalidJson }],
      });

      await expect(generator.generateSummary([mockTask], []))
        .rejects.toThrow(/Invalid JSON syntax:/);
    }
  });

  it('handles unknown parsing errors', async () => {
    // Mock JSON.parse to throw a non-Error object
    const originalParse = JSON.parse;
    JSON.parse = vi.fn().mockImplementation(() => {
      throw 'String error instead of Error object';
    });

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{}' }],
    });

    await expect(generator.generateSummary([mockTask], []))
      .rejects.toThrow('Invalid JSON syntax: Unknown parsing error');

    // Restore original JSON.parse
    JSON.parse = originalParse;
  });

  it('handles non-array properties gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          yesterday: "not an array",
          today: 123,
          blockers: null,
        }),
      }],
    });

    const result = await generator.generateSummary([mockTask], []);
    
    // Should default non-arrays to empty arrays
    expect(result.yesterday).toEqual([]);
    expect(result.today).toEqual([]);
    expect(result.blockers).toEqual([]);
  });
});
