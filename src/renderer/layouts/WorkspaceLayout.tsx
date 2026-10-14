import type { ReactNode } from 'react';

type WorkSpaceLayoutProps = {
  isNavigationVisible: boolean;
  navigation: ReactNode;
  notes: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
};

export const WorkSpaceLayout = ({
  isNavigationVisible,
  navigation,
  notes,
  editor,
  preview,
}: WorkSpaceLayoutProps) => {
  return (
    <div
      className={[
        'workspace',
        !isNavigationVisible ? 'workspace--navigation-hidden' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <aside
        className={[
          'workspace__navigation',
          !isNavigationVisible ? 'workspace__navigation--hidden' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden={!isNavigationVisible}
      >
        {navigation}
      </aside>

      <section className="workspace__notes">{notes}</section>

      <section className="workspace__editor">{editor}</section>

      <section className="workspace__preview">{preview}</section>
    </div>
  );
};
