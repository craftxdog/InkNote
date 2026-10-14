import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { WorkspacePage } from './pages/WorkspacePage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WorkspacePage />} />
      </Routes>
    </Router>
  );
}
