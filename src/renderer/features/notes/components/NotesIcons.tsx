import type { NoteStatus } from '../../../../shared/documents/document.types';

type IconProps = {
  size?: number;
};

export function FilterIcon({ size = 19 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 5h18l-7 8v5l-4 2v-7L3 5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClearIcon({ size = 12 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m8 8 8 8M16 8l-8 8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PinIcon({ size = 16 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m14 4 6 6-3 1-4 4-1 4-2-2-3 3-1-1 3-3-2-2 4-1 4-4-1-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type NoteStatusIconProps = IconProps & {
  status: NoteStatus;
};

/**
 * Statuses stay recognizable without relying on their color alone: play,
 * pause, check, and close mirror the vocabulary in the navigation sidebar.
 */
export function NoteStatusIcon({ status, size = 16 }: NoteStatusIconProps) {
  const icon = (() => {
    switch (status) {
      case 'active':
        return (
          <>
            <circle cx="12" cy="12" r="9" fill="currentColor" />
            <path d="m10 8 6 4-6 4V8Z" fill="var(--color-notes, #fff)" />
          </>
        );
      case 'on-hold':
        return (
          <>
            <circle
              cx="12"
              cy="12"
              r="8.5"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M10 8.5v7M14 8.5v7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );
      case 'completed':
        return (
          <>
            <circle cx="12" cy="12" r="9" fill="currentColor" />
            <path
              d="m8.5 12.3 2.2 2.2 4.9-5"
              fill="none"
              stroke="var(--color-notes, #fff)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );
      case 'dropped':
        return (
          <>
            <circle cx="12" cy="12" r="9" fill="currentColor" />
            <path
              d="m9 9 6 6m0-6-6 6"
              stroke="var(--color-notes, #fff)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        );
    }
  })();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

export function TaskProgressIcon({ size = 15 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="5"
        y="4"
        width="12"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M9 4.25h4v3H9zM8.5 12h.01M11 12h3.5M8.5 16h.01M11 16h3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArchiveNoteIcon({ size = 15 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 8h16v11H4zM3 5h18v3H3zM10 12h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
