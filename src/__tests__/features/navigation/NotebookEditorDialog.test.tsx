import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { NotebookEditorDialog } from '../../../renderer/features/navigation/components/NotebookEditorDialog';
import type { Notebook } from '../../../shared/documents/document.types';

const work: Notebook = {
  id: 'work',
  name: 'Work',
  parentId: null,
  icon: 'briefcase',
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};

const projects: Notebook = {
  id: 'projects',
  name: 'Projects',
  parentId: 'work',
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};

const notebooks: readonly Notebook[] = [
  {
    id: 'inbox',
    name: 'Inbox',
    parentId: null,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
  },
  work,
  projects,
  {
    id: 'personal',
    name: 'Personal',
    parentId: null,
    createdAt: '2026-10-26T12:00:00.000Z',
    updatedAt: '2026-10-26T12:00:00.000Z',
  },
];

describe('NotebookEditorDialog', () => {
  it('focuses the name and excludes the notebook plus descendants as parents', () => {
    render(
      <NotebookEditorDialog
        notebook={work}
        notebooks={notebooks}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: 'Edit Work notebook' }),
    ).toBeVisible();
    expect(
      screen.getByRole('textbox', { name: 'Notebook name' }),
    ).toHaveFocus();
    expect(
      screen.getByRole('option', { name: 'Library root' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Inbox' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Personal' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Work' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Projects' }),
    ).not.toBeInTheDocument();
  });

  it('saves explicit root and icon removal values, then closes', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();

    render(
      <NotebookEditorDialog
        notebook={work}
        notebooks={notebooks}
        onCancel={onCancel}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Notebook name' }), {
      target: { value: '  Focus  ' },
    });
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Parent notebook' }),
      {
        target: { value: '' },
      },
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Notebook icon' }), {
      target: { value: '' },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('dialog', { name: 'Edit Work notebook' }),
      );
    });

    expect(onSave).toHaveBeenCalledWith({
      name: 'Focus',
      parentId: null,
      icon: null,
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels when Escape is pressed', () => {
    const onCancel = jest.fn();

    render(
      <NotebookEditorDialog
        notebook={work}
        notebooks={notebooks}
        onCancel={onCancel}
        onSave={jest.fn()}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
