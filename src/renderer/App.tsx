import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/globals.css';
import { WorkSpaceLayout } from './layouts/WorkspaceLayout';
import { NavigationPanel } from './features/navigation/components/NavigationPanel';
import { NotesPanel } from './features/notes/components/NotesPanel';
import { EditorPanel } from './features/editor/components/EditorPanel';
import { PreviewPanel } from './features/preview/components/PreviewPanel';

function WorkspacePage() {
  return (
    <WorkSpaceLayout
      navigation={<NavigationPanel />}
      notes={<NotesPanel />}
      editor={<EditorPanel />}
      preview={<PreviewPanel />}
    />
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WorkspacePage />} />
      </Routes>
    </Router>
  );
}
