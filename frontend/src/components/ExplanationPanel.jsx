import { forwardRef, useRef, useState } from 'react';
import Button from '../ui/Button.jsx';
import RichText from './RichText.jsx';
import { useLang } from '../i18n/index.jsx';

const CELL_TYPES = ['dierlijk', 'plantaardig', 'prokaryoot'];

function whereFound(cellTypes = [], t) {
  const present = CELL_TYPES.filter((type) => cellTypes.includes(type));
  if (present.length === 0) return t('found.unknown');
  if (present.length === CELL_TYPES.length) return t('found.all');
  const names = present.map((type) => t(`type.${type}`));
  return names.length === 1
    ? t('found.only', { list: names[0] })
    : t('found.list', { list: `${names.slice(0, -1).join(', ')} ${t('found.and')} ${names[names.length - 1]}` });
}

const formatNumber = (value) => String(Number(value.toFixed(2))).replace('.', ',');

/** Slides in when an organelle is selected. Stays mounted so it can slide out again. */
const ExplanationPanel = forwardRef(function ExplanationPanel(
  { organelle, count, glossary, onClose, onPrevious, onNext },
  ref,
) {
  const { t } = useLang();
  const open = Boolean(organelle);
  // "Meer uitleg" stays open while you walk through the organelles.
  const [expanded, setExpanded] = useState(false);
  // Keep showing the last organelle while the panel slides out.
  const lastShown = useRef(null);
  if (organelle) lastShown.current = { organelle, count };
  const shown = organelle ?? lastShown.current?.organelle;
  const shownCount = organelle ? count : lastShown.current?.count;

  return (
    <aside
      ref={ref}
      className={`panel${open ? ' is-open' : ''}${expanded ? ' is-expanded' : ''}`}
      aria-hidden={!open}
      aria-live="polite"
    >
      {shown && (
        <div className="panel__inner" key={shown.id}>
          <header className="panel__header">
            <span className="panel__swatch" style={{ background: shown.color }} aria-hidden="true" />
            <h2 className="panel__title">{shown.name}</h2>
            <button type="button" className="panel__close" onClick={onClose} aria-label={t('panel.close')}>
              <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <p className="panel__explanation">{shown.explanation}</p>

          {shown.details && (
            <div className="panel__more">
              <button
                type="button"
                className="panel__more-toggle"
                aria-expanded={expanded}
                aria-controls="panel-details"
                onClick={() => setExpanded((value) => !value)}
              >
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                {expanded ? t('panel.less') : t('panel.more')}
              </button>
              {expanded && (
                <div id="panel-details" className="panel__details">
                  <RichText text={shown.details} glossary={glossary} />
                  <p className="panel__details-hint">{t('panel.termHint')}</p>
                </div>
              )}
            </div>
          )}

          <dl className="panel__facts">
            <div>
              <dt>{t('panel.inModel')}</dt>
              <dd>{shownCount > 1 ? t('panel.many', { n: shownCount }) : t('panel.one')}</dd>
            </div>
            <div>
              <dt>{t('panel.foundIn')}</dt>
              <dd>{whereFound(shown.cell_types, t)}</dd>
            </div>
            {shown.scale != null && (
              <div>
                <dt>{t('panel.scale')}</dt>
                <dd>{formatNumber(shown.scale)} {t('panel.scaleNote')}</dd>
              </div>
            )}
          </dl>

          {(shown.positions.length > 0 || shown.random) && (
            <details className="panel__positions">
              <summary>{t('panel.positions')}</summary>
              <ul>
                {shown.positions.map((position, index) => (
                  <li key={index}>({position.map(formatNumber).join('; ')})</li>
                ))}
                {shown.random && (
                  <li>
                    {t('panel.random', { n: shown.random.count, r: formatNumber(shown.random.range) })}
                  </li>
                )}
              </ul>
            </details>
          )}

          <footer className="panel__footer">
            <Button variant="quiet" size="sm" onClick={onPrevious}>
              {t('panel.prev')}
            </Button>
            <Button variant="quiet" size="sm" onClick={onNext}>
              {t('panel.next')}
            </Button>
          </footer>
        </div>
      )}
    </aside>
  );
});

export default ExplanationPanel;
