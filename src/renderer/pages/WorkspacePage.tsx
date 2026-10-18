import { useEffect, useState } from 'react';
import { EditorPanel } from '../features/editor/components/EditorPanel';
import { NavigationPanel } from '../features/navigation/components/NavigationPanel';
import { navigationDestinations } from '../features/navigation/data/navigation.data';
import type { NavigationSelection } from '../features/navigation/model/navigation.types';
import { NotesPanel } from '../features/notes/components/NotesPanel';
import { PreviewPanel } from '../features/preview/components/PreviewPanel';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import type { WorkspaceViewMode } from '../types/workspace';

export function WorkspacePage() {
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('split');

  /**
   * Contexto seleccionado actualmente.
   *
   * Esta es la única fuente de verdad para:
   *
   * - fila seleccionada en Navigation
   * - título del panel Notes
   * - scope de notas
   */
  const [navigationSelection, setNavigationSelection] =
    useState<NavigationSelection>(navigationDestinations.allNotes);

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
      navigationSelection={navigationSelection}
      isNavigationVisible={isNavigationVisible}
      isWorkspaceExpanded={isWorkspaceExpanded}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onToggleNavigation={toggleNavigation}
      onToggleWorkspaceExpanded={toggleWorkspaceExpanded}
      navigation={
        <NavigationPanel
          selection={navigationSelection}
          onSelectionChange={setNavigationSelection}
        />
      }
      notes={<NotesPanel navigationSelection={navigationSelection} />}
      editor={<EditorPanel />}
      preview={<PreviewPanel />}
    />
  );
}
