import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import ViewerPage from './pages/ViewerPage.jsx';
import IntracellularPage from './pages/IntracellularPage.jsx';
import ProcessPage from './pages/ProcessPage.jsx';
import ComparePage from './pages/ComparePage.jsx';
import GlossaryPage from './pages/GlossaryPage.jsx';
import QuizPage from './pages/QuizPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/viewer/:cellId" element={<ViewerPage />} />
      <Route path="/intracellulair/:cellId" element={<IntracellularPage />} />
      <Route path="/proces/:cellId" element={<ProcessPage />} />
      <Route path="/vergelijk" element={<ComparePage />} />
      <Route path="/begrippen" element={<GlossaryPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
