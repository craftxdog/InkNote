import type { NoteStatus } from '../../../../shared/documents/document.types';

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
  status?: NoteStatus;
  completedTasks?: number;
  totalTasks?: number;
  tags: NoteTag[];
};
