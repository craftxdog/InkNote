import type { ReactNode } from 'react';
import { WorkspaceNavbar } from '../components/workspace/WorkspaceNavbar';

type WorkSpaceLayoutProps = {
  isNavigationVisible: boolean;
  onToggleNavigation: () => void;

  navigation: ReactNode;
  notes: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
};

export const WorkSpaceLayout = ({
  isNavigationVisible,
  onToggleNavigation,
  navigation,
  notes,
  editor,
  preview,
}: WorkSpaceLayoutProps) => {
  return (
    <div
      className={[
        'workspace-shell',
        !isNavigationVisible ? 'workspace-shell--navigation-hidden' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <WorkspaceNavbar
        isNavigationVisible={isNavigationVisible}
        onToggleNavigation={onToggleNavigation}
      />
      <main className="workspace-grid">
        <aside
          className="workspace__navigation"
          aria-hidden={!isNavigationVisible}
        >
          {navigation}
        </aside>
        <section className="workspace__notes">{notes}</section>
        <section className="workspace__editor">{editor}</section>
        <section className="workspace__preview">{preview}</section>
      </main>
    </div>
  );
};
