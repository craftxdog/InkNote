import type { CSSProperties, ReactNode } from 'react';

type NavigationRowAction = {
  label: string;
  title: string;
  onClick: () => void;
};

type NavigationRowProps = {
  label: string;

  icon: ReactNode;

  prefix?: ReactNode;

  count?: number;

  depth?: number;

  selected?: boolean;

  onClick?: () => void;

  action?: NavigationRowAction;
};

export function NavigationRow({
  label,
  icon,
  prefix,
  count,
  depth = 0,
  selected = false,
  onClick,
  action,
}: NavigationRowProps) {
  const className = [
    'navigation-row',

    selected ? 'navigation-row--selected' : '',

    action ? 'navigation-row--has-action' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--navigation-depth': depth,
  } as CSSProperties;

  return (
    <div className={className} style={style}>
      <button
        type="button"
        className="navigation-row__primary"
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
        ) : (
          <span />
        )}
      </button>

      {action ? (
        <button
          type="button"
          className="navigation-row__action"
          onClick={(event) => {
            event.stopPropagation();

            action.onClick();
          }}
          aria-label={action.title}
          title={action.title}
        >
          <span>{action.label}</span>

          <span className="navigation-row__action-arrow" aria-hidden="true">
            ›
          </span>
        </button>
      ) : null}
    </div>
  );
}
