import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ApiStatus from '../components/ApiStatus.jsx';
import CellViewer from '../components/CellViewer.jsx';
import { useCellData } from '../hooks/useCellData.js';
import { useCells } from '../hooks/useCells.js';
import { useLang } from '../i18n/index.jsx';
import Button from '../ui/Button.jsx';
import LanguageSwitch from '../ui/LanguageSwitch.jsx';
import Spinner from '../ui/Spinner.jsx';

const REMEMBER_KEY = 'celverkenner:laatste-cel';

function rememberedCell() {
  try {
    return window.sessionStorage.getItem(REMEMBER_KEY);
  } catch {
    return null;
  }
}

/** Home page: choose a cell. The chosen cell is already turning on the right. */
export default function HomePage() {
  const { t } = useLang();
  const { status, cells, source } = useCells();
  const [chosenId, setChosenId] = useState(rememberedCell);

  const chosen = cells.find((cell) => cell.id === chosenId) ?? cells[0] ?? null;
  const preview = useCellData(chosen?.id);

  useEffect(() => {
    document.title = t('home.docTitle');
  }, [t]);

  const choose = (cellId) => {
    setChosenId(cellId);
    try {
      window.sessionStorage.setItem(REMEMBER_KEY, cellId);
    } catch {
      // Private mode: not being able to remember the choice is fine.
    }
  };

  return (
    <div className="home">
      <div className="home__content">
        <div className="home__top">
          <p className="brand">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            {t('app.name')}
          </p>
          <LanguageSwitch />
        </div>

        <h1 className="home__title">{t('home.title')}</h1>
        <p className="home__lead">{t('home.lead')}</p>

        {status === 'loading' && <Spinner label={t('home.loading')} />}
        {status === 'error' && (
          <p className="home__error" role="alert">
            {t('home.error')}
          </p>
        )}

        {cells.length > 0 && (
          <fieldset className="cell-choice">
            <legend className="visually-hidden">{t('home.legend')}</legend>
            {cells.map((cell) => {
              const checked = cell.id === chosen?.id;
              return (
                <label key={cell.id} className={`cell-option${checked ? ' is-checked' : ''}`}>
                  <input
                    type="radio"
                    name="cel"
                    value={cell.id}
                    checked={checked}
                    onChange={() => choose(cell.id)}
                    className="visually-hidden"
                  />
                  <span className="cell-option__radio" aria-hidden="true" />
                  <span className="cell-option__text">
                    <span className="cell-option__name">{cell.name}</span>
                    <span className="cell-option__tagline">{cell.tagline}</span>
                  </span>
                  <span className="cell-option__type">{cell.type_label}</span>
                </label>
              );
            })}
          </fieldset>
        )}

        {chosen && (
          <>
            <p className="home__description" key={chosen.id}>
              {chosen.description}
            </p>
            <div className="home__actions">
              <Button to={`/viewer/${chosen.id}`}>{t('home.view3d', { name: chosen.name.toLowerCase() })}</Button>
              <Button to={`/intracellulair/${chosen.id}`} variant="outline">
                {t('home.enter')}
              </Button>
            </div>
            <nav className="home__links" aria-label={t('home.more')}>
              <Link to={`/proces/${chosen.id}`}>{t('home.processes')}</Link>
              <Link to="/vergelijk">{t('home.compare')}</Link>
              <Link to="/begrippen">{t('home.glossary')}</Link>
              <Link to="/quiz" className="home__links-quiz">{t('home.quiz')}</Link>
            </nav>
          </>
        )}

        <div className="home__status">
          <ApiStatus source={source} />
        </div>
      </div>

      <div className="home__preview" aria-hidden="true">
        {preview.status === 'ready' && (
          <CellViewer cell={preview.cell} definitions={preview.definitions} mode="preview" autoRotate open />
        )}
      </div>
    </div>
  );
}
