import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  TagEditorDialog,
  type TagEditorValues,
} from '../../../renderer/features/navigation/components/TagEditorDialog';
import {
  createTagId,
  type TagSummary,
} from '../../../shared/documents/document.types';

const catalogue: TagSummary = {
  id: createTagId('tag:catalogue'),
  name: 'catalogue',
  color: 'teal',
  count: 1,
  createdAt: '2026-10-26T12:00:00.000Z',
  updatedAt: '2026-10-26T12:00:00.000Z',
};

describe('TagEditorDialog', () => {
  it('focuses the label and exposes every persisted color with labels', () => {
    render(<TagEditorDialog onCancel={jest.fn()} onSave={jest.fn()} />);

    expect(screen.getByRole('dialog', { name: 'New tag' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Tag name' })).toHaveFocus();
    expect(screen.getByRole('option', { name: 'Default' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Purple' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Black' })).toBeInTheDocument();
  });

  it('emits a trimmed typed draft and closes only after save succeeds', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onCancel = jest.fn();

    render(
      <TagEditorDialog tag={catalogue} onCancel={onCancel} onSave={onSave} />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Tag name' }), {
      target: { value: ' Team catalogue ' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Tag color' }), {
      target: { value: 'purple' },
    });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('dialog', { name: 'Edit catalogue tag' }),
      );
    });

    expect(onSave).toHaveBeenCalledWith({
      name: 'Team catalogue',
      color: 'purple',
    } satisfies TagEditorValues);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('retains its draft and reports a visible failure without claiming success', async () => {
    const onCancel = jest.fn();

    render(
      <TagEditorDialog
        tag={catalogue}
        onCancel={onCancel}
        onSave={async () => {
          throw new Error('duplicate tag');
        }}
      />,
    );

    const name = screen.getByRole('textbox', { name: 'Tag name' });
    fireEvent.change(name, { target: { value: ' Team catalogue ' } });

    await act(async () => {
      fireEvent.submit(screen.getByRole('dialog'));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The tag could not be saved.',
    );
    expect(name).toHaveValue(' Team catalogue ');
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels with Escape and keeps focus within the dialog', () => {
    const onCancel = jest.fn();

    render(<TagEditorDialog onCancel={onCancel} onSave={jest.fn()} />);

    const save = screen.getByRole('button', { name: 'Create' });
    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('textbox', { name: 'Tag name' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
