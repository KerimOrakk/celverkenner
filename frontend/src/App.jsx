import { Navigate, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import ViewerPage from './pages/ViewerPage.jsx';
import IntracellularPage from './pages/IntracellularPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/viewer/:cellId" element={<ViewerPage />} />
      <Route path="/intracellulair/:cellId" element={<IntracellularPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
