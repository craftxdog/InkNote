import type { CSSProperties, ReactNode } from 'react';

type NavigationRowProps = {
  label: string;
  icon?: ReactNode;
  prefix?: ReactNode;
  count?: number;
  depth?: number;
  selected?: boolean;
  onClick?: () => void;
};

export const NavigationRow = ({
  label,
  icon,
  prefix,
  count,
  depth = 0,
  selected = false,
  onClick,
}: NavigationRowProps) => {
  const style = {
    '--navigation-depth': depth,
  } as CSSProperties;
  return (
    <>
      <button
        className={[
          'navigation-row',
          selected ? 'navigation-row--selected' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        type="button"
        style={style}
        onClick={onClick}
        aria-current={selected ? 'page' : undefined}
      >
        {prefix && <span className="navigation-row__prefix">{prefix}</span>}
        {icon && <span className="navigation-row__icon">{icon}</span>}
        <span className="navigation-row__label">{label}</span>
        {count !== undefined && (
          <span className="navigation-row__count">{count}</span>
        )}
      </button>
    </>
  );
};
