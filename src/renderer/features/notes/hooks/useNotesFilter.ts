import { useMemo } from 'react';

import type { NoteSummary } from '../model/note.types';

/**
 * Normaliza texto para búsquedas locales:
 *
 * - elimina espacios externos
 * - convierte a minúsculas
 * - ignora tildes/diacríticos
 *
 * Ejemplo:
 * "Búsqueda" -> "busqueda"
 */
function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

/**
 * Filtra una colección de notas usando:
 *
 * - title
 * - excerpt
 * - tags
 *
 * Actualmente trabaja en memoria.
 * Más adelante podrá sustituirse por una consulta
 * contra SQLite/API sin cambiar NotesFilter.
 */
export function useNotesFilter(
  notes: NoteSummary[],
  query: string,
): NoteSummary[] {
  return useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    if (!normalizedQuery) {
      return notes;
    }

    return notes.filter((note: NoteSummary) => {
      const searchableContent = [
        note.title,
        note.excerpt,
        ...note.tags.map((tag) => tag.label),
      ].join(' ');

      return normalizeSearchValue(searchableContent).includes(normalizedQuery);
    });
  }, [notes, query]);
}
