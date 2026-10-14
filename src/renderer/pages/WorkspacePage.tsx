import { useEffect, useState } from 'react';

import { EditorPanel } from '../features/editor/components/EditorPanel';
import { NavigationPanel } from '../features/navigation/components/NavigationPanel';
import { NotesPanel } from '../features/notes/components/NotesPanel';
import { PreviewPanel } from '../features/preview/components/PreviewPanel';
import { WorkSpaceLayout } from '../layouts/WorkspaceLayout';

export function WorkspacePage() {
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);
  useEffect(() => {
    void window.inknote.windowControls
      .setTrafficLightsVisible(isNavigationVisible)
      .catch((error: unknown) => {
        console.error('Failed to update traffic lights visibility', error);
      });
  }, [isNavigationVisible]);

  const toggleNavigation = () => {
    setIsNavigationVisible((current) => !current);
  };

  return (
    <WorkSpaceLayout
      isNavigationVisible={isNavigationVisible}
      onToggleNavigation={toggleNavigation}
      navigation={<NavigationPanel />}
      notes={<NotesPanel />}
      editor={<EditorPanel />}
      preview={<PreviewPanel />}
    />
  );
}
