import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { NoteListItem } from '../../../renderer/features/notes/components/NoteListItem';
import { NotesList } from '../../../renderer/features/notes/components/NotesList';
import type { NoteSummary } from '../../../renderer/features/notes/model/note.types';

const checklistNote: NoteSummary = {
  id: 'release-checklist',
  title: 'Ship the polished note list',
  excerpt: 'Use a denser list layout with real task progress.',
  updatedLabel: '3 hours ago',
  pinned: true,
  status: 'active',
  completedTasks: 2,
  totalTasks: 4,
  tags: [
    { id: 'work', label: 'work', color: 'blue' },
    { id: 'bug', label: 'bug', color: 'red' },
  ],
};

describe('NoteListItem', () => {
  it('presents pin, status, and Markdown-derived task progress accessibly', () => {
    render(<NoteListItem note={checklistNote} selected onSelect={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: /ship the polished note list/i }),
    ).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('Pinned note')).toBeVisible();
    expect(screen.getByLabelText('Active status')).toBeVisible();

    const progress = screen.getByRole('progressbar', {
      name: '2 of 4 tasks completed',
    });

    expect(progress).toHaveAttribute('aria-valuenow', '2');
    expect(progress).toHaveAttribute(
      'aria-valuetext',
      '2 of 4 tasks completed',
    );
    expect(screen.getByText('2 of 4')).toBeVisible();
    expect(screen.getByText('work')).toBeVisible();
    expect(screen.getByText('bug')).toBeVisible();
  });

  it('groups cards in a labeled list without changing their button semantics', () => {
    render(
      <NotesList
        notes={[checklistNote]}
        selectedNoteId={checklistNote.id}
        onSelectNote={jest.fn()}
      />,
    );

    expect(screen.getByRole('list', { name: 'Notes' })).toBeVisible();
    expect(screen.getByRole('listitem')).toContainElement(
      screen.getByRole('button', { name: /ship the polished note list/i }),
    );
  });
});
