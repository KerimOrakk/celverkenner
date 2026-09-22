import { Link, useNavigate } from 'react-router-dom';
import Dropdown from '../ui/Dropdown.jsx';
import LanguageSwitch from '../ui/LanguageSwitch.jsx';
import ApiStatus from './ApiStatus.jsx';
import { useLang } from '../i18n/index.jsx';

export const MODE_PATHS = {
  viewer: '/viewer',
  intracellular: '/intracellulair',
  process: '/proces',
};

const MODES = ['viewer', 'intracellular', 'process'];

/** Navigation of the 3D pages: back to the cell choice, switch cell, switch mode, language. */
export default function TopBar({ cells, cellId, mode, source }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const options = cells.map((cell) => ({ value: cell.id, label: cell.name, hint: cell.type_label }));

  return (
    <header className="topbar">
      <Link to="/" className="topbar__back">
        <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
          <path d="M6.5 1 1.5 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {t('nav.home')}
      </Link>

      {options.length > 0 && (
        <Dropdown
          label={t('nav.cell')}
          options={options}
          value={cellId}
          onChange={(nextId) => navigate(`${MODE_PATHS[mode]}/${nextId}`)}
        />
      )}

      <nav className="mode-switch" aria-label={t('mode.aria')}>
        {MODES.map((item) => (
          <Link
            key={item}
            to={`${MODE_PATHS[item]}/${cellId}`}
            className={`mode-switch__item${item === mode ? ' is-active' : ''}`}
            aria-current={item === mode ? 'page' : undefined}
          >
            {t(`mode.${item}`)}
          </Link>
        ))}
      </nav>

      <div className="topbar__status">
        <LanguageSwitch />
        <ApiStatus source={source} />
      </div>
    </header>
  );
}
