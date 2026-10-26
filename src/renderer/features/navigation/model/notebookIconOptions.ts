import type { NotebookIconName } from '../../../../shared/documents/document.types';

export const NOTEBOOK_ICON_OPTIONS: readonly Readonly<{
  value: NotebookIconName;
  label: string;
}>[] = [
  { value: 'briefcase', label: 'Briefcase' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'book', label: 'Book' },
  { value: 'note', label: 'Note' },
  { value: 'code', label: 'Code' },
  { value: 'palette', label: 'Palette' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'target', label: 'Target' },
  { value: 'heart', label: 'Heart' },
  { value: 'globe', label: 'Globe' },
  { value: 'folder', label: 'Folder' },
  { value: 'lightbulb', label: 'Idea' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'laptop', label: 'Computer' },
  { value: 'flask', label: 'Research' },
  { value: 'wrench', label: 'Tools' },
  { value: 'music', label: 'Music' },
  { value: 'camera', label: 'Media' },
  { value: 'leaf', label: 'Nature' },
  { value: 'bookmark', label: 'Reference' },
  { value: 'star', label: 'Favorite' },
];
