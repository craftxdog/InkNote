import type {
  Notebook,
  NotebookIconName,
} from '../../../../shared/documents/document.types';
import type { PropsWithChildren } from 'react';

import { notebookPurposeFor } from '../model/notebookPresentation';

import {
  BriefcaseIcon,
  InboxIcon,
  LibraryIcon,
  NotesIcon,
  RocketIcon,
} from './NavigationIcons';

type NavigationNotebookIconProps = {
  notebook: Pick<Notebook, 'id' | 'name' | 'icon'>;
  size?: number;
};

/** Renders a durable semantic icon without adding presentation state to data. */
export function NavigationNotebookIcon({
  notebook,
  size = 18,
}: NavigationNotebookIconProps) {
  if (notebook.icon !== undefined) {
    return <SelectedNotebookIcon icon={notebook.icon} size={size} />;
  }

  switch (notebookPurposeFor(notebook)) {
    case 'inbox':
      return <InboxIcon size={size} />;
    case 'learn':
      return <LibraryIcon size={size} />;
    case 'project':
      return <RocketIcon size={size} />;
    case 'work':
      return <BriefcaseIcon size={size} />;
    case 'notes':
      return <NotesIcon size={size} />;
  }
}

function SelectedNotebookIcon({
  icon,
  size,
}: Readonly<{ icon: NotebookIconName; size: number }>) {
  switch (icon) {
    case 'briefcase':
      return <BriefcaseIcon size={size} />;
    case 'rocket':
      return <RocketIcon size={size} />;
    case 'book':
      return <LibraryIcon size={size} />;
    case 'note':
      return <NotesIcon size={size} />;
    case 'folder':
      return <FolderIcon size={size} />;
    case 'code':
      return <CodeIcon size={size} />;
    case 'palette':
      return <PaletteIcon size={size} />;
    case 'calendar':
      return <CalendarIcon size={size} />;
    case 'target':
      return <TargetIcon size={size} />;
    case 'heart':
      return <HeartIcon size={size} />;
    case 'globe':
      return <GlobeIcon size={size} />;
    case 'lightbulb':
      return <LightbulbIcon size={size} />;
    case 'terminal':
      return <TerminalIcon size={size} />;
    case 'laptop':
      return <LaptopIcon size={size} />;
    case 'flask':
      return <FlaskIcon size={size} />;
    case 'wrench':
      return <WrenchIcon size={size} />;
    case 'music':
      return <MusicIcon size={size} />;
    case 'camera':
      return <CameraIcon size={size} />;
    case 'leaf':
      return <LeafIcon size={size} />;
    case 'bookmark':
      return <BookmarkIcon size={size} />;
    case 'star':
      return <StarIcon size={size} />;
  }
}

type GlyphProps = Readonly<{ size: number }>;

const Glyph = ({ children, size }: PropsWithChildren<GlyphProps>) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const FolderIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M3.5 6.5h6l1.8 2H20a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7.5a1 1 0 0 1 .5-1Z" />
  </Glyph>
);

const CodeIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" />
  </Glyph>
);

const PaletteIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M12 3.25a8.75 8.75 0 1 0 0 17.5h1.4a1.85 1.85 0 0 0 .4-3.66 1.85 1.85 0 0 1 .4-3.66H16a4.75 4.75 0 0 0 0-9.5Z" />
    <path d="M7.6 11.1h.01M10.25 7.9h.01M14.2 7.9h.01" />
  </Glyph>
);

const CalendarIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
    <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.25h.01M12 17.25h.01" />
  </Glyph>
);

const TargetIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="12" cy="12" r=".8" fill="currentColor" />
  </Glyph>
);

const HeartIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M20.5 8.4c0 5.3-8.5 10.8-8.5 10.8S3.5 13.7 3.5 8.4A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 8.5 1.3Z" />
  </Glyph>
);

const GlobeIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M3.5 12h17M12 3.25c2.4 2.4 3.65 5.32 3.65 8.75S14.4 18.35 12 20.75C9.6 18.35 8.35 15.43 8.35 12S9.6 5.65 12 3.25Z" />
  </Glyph>
);

const LightbulbIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M8 16.25h8M9.5 20h5M7 10.25a5 5 0 1 1 10 0c0 1.93-1 3.1-2.15 4.22-.65.63-.85 1.05-.85 1.78H10c0-.73-.2-1.15-.85-1.78C8 13.35 7 12.18 7 10.25Z" />
  </Glyph>
);

const TerminalIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="m7.5 9 3 3-3 3M13.5 15h3" />
  </Glyph>
);

const LaptopIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <rect x="5.5" y="4" width="13" height="12" rx="1.5" />
    <path d="M3 19.5h18M9.5 19.5l.8-2.5h3.4l.8 2.5" />
  </Glyph>
);

const FlaskIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M9 3.5h6M10 3.5v5.1l-5.35 8.1A2.8 2.8 0 0 0 7 20.75h10a2.8 2.8 0 0 0 2.35-4.05L14 8.6V3.5" />
    <path d="M7.7 15h8.6" />
  </Glyph>
);

const WrenchIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M14.8 5.1a4.25 4.25 0 0 0-5.2 5.2L4.2 15.7a2.3 2.3 0 1 0 3.25 3.25l5.4-5.4a4.25 4.25 0 0 0 5.2-5.2l-2.75 2.15-2.55-2.55 2.05-2.85Z" />
  </Glyph>
);

const MusicIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M9 18.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 18.5ZM18 16.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 18 16.5Z" />
    <path d="M9 18.5V6l9-2v12.5" />
  </Glyph>
);

const CameraIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8Z" />
    <circle cx="12" cy="13.5" r="3.25" />
  </Glyph>
);

const LeafIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M20.25 3.75C10.1 4.1 4.2 8.1 4.2 14.35c0 3.18 2.2 5.4 5.25 5.4 6.13 0 10.24-6.15 10.8-16Z" />
    <path d="M4.75 20.25c2.55-4.12 6.3-7.6 11.25-10.45" />
  </Glyph>
);

const BookmarkIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="M6.5 3.5h11v17l-5.5-3.75-5.5 3.75v-17Z" />
  </Glyph>
);

const StarIcon = ({ size }: GlyphProps) => (
  <Glyph size={size}>
    <path d="m12 3.25 2.7 5.45 6.05.88-4.38 4.27 1.03 6.03L12 17.05l-5.4 2.83 1.03-6.03-4.38-4.27 6.05-.88L12 3.25Z" />
  </Glyph>
);
