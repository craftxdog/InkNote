import { useEffect, useState } from 'react';

import { EditorPanel } from '../features/editor/components/EditorPanel';
import { NavigationPanel } from '../features/navigation/components/NavigationPanel';
import { NotesPanel } from '../features/notes/components/NotesPanel';
import { PreviewPanel } from '../features/preview/components/PreviewPanel';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import type { WorkspaceViewMode } from '../types/workspace';

export function WorkspacePage() {
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('split');

  /*
   * Traffic lights are shown only when the
   * Navigation panel is actually visible.
   *
   * Expanded mode always hides them.
   */

  const shouldShowTrafficLights = isNavigationVisible && !isWorkspaceExpanded;

  useEffect(() => {
    void window.inknote.windowControls
      .setTrafficLightsVisible(shouldShowTrafficLights)
      .catch((error: unknown) => {
        console.error('Failed to update traffic lights visibility', error);
      });
  }, [shouldShowTrafficLights]);

  const toggleNavigation = () => {
    setIsNavigationVisible((current) => !current);
  };

  const toggleWorkspaceExpanded = () => {
    setIsWorkspaceExpanded((current) => !current);
  };

  return (
    <WorkspaceLayout
      isNavigationVisible={isNavigationVisible}
      isWorkspaceExpanded={isWorkspaceExpanded}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onToggleNavigation={toggleNavigation}
      onToggleWorkspaceExpanded={toggleWorkspaceExpanded}
      navigation={<NavigationPanel />}
      notes={<NotesPanel />}
      editor={<EditorPanel />}
      preview={<PreviewPanel />}
    />
  );
}
