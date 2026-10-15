import type {
  StatusNavigationItem,
  TagNavigationItem,
} from '../model/navigation.types';

export const navigationCounts = {
  allNotes: 3040,
} as const;

export const statusItems: StatusNavigationItem[] = [
  {
    id: 'status-active',
    label: 'active',
    status: 'active',
    count: 3,
  },
  {
    id: 'status-on-hold',
    label: 'On Hold',
    status: 'on-hold',
    count: 1,
  },
  {
    id: 'status-completed',
    label: 'Completed',
    status: 'completed',
    count: 186,
  },
  {
    id: 'status-dropped',
    label: 'Dropped',
    status: 'dropped',
    count: 24,
  },
];

export const tagItems: TagNavigationItem[] = [
  {
    id: 'tag-work',
    label: 'work',
    color: '#58a6ff',
    count: 412,
  },
  {
    id: 'tag-personal',
    label: 'personal',
    color: '#45d483',
    count: 88,
  },
  {
    id: 'tag-bug',
    label: 'bug',
    color: '#ff6868',
    count: 137,
  },
  {
    id: 'tag-research',
    label: 'research',
    color: '#9670ff',
    count: 64,
  },
];
