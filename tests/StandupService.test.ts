import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StandupService } from '../src/core/standup';
import type { TaskRepository } from '../src/core/ports/TaskRepository';
import type { SummaryGenerator } from '../src/core/ports/SummaryGenerator';
import type { StandupRepository } from '../src/core/ports/StandupRepository';
import type { TaskSummary, StandupSummary } from '../src/core/domain/types';

const mockTask: TaskSummary = {
  id: '1',
  title: 'Build auth module',
  status: 'Done',
  dueDate: '2026-03-13',
  priority: 'High',
  lastEdited: '2026-03-13T10:00:00Z',
  url: 'https://notion.so/1',
};

const mockSummary: StandupSummary = {
  yesterday: ['Completed auth module'],
  today: ['Start notification service'],
  blockers: [],
};

function makeMocks() {
  const tasks: TaskRepository = {
    fetchTasks: vi.fn().mockResolvedValue({ completed: [mockTask], active: [] }),
  };
  const summarizer: SummaryGenerator = {
    generateSummary: vi.fn().mockResolvedValue(mockSummary),
  };
  const standup: StandupRepository = {
    writeStandup: vi.fn().mockResolvedValue('https://notion.so/standup-123'),
    writeFailedStandup: vi.fn().mockResolvedValue(undefined),
  };
  return { tasks, summarizer, standup };
}

describe('StandupService', () => {
  it('runs the full pipeline in order', async () => {
    const { tasks, summarizer, standup } = makeMocks();
    const service = new StandupService(tasks, summarizer, standup);

    await service.run();

    expect(tasks.fetchTasks).toHaveBeenCalledOnce();
    expect(summarizer.generateSummary).toHaveBeenCalledWith([mockTask], []);
    expect(standup.writeStandup).toHaveBeenCalledWith(mockSummary, [mockTask], []);
    expect(standup.writeFailedStandup).not.toHaveBeenCalled();
  });

  it('passes total task count (completed + active) to writeStandup', async () => {
    const { tasks, summarizer, standup } = makeMocks();
    (tasks.fetchTasks as ReturnType<typeof vi.fn>).mockResolvedValue({
      completed: [mockTask],
      active: [{ ...mockTask, id: '2', status: 'In Progress' }],
    });
    const service = new StandupService(tasks, summarizer, standup);

    await service.run();

    expect(standup.writeStandup).toHaveBeenCalledWith(mockSummary, [mockTask], [{ ...mockTask, id: '2', status: 'In Progress' }]);
  });

  it('still runs when no tasks are found', async () => {
    const { tasks, summarizer, standup } = makeMocks();
    (tasks.fetchTasks as ReturnType<typeof vi.fn>).mockResolvedValue({ completed: [], active: [] });
    const service = new StandupService(tasks, summarizer, standup);

    await service.run();

    expect(summarizer.generateSummary).toHaveBeenCalledWith([], []);
    expect(standup.writeStandup).toHaveBeenCalled();
  });

  it('writes a failed standup page and re-throws on error', async () => {
    const { tasks, summarizer, standup } = makeMocks();
    const error = new Error('Claude API error');
    (summarizer.generateSummary as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const service = new StandupService(tasks, summarizer, standup);

    await expect(service.run()).rejects.toThrow('Claude API error');
    expect(standup.writeFailedStandup).toHaveBeenCalledWith('Claude API error');
    expect(standup.writeStandup).not.toHaveBeenCalled();
  });

  it('writes a failed standup page when task fetch fails', async () => {
    const { tasks, summarizer, standup } = makeMocks();
    (tasks.fetchTasks as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Notion down'));
    const service = new StandupService(tasks, summarizer, standup);

    await expect(service.run()).rejects.toThrow('Notion down');
    expect(standup.writeFailedStandup).toHaveBeenCalledWith('Notion down');
  });
});
