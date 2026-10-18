import type { CSSProperties } from 'react';

import type { NavigationSelection } from '../model/navigation.types';

import {
  BriefcaseIcon,
  InboxIcon,
  NotesIcon,
  RocketIcon,
  TemplateIcon,
  TrashIcon,
} from './NavigationIcons';

type NavigationContextIconProps = {
  selection: NavigationSelection;
};

export function NavigationContextIcon({
  selection,
}: NavigationContextIconProps) {
  const { icon } = selection;

  switch (icon.type) {
    case 'all-notes':
      return <NotesIcon />;

    case 'templates':
      return <TemplateIcon />;

    case 'inbox':
      return <InboxIcon />;

    case 'notebook':
      return <BriefcaseIcon />;

    case 'project':
      return <RocketIcon />;

    case 'status':
      return (
        <span
          className={[
            'navigation-status',
            `navigation-status--${icon.status}`,
          ].join(' ')}
        />
      );

    case 'tag':
      return (
        <span
          className="navigation-tag-dot"
          style={
            {
              '--tag-color': icon.color,
            } as CSSProperties
          }
        />
      );

    case 'trash':
      return <TrashIcon />;

    default:
      return null;
  }
}
