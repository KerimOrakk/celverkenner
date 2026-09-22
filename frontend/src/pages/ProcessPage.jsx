import { useParams } from 'react-router-dom';
import ProcessExperience from '../components/ProcessExperience.jsx';

/** Processes in the cell: protein route, respiration, photosynthesis, ... step by step. */
export default function ProcessPage() {
  const { cellId } = useParams();
  return <ProcessExperience cellId={cellId} />;
}
