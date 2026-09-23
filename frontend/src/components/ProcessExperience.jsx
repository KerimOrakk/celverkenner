import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCells } from '../hooks/useCells.js';
import { useCellData } from '../hooks/useCellData.js';
import { useFetch } from '../hooks/useFetch.js';
import { useGlossary } from '../hooks/useGlossary.js';
import { useLang } from '../i18n/index.jsx';
import { track } from '../analytics.js';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import CellViewer from './CellViewer.jsx';
import RichText from './RichText.jsx';
import TopBar from './TopBar.jsx';

const NARROW_QUERY = '(max-width: 820px)';
const AUTOPLAY_MS = 7000;

/**
 * "Processen": a process is a list of steps, each tied to an organelle. The
 * camera flies from step to step and a glowing route is drawn between them.
 */
export default function ProcessExperience({ cellId }) {
  const { t } = useLang();
  const { cells } = useCells();
  const data = useCellData(cellId);
  const glossary = useGlossary();
  const processes = useFetch(() => api.getProcesses(cellId), [cellId]);
  const [searchParams, setSearchParams] = useSearchParams();
  const viewerRef = useRef(null);
  const panelRef = useRef(null);

  const list = processes.status === 'ready' ? processes.data : [];
  const wantedId = searchParams.get('p');
  const process = list.find((item) => item.id === wantedId) ?? list[0] ?? null;

  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [insets, setInsets] = useState({ right: 0, bottom: 0 });
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // New process (or cell): back to step one.
  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
    if (process?.id) track('proces-gestart', { proces: process.id, cel: cellId });
  }, [process?.id, cellId]);

  useEffect(() => {
    if (data.status === 'ready') document.title = t('title.process', { cell: data.cell.name });
  }, [data, t]);

  const steps = process?.steps ?? [];
  const step = steps[stepIndex] ?? null;
  const route = useMemo(() => steps.slice(0, stepIndex + 1).map((item) => item.organelle_id), [steps, stepIndex]);
  const organelleName = (id) => data.organelles?.find((organelle) => organelle.id === id)?.name ?? id;

  const choose = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('p', id);
    setSearchParams(next, { replace: true });
  };

  const go = useCallback(
    (delta) => setStepIndex((index) => Math.max(0, Math.min(steps.length - 1, index + delta))),
    [steps.length],
  );

  // Autoplay: advance every few seconds, stop at the end.
  useEffect(() => {
    if (!playing) return undefined;
    if (stepIndex >= steps.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = setTimeout(() => go(1), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [playing, stepIndex, steps.length, go]);

  // Arrow keys walk through the steps.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.target.closest?.('input, textarea, .dropdown')) return;
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [go]);

  // The step card covers part of the stage: keep the organelle in the free part.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!step || !panel) {
      setInsets({ right: 0, bottom: 0 });
      return undefined;
    }
    const measure = () =>
      setInsets(narrow ? { right: 0, bottom: panel.offsetHeight } : { right: panel.offsetWidth + 16, bottom: 0 });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [step, narrow]);

  if (data.status === 'not-found' || data.status === 'error') {
    const notFound = data.status === 'not-found';
    return (
      <div className="experience">
        <TopBar cells={cells} cellId={cellId} mode="process" source={null} />
        <main className="experience__message">
          <h1>{notFound ? t('error.notFound.title') : t('error.load.title')}</h1>
          <p>{notFound ? t('error.notFound.text', { id: cellId }) : t('error.load.text')}</p>
          <Button to="/">{t('error.back')}</Button>
        </main>
      </div>
    );
  }

  const ready = data.status === 'ready';
  const isLast = stepIndex >= steps.length - 1;

  return (
    <div className="experience experience--process">
      <TopBar cells={cells} cellId={cellId} mode="process" source={ready ? data.source : null} />

      <div className="experience__body">
        <aside className="experience__sidebar">
          <div className="cell-heading">
            <h1 className="cell-heading__name">{ready ? data.cell.name : t('cell.loading')}</h1>
            <p className="cell-heading__tagline">{t('process.title')}</p>
          </div>

          <nav className="process-nav" aria-label={t('process.pick')}>
            <h2 className="organelle-nav__title">{t('process.pick')}</h2>
            {processes.status === 'loading' && <Spinner label={t('process.loading')} />}
            {processes.status === 'ready' && list.length === 0 && <p className="process-nav__empty">{t('process.none')}</p>}
            <ul className="organelle-nav__list">
              {list.map((item) => {
                const active = item.id === process?.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`process-btn${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => choose(item.id)}
                    >
                      <span className="process-btn__name">{item.name}</span>
                      <span className="process-btn__summary">{item.summary}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="stage">
          {ready ? (
            <CellViewer
              ref={viewerRef}
              cell={data.cell}
              definitions={data.definitions}
              mode="viewer"
              selectedId={step?.organelle_id ?? null}
              autoRotate
              open
              route={route}
              insetRight={insets.right}
              insetBottom={insets.bottom}
              onSelect={() => {}}
            />
          ) : (
            <Spinner label={t('stage.building')} />
          )}

          {ready && step && (
            <aside ref={panelRef} className="panel is-open process-panel" aria-live="polite">
              <div className="panel__inner" key={`${process.id}-${stepIndex}`}>
                <header className="process-panel__header">
                  <p className="process-panel__eyebrow">{process.name}</p>
                  <ol className="process-steps" aria-label={t('process.stepsAria')}>
                    {steps.map((item, index) => (
                      <li key={index}>
                        <button
                          type="button"
                          className={`process-steps__dot${index === stepIndex ? ' is-current' : ''}${index < stepIndex ? ' is-done' : ''}`}
                          aria-current={index === stepIndex ? 'step' : undefined}
                          aria-label={`${index + 1}. ${item.title}`}
                          onClick={() => setStepIndex(index)}
                        />
                      </li>
                    ))}
                  </ol>
                </header>

                <p className="process-panel__count">
                  {t('process.step', { i: stepIndex + 1, n: steps.length })} · {organelleName(step.organelle_id)}
                </p>
                <h2 className="panel__title">{step.title}</h2>
                <RichText text={step.text} glossary={glossary} />
                {isLast && <p className="process-panel__done">{t('process.done')}</p>}

                <footer className="panel__footer process-panel__footer">
                  <Button variant="quiet" size="sm" onClick={() => go(-1)} disabled={stepIndex === 0}>
                    {t('process.prev')}
                  </Button>
                  {isLast ? (
                    <Button variant="outline" size="sm" onClick={() => setStepIndex(0)}>
                      {t('process.restart')}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setPlaying((value) => !value)} aria-pressed={playing}>
                      {playing ? t('process.pause') : t('process.play')}
                    </Button>
                  )}
                  <Button variant="primary" size="sm" onClick={() => go(1)} disabled={isLast}>
                    {t('process.next')}
                  </Button>
                </footer>
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}
