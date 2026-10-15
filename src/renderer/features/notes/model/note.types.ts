export type NoteTag = {
  id: string;
  label: string;
  color: 'blue' | 'red' | 'purple' | 'green' | 'orange';
};

export type NoteSummary = {
  id: string;
  title: string;
  excerpt: string;
  updatedLabel: string;
  pinned?: boolean;
  completedTasks?: number;
  totalTasks?: number;
  tags: NoteTag[];
};
