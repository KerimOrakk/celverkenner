import { Link, NavLink } from 'react-router-dom';
import LanguageSwitch from '../ui/LanguageSwitch.jsx';
import ApiStatus from './ApiStatus.jsx';
import { useLang } from '../i18n/index.jsx';

/** Header of the pages without a 3D stage of their own (comparison, glossary). */
export default function SiteHeader({ source }) {
  const { t } = useLang();
  return (
    <header className="topbar">
      <Link to="/" className="topbar__back">
        <svg viewBox="0 0 8 12" width="8" height="12" aria-hidden="true">
          <path d="M6.5 1 1.5 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {t('nav.home')}
      </Link>
      <nav className="mode-switch" aria-label={t('home.more')}>
        <NavLink to="/vergelijk" className={({ isActive }) => `mode-switch__item${isActive ? ' is-active' : ''}`}>
          {t('nav.compare')}
        </NavLink>
        <NavLink to="/begrippen" className={({ isActive }) => `mode-switch__item${isActive ? ' is-active' : ''}`}>
          {t('nav.glossary')}
        </NavLink>
      </nav>
      <div className="topbar__status">
        <LanguageSwitch />
        <ApiStatus source={source} />
      </div>
    </header>
  );
}
