import { Link, useNavigate } from 'react-router-dom';
import Dropdown from '../ui/Dropdown.jsx';
import ApiStatus from './ApiStatus.jsx';

export const MODE_PATHS = {
  viewer: '/viewer',
  intracellular: '/intracellulair',
};

const MODE_LABELS = [
  { mode: 'viewer', label: '3D-viewer' },
  { mode: 'intracellular', label: 'Intracellulair' },
];

/** Navigation of the viewer pages: back to the cell choice, switch cell, switch mode. */
export default function TopBar({ cells, cellId, mode, source }) {
  const navigate = useNavigate();
  const options = cells.map((cell) => ({ value: cell.id, label: cell.name, hint: cell.type_label }));

  return (
    <header className="topbar">
      <Link to="/" className="topbar__back">
        <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
          <path d="M6.5 1 1.5 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Celkeuze
      </Link>

      {options.length > 0 && (
        <Dropdown
          label="Cel"
          options={options}
          value={cellId}
          onChange={(nextId) => navigate(`${MODE_PATHS[mode]}/${nextId}`)}
        />
      )}

      <nav className="mode-switch" aria-label="Weergave">
        {MODE_LABELS.map((item) => (
          <Link
            key={item.mode}
            to={`${MODE_PATHS[item.mode]}/${cellId}`}
            className={`mode-switch__item${item.mode === mode ? ' is-active' : ''}`}
            aria-current={item.mode === mode ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="topbar__status">
        <ApiStatus source={source} />
      </div>
    </header>
  );
}
