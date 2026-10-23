import {
  createNoteId,
  type NoteDocument,
  type NoteId,
} from '../../../../shared/documents/document.types';

export const NOTE_REFERENCE_PROTOCOL = 'inknote:';

const NOTE_REFERENCE_HOST = 'note';

export const formatNoteReference = (document: NoteDocument): string => {
  const label = escapeMarkdownLabel(document.title.trim() || 'Untitled note');
  const id = encodeURIComponent(document.id);

  return `[${label}](${NOTE_REFERENCE_PROTOCOL}//${NOTE_REFERENCE_HOST}/${id})`;
};

export const parseNoteReference = (href: string): NoteId | null => {
  try {
    const url = new URL(href);

    if (
      url.protocol !== NOTE_REFERENCE_PROTOCOL ||
      url.hostname !== NOTE_REFERENCE_HOST ||
      url.search.length > 0 ||
      url.hash.length > 0
    ) {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);

    if (segments.length !== 1) {
      return null;
    }

    const id = decodeURIComponent(segments[0] ?? '');

    return id.trim().length === 0 ? null : createNoteId(id);
  } catch {
    return null;
  }
};

const escapeMarkdownLabel = (value: string): string =>
  value.replace(/[\\[\]]/g, '\\$&');
