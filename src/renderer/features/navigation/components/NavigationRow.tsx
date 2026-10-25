import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from 'react';

type NavigationRowAction = {
  label: string;
  title: string;
  onClick: () => void;
};

type NavigationRowToggle = {
  expanded: boolean;
  title: string;
  onClick: () => void;
  icon: ReactNode;
};

type NavigationRowProps = {
  label: string;

  icon: ReactNode;

  prefix?: ReactNode;

  count?: number;

  depth?: number;

  selected?: boolean;

  onClick?: () => void;

  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;

  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;

  action?: NavigationRowAction;

  toggle?: NavigationRowToggle;
};

export function NavigationRow({
  label,
  icon,
  prefix,
  count,
  depth = 0,
  selected = false,
  onClick,
  onKeyDown,
  onContextMenu,
  action,
  toggle,
}: NavigationRowProps) {
  const className = [
    'navigation-row',

    selected ? 'navigation-row--selected' : '',

    action ? 'navigation-row--has-action' : '',

    toggle ? 'navigation-row--has-toggle' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    '--navigation-depth': depth,
  } as CSSProperties;

  return (
    <div className={className} style={style}>
      {toggle ? (
        <button
          type="button"
          className="navigation-row__toggle"
          aria-label={toggle.title}
          title={toggle.title}
          aria-expanded={toggle.expanded}
          onClick={(event) => {
            event.stopPropagation();
            toggle.onClick();
          }}
        >
          {toggle.icon}
        </button>
      ) : null}
      <button
        type="button"
        className="navigation-row__primary"
        onClick={onClick}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
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
          tabIndex={-1}
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
