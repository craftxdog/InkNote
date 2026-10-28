import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  TAG_COLORS,
  TAG_NAME_MAX_LENGTH,
  type TagColor,
  type TagSummary,
} from '../../../../shared/documents/document.types';

export type TagEditorValues = Readonly<{
  name: string;
  color: TagColor;
}>;

type TagEditorDialogProps = Readonly<{
  tag?: TagSummary;
  onCancel: () => void;
  onSave: (values: TagEditorValues) => Promise<void>;
}>;

const tagColorLabel = (color: TagColor): string =>
  color === 'default'
    ? 'Default'
    : `${color.slice(0, 1).toUpperCase()}${color.slice(1)}`;

export function TagEditorDialog({
  tag,
  onCancel,
  onSave,
}: TagEditorDialogProps) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isEditing = tag !== undefined;
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState<TagColor>(tag?.color ?? 'default');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogTitle = isEditing ? `Edit ${tag.name} tag` : 'New tag';

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
      await onSave({ name: normalizedName, color });
      onCancel();
    } catch {
      setError('The tag could not be saved.');
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
        aria-label={isEditing ? 'Cancel editing tag' : 'Cancel creating tag'}
        onClick={onCancel}
      />
      <form
        ref={dialogRef}
        className="navigation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-editor-title"
        onSubmit={(event) => void submit(event)}
      >
        <h2 id="tag-editor-title">{dialogTitle}</h2>
        <label htmlFor="tag-editor-name">
          Name
          <input
            ref={nameInputRef}
            id="tag-editor-name"
            aria-label="Tag name"
            value={name}
            maxLength={TAG_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label htmlFor="tag-editor-color">
          Color
          <select
            id="tag-editor-color"
            aria-label="Tag color"
            value={color}
            onChange={(event) => setColor(event.target.value as TagColor)}
          >
            {TAG_COLORS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {tagColorLabel(candidate)}
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
            {isSaving ? 'Saving…' : isEditing ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
