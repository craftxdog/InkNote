import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type {
  Notebook,
  NotebookIconName,
} from '../../../../shared/documents/document.types';

import { NOTEBOOK_ICON_OPTIONS } from '../model/notebookIconOptions';
import { eligibleNotebookParents } from '../model/notebookTree';

export type NotebookEditorValues = Readonly<{
  name: string;
  parentId: string | null;
  icon: NotebookIconName | null;
}>;

type NotebookEditorDialogProps = Readonly<{
  notebook: Notebook;
  notebooks: readonly Notebook[];
  onCancel: () => void;
  onSave: (values: NotebookEditorValues) => Promise<void>;
}>;

export function NotebookEditorDialog({
  notebook,
  notebooks,
  onCancel,
  onSave,
}: NotebookEditorDialogProps) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(notebook.name);
  const [parentId, setParentId] = useState<string | null>(
    notebook.parentId ?? null,
  );
  const [icon, setIcon] = useState<NotebookIconName | null>(
    notebook.icon ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eligibleParents = useMemo(
    () => eligibleNotebookParents(notebooks, notebook.id),
    [notebook.id, notebooks],
  );

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const normalizedName = name.trim();

    if (normalizedName.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({ name: normalizedName, parentId, icon });
      onCancel();
    } catch {
      setError('The notebook could not be saved.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled])',
        ) ?? []),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);

      if (first === undefined || last === undefined) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="navigation-dialog-backdrop" role="presentation">
      <button
        type="button"
        className="navigation-dialog__dismiss"
        aria-label="Cancel editing notebook"
        onClick={onCancel}
      />
      <form
        ref={dialogRef}
        className="navigation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notebook-editor-title"
        onSubmit={(event) => void submit(event)}
      >
        <h2 id="notebook-editor-title">Edit {notebook.name} notebook</h2>
        <label htmlFor="notebook-editor-name">
          Name
          <input
            ref={nameInputRef}
            id="notebook-editor-name"
            aria-label="Notebook name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label htmlFor="notebook-editor-parent">
          Parent
          <select
            id="notebook-editor-parent"
            aria-label="Parent notebook"
            value={parentId ?? ''}
            onChange={(event) => setParentId(event.target.value || null)}
          >
            <option value="">Library root</option>
            {eligibleParents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="notebook-editor-icon">
          Icon
          <select
            id="notebook-editor-icon"
            aria-label="Notebook icon"
            value={icon ?? ''}
            onChange={(event) =>
              setIcon(
                event.target.value === ''
                  ? null
                  : (event.target.value as NotebookIconName),
              )
            }
          >
            <option value="">No icon</option>
            {NOTEBOOK_ICON_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {error !== null && (
          <p className="navigation-inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="navigation-dialog__actions">
          <button type="button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving || name.trim().length === 0}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
