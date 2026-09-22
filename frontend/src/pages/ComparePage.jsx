import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import CellViewer from '../components/CellViewer.jsx';
import SiteHeader from '../components/SiteHeader.jsx';
import { useCellData } from '../hooks/useCellData.js';
import { useCells } from '../hooks/useCells.js';
import { useFetch } from '../hooks/useFetch.js';
import { useLang } from '../i18n/index.jsx';
import Dropdown from '../ui/Dropdown.jsx';
import Spinner from '../ui/Spinner.jsx';

function Presence({ value, t }) {
  if (value == null) return null;
  return (
    <span className={`presence presence--${value ? 'yes' : 'no'}`} aria-label={value ? t('compare.yes') : t('compare.no')}>
      {value ? '✓' : '✗'}
    </span>
  );
}

/** Two cells turning side by side, and a table of what differs. */
export default function ComparePage() {
  const { t } = useLang();
  const { cells, source } = useCells();
  const comparison = useFetch(() => api.getComparison(), []);

  const animalCells = cells.filter((cell) => cell.type === 'dierlijk');
  const plantCell = cells.find((cell) => cell.type === 'plantaardig') ?? null;
  const [animalId, setAnimalId] = useState(null);
  const animalCell = animalCells.find((cell) => cell.id === animalId) ?? animalCells[0] ?? null;

  const animal = useCellData(animalCell?.id);
  const plant = useCellData(plantCell?.id);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    document.title = t('title.compare');
  }, [t]);

  const rows = comparison.status === 'ready' ? comparison.data : [];
  const selected = useMemo(() => rows.find((row) => row.id === selectedRow) ?? null, [rows, selectedRow]);
  const highlight = (data, organelleId) =>
    organelleId && data.status === 'ready' && data.organelles.some((o) => o.id === organelleId) ? organelleId : null;

  // Link to the viewer with that organelle already open. The chosen animal cell
  // may not have it (microvilli only sit on the gut cell): pick one that does.
  const linkFor = (row, cell) => {
    if (!row.organelle_id || !cell) return null;
    let target = cell;
    if (cell.type === 'dierlijk' && animal.status === 'ready' && !animal.organelles.some((o) => o.id === row.organelle_id)) {
      target = animalCells.find((candidate) => candidate.id !== cell.id) ?? cell;
    }
    return `/viewer/${target.id}?organel=${row.organelle_id}`;
  };

  return (
    <div className="page">
      <SiteHeader source={source} />
      <main className="page__main compare">
        <div className="page__intro">
          <h1 className="page__title">{t('compare.title')}</h1>
          <p className="page__lead">{t('compare.lead')}</p>
        </div>

        <div className="compare__stages">
          <section className="compare__stage" aria-label={t('compare.animal')}>
            <header className="compare__stage-head">
              <h2>{t('compare.animal')}</h2>
              {animalCells.length > 1 && (
                <Dropdown
                  label={t('compare.pick')}
                  options={animalCells.map((cell) => ({ value: cell.id, label: cell.name }))}
                  value={animalCell?.id}
                  onChange={setAnimalId}
                />
              )}
            </header>
            <div className="compare__canvas">
              {animal.status === 'ready' ? (
                <CellViewer
                  cell={animal.cell}
                  definitions={animal.definitions}
                  mode="preview"
                  autoRotate
                  open
                  flyOnSelect={false}
                  selectedId={highlight(animal, selected?.organelle_id)}
                />
              ) : (
                <Spinner label={t('stage.building')} />
              )}
            </div>
          </section>

          <section className="compare__stage" aria-label={t('compare.plant')}>
            <header className="compare__stage-head">
              <h2>{t('compare.plant')}</h2>
            </header>
            <div className="compare__canvas">
              {plant.status === 'ready' ? (
                <CellViewer
                  cell={plant.cell}
                  definitions={plant.definitions}
                  mode="preview"
                  autoRotate
                  open
                  flyOnSelect={false}
                  selectedId={highlight(plant, selected?.organelle_id)}
                />
              ) : (
                <Spinner label={t('stage.building')} />
              )}
            </div>
          </section>
        </div>

        {comparison.status === 'loading' && <Spinner label={t('compare.loading')} />}
        {rows.length > 0 && (
          <div className="compare__table-wrap">
            <table className="compare__table">
              <thead>
                <tr>
                  <th scope="col">{t('compare.feature')}</th>
                  <th scope="col">{t('compare.animal')}</th>
                  <th scope="col">{t('compare.plant')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const active = row.id === selectedRow;
                  const clickable = Boolean(row.organelle_id);
                  return (
                    <tr
                      key={row.id}
                      className={`${clickable ? 'is-clickable' : ''}${active ? ' is-active' : ''}`}
                      onClick={clickable ? () => setSelectedRow(active ? null : row.id) : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onKeyDown={
                        clickable
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedRow(active ? null : row.id);
                              }
                            }
                          : undefined
                      }
                      aria-pressed={clickable ? active : undefined}
                    >
                      <th scope="row">{row.label}</th>
                      <td>
                        <Presence value={row.animal} t={t} />
                        <span>{row.animal_text}</span>
                        {linkFor(row, animalCell) && row.animal !== false && (
                          <Link className="compare__link" to={linkFor(row, animalCell)} onClick={(e) => e.stopPropagation()}>
                            {t('compare.view')}
                          </Link>
                        )}
                      </td>
                      <td>
                        <Presence value={row.plant} t={t} />
                        <span>{row.plant_text}</span>
                        {linkFor(row, plantCell) && row.plant !== false && (
                          <Link className="compare__link" to={linkFor(row, plantCell)} onClick={(e) => e.stopPropagation()}>
                            {t('compare.view')}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
