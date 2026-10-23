import { notebookPurposeFor } from '../../../renderer/features/navigation/model/notebookPresentation';

describe('notebookPurposeFor', () => {
  it('assigns a clear visual purpose to known notebook names', () => {
    expect(notebookPurposeFor({ id: 'inbox', name: 'Inbox' })).toBe('inbox');
    expect(notebookPurposeFor({ id: 'work', name: 'Work' })).toBe('work');
    expect(notebookPurposeFor({ id: 'projects', name: 'Projects' })).toBe(
      'project',
    );
    expect(notebookPurposeFor({ id: 'learn', name: 'Research notes' })).toBe(
      'learn',
    );
  });

  it('uses the readable notebook icon as a safe fallback', () => {
    expect(notebookPurposeFor({ id: 'ideas', name: 'Ideas' })).toBe('notes');
  });
});
