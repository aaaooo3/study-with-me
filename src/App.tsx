import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ManagePage from './pages/ManagePage';
import QuizPage from './pages/QuizPage';
import './App.css';

function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/manage" element={<ManagePage />} />
        <Route path="/manage/:categoryId" element={<ManagePage />} />
        <Route path="/quiz/:categoryId" element={<QuizPage />} />
      </Routes>
    </div>
  );
}

export default App;
