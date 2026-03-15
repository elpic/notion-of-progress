export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  priority: string | null;
  lastEdited: string;
  url: string;
}

export interface StandupBullet {
  text: string;
  taskId?: string;
}

export interface StandupSummary {
  yesterday: StandupBullet[];
  today: StandupBullet[];
  blockers: StandupBullet[];
}
