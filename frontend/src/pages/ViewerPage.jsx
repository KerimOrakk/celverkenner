import { useParams } from 'react-router-dom';
import CellExperience from '../components/CellExperience.jsx';

/** The cell seen from outside: rotate it, open the membrane, click organelles. */
export default function ViewerPage() {
  const { cellId } = useParams();
  return <CellExperience cellId={cellId} mode="viewer" />;
}
