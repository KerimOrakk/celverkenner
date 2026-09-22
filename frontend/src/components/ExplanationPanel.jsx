import { forwardRef, useRef } from 'react';
import Button from '../ui/Button.jsx';

function whereFound(cellTypes = []) {
  const animal = cellTypes.includes('dierlijk');
  const plant = cellTypes.includes('plantaardig');
  if (animal && plant) return 'Dierlijke cellen en plantencellen';
  if (animal) return 'Alleen dierlijke cellen';
  if (plant) return 'Alleen plantencellen';
  return 'Onbekend';
}

const formatNumber = (value) => String(Number(value.toFixed(2))).replace('.', ',');

/** Slides in when an organelle is selected. Stays mounted so it can slide out again. */
const ExplanationPanel = forwardRef(function ExplanationPanel(
  { organelle, count, onClose, onPrevious, onNext },
  ref,
) {
  const open = Boolean(organelle);
  // Keep showing the last organelle while the panel slides out.
  const lastShown = useRef(null);
  if (organelle) lastShown.current = { organelle, count };
  const shown = organelle ?? lastShown.current?.organelle;
  const shownCount = organelle ? count : lastShown.current?.count;

  return (
    <aside ref={ref} className={`panel${open ? ' is-open' : ''}`} aria-hidden={!open} aria-live="polite">
      {shown && (
        <div className="panel__inner" key={shown.id}>
          <header className="panel__header">
            <span className="panel__swatch" style={{ background: shown.color }} aria-hidden="true" />
            <h2 className="panel__title">{shown.name}</h2>
            <button type="button" className="panel__close" onClick={onClose} aria-label="Uitleg sluiten">
              <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <p className="panel__explanation">{shown.explanation}</p>

          <dl className="panel__facts">
            <div>
              <dt>In dit model</dt>
              <dd>{shownCount > 1 ? `${shownCount} stuks` : '1 stuk'}</dd>
            </div>
            <div>
              <dt>Komt voor in</dt>
              <dd>{whereFound(shown.cell_types)}</dd>
            </div>
            {shown.scale != null && (
              <div>
                <dt>Schaal</dt>
                <dd>{formatNumber(shown.scale)} (celmembraan = 1)</dd>
              </div>
            )}
          </dl>

          {(shown.positions.length > 0 || shown.random) && (
            <details className="panel__positions">
              <summary>Posities in de cel (x, y, z)</summary>
              <ul>
                {shown.positions.map((position, index) => (
                  <li key={index}>({position.map(formatNumber).join('; ')})</li>
                ))}
                {shown.random && (
                  <li>
                    plus {shown.random.count} willekeurig geplaatst binnen ±{formatNumber(shown.random.range)}
                  </li>
                )}
              </ul>
            </details>
          )}

          <footer className="panel__footer">
            <Button variant="quiet" size="sm" onClick={onPrevious}>
              Vorige
            </Button>
            <Button variant="quiet" size="sm" onClick={onNext}>
              Volgende
            </Button>
          </footer>
        </div>
      )}
    </aside>
  );
});

export default ExplanationPanel;
