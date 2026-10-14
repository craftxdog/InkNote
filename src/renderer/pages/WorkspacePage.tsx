import { EditorPanel } from '../features/editor/components/EditorPanel';
import { NavigationPanel } from '../features/navigation/components/NavigationPanel';
import { NotesPanel } from '../features/notes/components/NotesPanel';
import { PreviewPanel } from '../features/preview/components/PreviewPanel';
import { WorkSpaceLayout } from '../layouts/WorkspaceLayout';

export function WorkspacePage() {
  return (
    <WorkSpaceLayout
      navigation={<NavigationPanel />}
      notes={<NotesPanel />}
      editor={<EditorPanel />}
      preview={<PreviewPanel />}
    />
  );
}
