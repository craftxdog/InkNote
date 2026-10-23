import type { ReactNode } from 'react';

type NavigationHeaderProps = {
  title: string;
  actions?: ReactNode;
};

export const NavigationHeader = ({ title, actions }: NavigationHeaderProps) => {
  return (
    <div className="navigation-section-header">
      <span className="navigation-section-header__title">{title}</span>
      {actions && (
        <div className="navigation-section-header__actions">{actions}</div>
      )}
    </div>
  );
};
