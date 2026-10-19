type IconProps = {
  size?: number;
};
export function CollapseIcon({ size = 21 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 8H3V3M16 16h5v5M3 3l6 6M21 21l-6-6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SidebarIcon({ size = 24 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M1.75 21h20.5c.6 0 1-.4 1-1V4c0-.6-.4-1-1-1H1.75c-.6 0-1 .4-1 1v16c0 .5.5 1 1 1M9.25 3v18M6.55 6.7h-3M6.55 10h-3M6.55 13.2h-3M6.55 16.4h-1.3"
      />
    </svg>
  );
}

export function SettingsIcon({ size = 23 }: IconProps) {
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
        d="M10.546 2.438a1.957 1.957 0 0 0 2.908 0L14.4 1.4a1.959 1.959 0 0 1 3.41 1.413l-.071 1.4a1.96 1.96 0 0 0 2.051 2.054l1.4-.071a1.959 1.959 0 0 1 1.41 3.41l-1.042.94a1.96 1.96 0 0 0 0 2.909l1.042.94a1.959 1.959 0 0 1-1.413 3.41l-1.4-.071a1.96 1.96 0 0 0-2.056 2.056l.071 1.4A1.959 1.959 0 0 1 14.4 22.6l-.941-1.041a1.96 1.96 0 0 0-2.908 0L9.606 22.6A1.959 1.959 0 0 1 6.2 21.192l.072-1.4a1.96 1.96 0 0 0-2.056-2.056l-1.4.071A1.958 1.958 0 0 1 1.4 14.4l1.041-.94a1.96 1.96 0 0 0 0-2.909L1.4 9.606A1.958 1.958 0 0 1 2.809 6.2l1.4.071a1.96 1.96 0 0 0 2.058-2.06L6.2 2.81A1.959 1.959 0 0 1 9.606 1.4Z"
      />
      <circle
        cx="12"
        cy="12.001"
        r="4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function NewNoteIcon({ size = 24 }: IconProps) {
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
        d="m13.045 14.136-3.712.531.53-3.713 9.546-9.546a2.25 2.25 0 0 1 3.182 3.182Zm5.303-11.667 3.182 3.182"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M18.75 14.25v7.5a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5v-15a1.5 1.5 0 0 1 1.5-1.5h7.5"
      />
    </svg>
  );
}

export function ExpandIcon({ size = 21 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m9.75 14.248-9 9m22.5-15.75V.748H16.5M.75 16.498v6.75H7.5M23.25.748l-9 9"
      />
    </svg>
  );
}

export function BackIcon({ size = 22 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m15 18-6-6 6-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ForwardIcon({ size = 22 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m9 18 6-6-6-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EditModeIcon({ size = 21 }: IconProps) {
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
        d="M8 20.245a1.5 1.5 0 0 1-2.121 0l-2.127-2.122a1.5 1.5 0 0 1 0-2.121L18.125 1.629a3 3 0 0 1 4.243 4.242zM18.125 1.629a3 3 0 0 0-4.242 0l-3.237 3.236m2.122 2.121 4.242 4.243M1.63 20.244l2.122-2.121 2.121 2.12-2.12 2.122zm1.061 1.061L.747 23.25"
      />
    </svg>
  );
}

export function SplitViewIcon({ size = 21 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M24 2a2 2 0 0 0-2-2H2a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2ZM2.5 2h8a.5.5 0 0 1 .5.5v19a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-19a.5.5 0 0 1 .5-.5m19 20h-8a.5.5 0 0 1-.5-.5v-19a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v19a.5.5 0 0 1-.5.5"
      />
    </svg>
  );
}

export function PreviewIcon({ size = 22 }: IconProps) {
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
        d="M12 5.251C7.969 5.183 3.8 8 1.179 10.885a1.663 1.663 0 0 0 0 2.226C3.743 15.935 7.9 18.817 12 18.748c4.1.069 8.258-2.813 10.824-5.637a1.663 1.663 0 0 0 0-2.226C20.2 8 16.031 5.183 12 5.251"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M15.75 12A3.75 3.75 0 1 1 12 8.249 3.75 3.75 0 0 1 15.75 12"
      />
    </svg>
  );
}

export function MoreIcon({ size = 22 }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 140 140"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="8.75"
        d="M54.612 120.33a15.313 15.313 0 1 0 30.625 0 15.313 15.313 0 1 0-30.625 0m0-100.625a15.313 15.313 0 1 0 30.625 0 15.313 15.313 0 1 0-30.625 0m0 50.313a15.313 15.313 0 1 0 30.625 0 15.313 15.313 0 1 0-30.625 0"
      />
    </svg>
  );
}
