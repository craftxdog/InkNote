import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';

import type {
  Notebook,
  NoteDocument,
} from '../../../../shared/documents/document.types';
import { buildNotebookTreeRows } from '../../navigation/model/notebookTree';

type MoveNoteDialogProps = {
  note: NoteDocument;
  notebooks: readonly Notebook[];
  onMove: (note: NoteDocument, notebookId: string) => Promise<unknown>;
  onClose: () => void;
};

/**
 * Inkdrop-style notebook picker used by the note-list `m` shortcut. The
 * native select keeps the interaction accessible while j/k and Enter offer a
 * direct Vim-friendly path.
 */
export function MoveNoteDialog({
  note,
  notebooks,
  onMove,
  onClose,
}: MoveNoteDialogProps) {
  const options = useMemo(
    () => buildNotebookTreeRows(notebooks, new Map(), ''),
    [notebooks],
  );
  const [notebookId, setNotebookId] = useState(note.notebookId);
  const [error, setError] = useState<string | null>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.notebook.id === notebookId),
  );

  const move = async (): Promise<void> => {
    if (notebookId === note.notebookId) {
      onClose();
      return;
    }

    try {
      await onMove(note, notebookId);
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
        aria-label={`Move ${note.title || 'Untitled'} to notebook`}
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
          <button type="submit">Move</button>
        </div>
      </form>
    </div>
  );
}
