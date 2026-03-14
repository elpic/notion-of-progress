export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string | null;
  lastEdited: string;
  url: string;
}

export interface StandupSummary {
  yesterday: string[];
  today: string[];
  blockers: string[];
}
