import type { CSSProperties, ReactNode } from 'react';

type NavigationRowProps = {
  label: string;

  icon: ReactNode;

  prefix?: ReactNode;

  count?: number;

  depth?: number;

  selected?: boolean;

  onClick?: () => void;
};

export function NavigationRow({
  label,
  icon,
  prefix,
  count,
  depth = 0,
  selected = false,
  onClick,
}: NavigationRowProps) {
  const className = [
    'navigation-row',
    selected ? 'navigation-row--selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--navigation-depth': depth,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={onClick}
      aria-current={selected ? 'page' : undefined}
    >
      <span className="navigation-row__leading">
        {prefix ? (
          <span className="navigation-row__prefix">{prefix}</span>
        ) : null}

        <span className="navigation-row__icon">{icon}</span>
      </span>

      <span className="navigation-row__label">{label}</span>

      {count !== undefined ? (
        <span className="navigation-row__count">{count}</span>
      ) : null}
    </button>
  );
}
