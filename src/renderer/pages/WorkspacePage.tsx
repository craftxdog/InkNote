import { useState } from 'react';

import { EditorPanel } from '../features/editor/components/EditorPanel';
import { NavigationPanel } from '../features/navigation/components/NavigationPanel';
import { NotesPanel } from '../features/notes/components/NotesPanel';
import { PreviewPanel } from '../features/preview/components/PreviewPanel';
import { WorkSpaceLayout } from '../layouts/WorkspaceLayout';

export function WorkspacePage() {
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);

  const toggleNavigation = () => {
    setIsNavigationVisible((current) => !current);
  };
  return (
    <WorkSpaceLayout
      isNavigationVisible={isNavigationVisible}
      navigation={<NavigationPanel />}
      notes={
        <NotesPanel
          isNavigationVisible={isNavigationVisible}
          onToggleNavigation={toggleNavigation}
        />
      }
      editor={<EditorPanel />}
      preview={<PreviewPanel />}
    />
  );
}
