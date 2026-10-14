import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import icon from '../../assets/icon.svg';
import './App.css';

const Hello = () => {
  return (
    <div>
      <div>
        <h1 className="bg-red-500">Hello world</h1>
      </div>
      <span className="app-titlebar_color" />
      <div className="Hello">
        <img width="200" alt="icon" src={icon} />
      </div>
      <div className="Hello"></div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
