import { useEffect, useState } from 'react';

import { EditorPanel } from '../features/editor/components/EditorPanel';

import { NavigationPanel } from '../features/navigation/components/NavigationPanel';

import { navigationDestinations } from '../features/navigation/data/navigation.data';

import { navigationWorkspaces } from '../features/navigation/data/navigation.workspace.mock';

import type {
  NavigationScope,
  NavigationSelection,
  NavigationWorkspaceId,
} from '../features/navigation/model/navigation.types';

import { NotesPanel } from '../features/notes/components/NotesPanel';

import { PreviewPanel } from '../features/preview/components/PreviewPanel';

import { WorkspaceLayout } from '../layouts/WorkspaceLayout';

import type { WorkspaceViewMode } from '../types/workspace';

export function WorkspacePage() {
  /* =======================================================
     Workspace UI
  ======================================================= */

  const [isNavigationVisible, setIsNavigationVisible] = useState(true);

  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);

  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('split');

  /* =======================================================
     Navigation
  ======================================================= */

  /**
   * Dónde está navegando actualmente el usuario.
   *
   * library:
   * sidebar completo.
   *
   * workspace:
   * sidebar enfocado en Inbox / Work / Projects.
   */
  const [navigationScope, setNavigationScope] = useState<NavigationScope>({
    type: 'library',
  });

  /**
   * Filtro/destino seleccionado dentro
   * del scope actual.
   *
   * Ejemplo:
   *
   * scope     = Work
   * selection = Completed
   */
  const [navigationSelection, setNavigationSelection] =
    useState<NavigationSelection>(navigationDestinations.allNotes);

  /* =======================================================
     macOS traffic lights
  ======================================================= */

  const shouldShowTrafficLights = isNavigationVisible && !isWorkspaceExpanded;

  useEffect(() => {
    void window.inknote.windowControls
      .setTrafficLightsVisible(shouldShowTrafficLights)
      .catch((error: unknown) => {
        console.error('Failed to update traffic lights visibility', error);
      });
  }, [shouldShowTrafficLights]);

  /* =======================================================
     Workspace actions
  ======================================================= */

  const toggleNavigation = () => {
    setIsNavigationVisible((current) => !current);
  };

  const toggleWorkspaceExpanded = () => {
    setIsWorkspaceExpanded((current) => !current);
  };

  /* =======================================================
     Focused Workspace navigation
  ======================================================= */

  /**
   * Abre cualquier contexto compatible
   * en Workspace View.
   *
   * Se reutiliza tanto para entrar por
   * Detail como para navegar entre
   * Work -> Projects.
   */
  const openNavigationWorkspace = (workspaceId: NavigationWorkspaceId) => {
    setNavigationScope({
      type: 'workspace',
      workspaceId,
    });

    /**
     * Al entrar a un workspace mostramos
     * inicialmente todas sus notas.
     */
    setNavigationSelection(navigationDestinations.allNotes);
  };

  /**
   * Regresa al Library View.
   *
   * Dejamos seleccionado el contexto
   * del que acaba de salir el usuario.
   */
  const exitNavigationWorkspace = () => {
    if (navigationScope.type === 'workspace') {
      const workspace = navigationWorkspaces[navigationScope.workspaceId];

      setNavigationSelection(workspace.rootSelection);
    }

    setNavigationScope({
      type: 'library',
    });
  };

  /* =======================================================
     Navbar context
  ======================================================= */

  /**
   * Muy importante:
   *
   * selection y navbar context NO siempre
   * son lo mismo.
   *
   * Ejemplo:
   *
   * Workspace: Work
   * Filter: Completed
   *
   * Navbar debe seguir mostrando "Work".
   */
  const navigationContextSelection =
    navigationScope.type === 'workspace'
      ? navigationWorkspaces[navigationScope.workspaceId].rootSelection
      : navigationSelection;

  /* =======================================================
     Render
  ======================================================= */

  return (
    <WorkspaceLayout
      navigationSelection={navigationContextSelection}
      isNavigationVisible={isNavigationVisible}
      isWorkspaceExpanded={isWorkspaceExpanded}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onToggleNavigation={toggleNavigation}
      onToggleWorkspaceExpanded={toggleWorkspaceExpanded}
      navigation={
        <NavigationPanel
          scope={navigationScope}
          selection={navigationSelection}
          onSelectionChange={setNavigationSelection}
          onEnterWorkspace={openNavigationWorkspace}
          onExitWorkspace={exitNavigationWorkspace}
          onWorkspaceChange={openNavigationWorkspace}
        />
      }
      notes={<NotesPanel navigationSelection={navigationSelection} />}
      editor={<EditorPanel />}
      preview={<PreviewPanel />}
    />
  );
}
