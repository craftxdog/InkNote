import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';

import type {
  Notebook,
  NoteDocument,
} from '../../../../shared/documents/document.types';
import { buildNotebookTreeRows } from '../../navigation/model/notebookTree';
import type { NoteBatchOperationResult } from '../../../platform/documents/noteBatchOperation';

type MoveNoteDialogProps = {
  notes: readonly NoteDocument[];
  notebooks: readonly Notebook[];
  onMove: (
    notes: readonly NoteDocument[],
    notebookId: string,
  ) => Promise<NoteBatchOperationResult>;
  onClose: () => void;
  actionLabel?: string;
  allowCurrentDestination?: boolean;
};

/**
 * Inkdrop-style notebook picker used by the note-list `m` shortcut. The
 * native select keeps the interaction accessible while j/k and Enter offer a
 * direct Vim-friendly path.
 */
export function MoveNoteDialog({
  notes,
  notebooks,
  onMove,
  onClose,
  actionLabel = 'Move',
  allowCurrentDestination = false,
}: MoveNoteDialogProps) {
  const options = useMemo(
    () => buildNotebookTreeRows(notebooks, new Map(), ''),
    [notebooks],
  );
  const firstNote = notes[0];
  const [notebookId, setNotebookId] = useState(
    firstNote?.notebookId ?? 'inbox',
  );
  const [error, setError] = useState<string | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.notebook.id === notebookId),
  );

  const move = async (): Promise<void> => {
    if (
      !allowCurrentDestination &&
      notes.length === 1 &&
      notebookId === firstNote?.notebookId
    ) {
      onClose();
      return;
    }

    try {
      const result = await onMove(notes, notebookId);

      if (result.error !== null) {
        const movedCount = result.completedNoteIds.length;
        setError(
          movedCount === 0
            ? 'The notes could not be moved.'
            : `${movedCount} ${movedCount === 1 ? 'note was' : 'notes were'} moved. Resolve the remaining notes and try again.`,
        );
        return;
      }

      onClose();
    } catch {
      setError('The note could not be moved.');
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void move();
  };

  const onPickerKeyDown = (event: KeyboardEvent<HTMLSelectElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void move();
      return;
    }

    const offset = event.key === 'j' ? 1 : event.key === 'k' ? -1 : 0;

    if (offset === 0 || options.length === 0) {
      return;
    }

    event.preventDefault();
    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, selectedIndex + offset),
    );

    setNotebookId(options[nextIndex].notebook.id);
  };

  return (
    <div className="notes-move-dialog__backdrop" role="presentation">
      <button
        type="button"
        className="notes-move-dialog__dismiss"
        aria-label="Cancel moving note"
        onClick={onClose}
      />
      <form
        className="notes-move-dialog"
        aria-label={`Move ${notes.length} ${notes.length === 1 ? 'note' : 'notes'} to notebook`}
        onSubmit={submit}
      >
        <h2>Move to notebook</h2>
        <p>
          Use <kbd>j</kbd>/<kbd>k</kbd> to choose, then <kbd>Enter</kbd>.
        </p>
        <select
          aria-label="Destination notebook"
          value={notebookId}
          size={Math.min(Math.max(options.length, 3), 8)}
          onChange={(event) => setNotebookId(event.target.value)}
          onKeyDown={onPickerKeyDown}
        >
          {options.map(({ notebook, depth }) => (
            <option key={notebook.id} value={notebook.id}>
              {' '.repeat(depth * 2)}
              {notebook.name}
            </option>
          ))}
        </select>
        {error !== null && <p role="alert">{error}</p>}
        <div className="notes-move-dialog__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">{actionLabel}</button>
        </div>
      </form>
    </div>
  );
}
