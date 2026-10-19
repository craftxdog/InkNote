type IconProps = {
  size?: number;
};

export function NotesIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <path
        d="M8 8h8M8 12h8M8 16h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function LibraryIcon({ size = 22 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 5.25c2.65 0 4.8.65 6.5 1.95v11.55c-1.7-1.3-3.85-1.95-6.5-1.95V5.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M20.5 5.25c-2.65 0-4.8.65-6.5 1.95v11.55c1.7-1.3 3.85-1.95 6.5-1.95V5.25Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M12 7.25v11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      <path
        d="M6 8.25h1.75M6 11h1.75"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />

      <path
        d="M16.25 8.25H18M16.25 11H18"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TemplateIcon({ size = 18 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M4.863.98A2.9 2.9 0 0 1 6 .75h1.737m3.69 0h3.422m3.66 0h1.741c.398 0 .75.352.75.75v1.653m0 3.722v3.24m0 3.692V15.5c0 .398-.352.75-.75.75h-1.41m-2.97 0h-2.732m-2.97 0H7.375m-2.97 0H3v-1.513m0-3.21V8.494m0-3.18V3.75c0-.391.078-.767.22-1.113M21 20.75h-9.36m-5.03 0H5.25A2.25 2.25 0 0 1 3 18.5v-2.344m16.5 4.594v-4.5m-12.875 2.5v4.5l2.5-1.812 2.5 1.812v-4.5"
      />
    </svg>
  );
}

export function InboxIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 8 6 4h12l2 4v10H4V8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      <path
        d="M4 11h5l1.5 2h3L15 11h5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function BriefcaseIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="7"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <path
        d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <path d="M8 7v13M16 7v13" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function RocketIcon({ size = 18 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

export function SearchIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="10.5"
        cy="10.5"
        r="6"
        stroke="currentColor"
        strokeWidth="1.6"
      />

      <path
        d="m15 15 5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon({ size = 18 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />

      <path
        d="M12 8v8M8 12h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronIcon({ size = 17 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon({ size = 24 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M1.5 4.5h21m-8.25-3h-4.5A1.5 1.5 0 0 0 8.25 3v1.5h7.5V3a1.5 1.5 0 0 0-1.5-1.5m-4.5 15.75v-7.5m4.5 7.5v-7.5m4.615 11.374A1.5 1.5 0 0 1 17.37 22.5H6.631a1.5 1.5 0 0 1-1.495-1.376L3.75 4.5h16.5Z"
      />
    </svg>
  );
}
