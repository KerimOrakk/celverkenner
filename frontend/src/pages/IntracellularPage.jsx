import { useParams } from 'react-router-dom';
import CellExperience from '../components/CellExperience.jsx';

/** Intracellular mode: the camera stands in the cytoplasm, between the organelles. */
export default function IntracellularPage() {
  const { cellId } = useParams();
  return <CellExperience cellId={cellId} mode="intracellular" />;
}
