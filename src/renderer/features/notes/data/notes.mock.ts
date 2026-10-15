import type { NoteSummary } from '../model/note.types';

export const notesMock: NoteSummary[] = [
  {
    id: 'note-1',
    title: 'Note list scrolling stutters with 3k notes',
    excerpt: 'Scrolling the note list stutters badly with larger collections.',
    updatedLabel: '14 hours ago',
    pinned: true,
    completedTasks: 2,
    totalTasks: 4,
    tags: [
      {
        id: 'work',
        label: 'work',
        color: 'blue',
      },
      {
        id: 'bug',
        label: 'bug',
        color: 'red',
      },
    ],
  },
  {
    id: 'note-2',
    title: 'App hangs when pasting a 5,000-row table',
    excerpt: 'Pasting a large Markdown table into the editor causes a freeze.',
    updatedLabel: '17 hours ago',
    completedTasks: 2,
    totalTasks: 5,
    tags: [
      {
        id: 'work',
        label: 'work',
        color: 'blue',
      },
      {
        id: 'bug',
        label: 'bug',
        color: 'red',
      },
    ],
  },
  {
    id: 'note-3',
    title: 'Pick a local vector store for semantic search',
    excerpt: 'Goal: semantic search over ~3k notes, fully offline.',
    updatedLabel: '1 day ago',
    completedTasks: 1,
    totalTasks: 4,
    tags: [
      {
        id: 'work',
        label: 'work',
        color: 'blue',
      },
      {
        id: 'research',
        label: 'research',
        color: 'purple',
      },
    ],
  },
  {
    id: 'note-4',
    title: 'How a release goes out',
    excerpt: 'Writing this down because I keep re-deriving the process.',
    updatedLabel: '4 days ago',
    tags: [
      {
        id: 'work',
        label: 'work',
        color: 'blue',
      },
    ],
  },
  {
    id: 'note-5',
    title: 'Migration guide: Prettier → oxfmt & ESLint → oxlint',
    excerpt: 'Swapping Prettier → oxfmt and ESLint → oxlint.',
    updatedLabel: '2 days ago',
    tags: [
      {
        id: 'work',
        label: 'work',
        color: 'blue',
      },
    ],
  },
  {
    id: 'note-6',
    title: 'BM25 for ranking search results',
    excerpt: 'Reading up on ranking before I touch semantic search.',
    updatedLabel: '1 week ago',
    tags: [
      {
        id: 'research',
        label: 'research',
        color: 'purple',
      },
    ],
  },
  {
    id: 'note-7',
    title: 'Desk setup — monitor arm',
    excerpt: 'Switched to a monitor arm so my main display sits higher.',
    updatedLabel: '5 days ago',
    tags: [
      {
        id: 'personal',
        label: 'personal',
        color: 'green',
      },
    ],
  },
];
