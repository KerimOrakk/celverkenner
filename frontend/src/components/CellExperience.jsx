import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useCells } from '../hooks/useCells.js';
import { useCellData } from '../hooks/useCellData.js';
import Button from '../ui/Button.jsx';
import Spinner from '../ui/Spinner.jsx';
import CellViewer from './CellViewer.jsx';
import ExplanationPanel from './ExplanationPanel.jsx';
import OrganelleButtons from './OrganelleButtons.jsx';
import TopBar from './TopBar.jsx';
import ViewerControls from './ViewerControls.jsx';

const NARROW_QUERY = '(max-width: 820px)';
const SHELLS = ['celmembraan', 'celwand'];

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/**
 * Everything both 3D pages share: top bar, organelle buttons, the stage and
 * the explanation panel. `mode` is "viewer" (from outside) or "intracellular"
 * (from inside the cytoplasm).
 */
export default function CellExperience({ cellId, mode }) {
  const { cells } = useCells();
  const fresh = useCellData(cellId);
  // While the next cell is loading, keep the current one on stage instead of tearing down WebGL.
  const lastReady = useRef(null);
  if (fresh.status === 'ready') lastReady.current = fresh;
  const loading = fresh.status === 'loading';
  const data = loading && lastReady.current ? lastReady.current : fresh;
  const viewerRef = useRef(null);
  const panelRef = useRef(null);
  const narrow = useMediaQuery(NARROW_QUERY);

  const [selectedId, setSelectedId] = useState(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  // Counts come from the 3D model once it is built; they are tagged with the
  // cell they belong to so a stale set is never shown for another cell.
  const [countState, setCountState] = useState({ cellId: null, values: {} });
  const counts = countState.cellId === cellId ? countState.values : {};
  const [insets, setInsets] = useState({ right: 0, bottom: 0 });

  const organelles = data.status === 'ready' ? data.organelles : [];
  const selected = useMemo(
    () => organelles.find((organelle) => organelle.id === selectedId) ?? null,
    [organelles, selectedId],
  );

  // A different cell or mode starts with a clean slate.
  useEffect(() => {
    setSelectedId(null);
  }, [cellId, mode]);

  useEffect(() => {
    const cellName = data.status === 'ready' ? data.cell.name : 'Cel';
    document.title = `${cellName} ${mode === 'intracellular' ? 'van binnenuit' : 'in 3D'} | CelVerkenner 3D`;
  }, [data, mode]);

  const step = useCallback(
    (direction) => {
      if (organelles.length === 0) return;
      setSelectedId((current) => {
        const index = organelles.findIndex((organelle) => organelle.id === current);
        const next = index === -1 ? 0 : (index + direction + organelles.length) % organelles.length;
        return organelles[next].id;
      });
    },
    [organelles],
  );

  // The tour inside the cell skips the shells: you are already standing in them.
  const tourStep = useCallback(() => {
    const stops = organelles.filter((organelle) => !SHELLS.includes(organelle.id));
    if (stops.length === 0) return;
    setSelectedId((current) => {
      const index = stops.findIndex((organelle) => organelle.id === current);
      return stops[(index + 1) % stops.length].id;
    });
  }, [organelles]);

  // Esc closes the explanation, arrow keys walk through the organelles.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.closest?.('.dropdown, input, textarea, select')) return;
      if (event.key === 'Escape' && selectedId) setSelectedId(null);
      else if (selectedId && event.key === 'ArrowRight') step(1);
      else if (selectedId && event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, step]);

  // The panel covers part of the stage; tell the 3D camera how much.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!selected || !panel) {
      setInsets({ right: 0, bottom: 0 });
      return;
    }
    setInsets(narrow ? { right: 0, bottom: panel.offsetHeight } : { right: panel.offsetWidth + 16, bottom: 0 });
  }, [selected, narrow]);

  if (data.status === 'not-found' || data.status === 'error') {
    const notFound = data.status === 'not-found';
    return (
      <div className="experience">
        <TopBar cells={cells} cellId={cellId} mode={mode} source={null} />
        <main className="experience__message">
          <h1>{notFound ? 'Deze cel bestaat niet' : 'De celgegevens konden niet worden geladen'}</h1>
          <p>
            {notFound
              ? `Er is geen cel met de naam "${cellId}". Kies een cel uit de lijst.`
              : 'Controleer of de backend draait (uvicorn main:app --reload) en probeer het opnieuw.'}
          </p>
          <Button to="/">Terug naar de celkeuze</Button>
        </main>
      </div>
    );
  }

  const ready = data.status === 'ready';

  return (
    <div className={`experience experience--${mode}`}>
      <TopBar cells={cells} cellId={cellId} mode={mode} source={ready ? data.source : null} />

      <div className="experience__body">
        <aside className="experience__sidebar">
          <div className="cell-heading">
            <h1 className="cell-heading__name">{ready ? data.cell.name : 'Cel laden'}</h1>
            {ready && (
              <p className="cell-heading__tagline">
                {mode === 'intracellular' ? 'Je staat nu midden in het cytoplasma.' : data.cell.tagline}
              </p>
            )}
          </div>
          {ready && (
            <OrganelleButtons organelles={organelles} counts={counts} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </aside>

        <main className="stage">
          {ready ? (
            <CellViewer
              ref={viewerRef}
              cell={data.cell}
              definitions={data.definitions}
              mode={mode}
              selectedId={selectedId}
              autoRotate={autoRotate}
              open={isOpen}
              insetRight={insets.right}
              insetBottom={insets.bottom}
              onSelect={setSelectedId}
              onCounts={(values) => setCountState({ cellId: data.cell.id, values })}
            />
          ) : (
            <Spinner label="Cel wordt opgebouwd…" />
          )}
          {ready && loading && <Spinner label="Volgende cel laden…" />}

          {ready && !selected && (
            <p className="stage__hint">
              {mode === 'intracellular'
                ? 'Sleep om rond te kijken, zoom om dichterbij te komen, klik op een organel voor uitleg.'
                : 'Sleep om te draaien, scrol of knijp om te zoomen, klik op een organel voor uitleg.'}
            </p>
          )}

          {ready && (
            <ViewerControls
              mode={mode}
              autoRotate={autoRotate}
              onAutoRotate={setAutoRotate}
              isOpen={isOpen}
              onToggleOpen={() => setIsOpen((value) => !value)}
              onReset={() => {
                setSelectedId(null);
                viewerRef.current?.resetCamera();
              }}
              onTour={tourStep}
              tourActive={Boolean(selected)}
            />
          )}

          <ExplanationPanel
            ref={panelRef}
            organelle={selected}
            count={selected ? counts[selected.id] ?? 1 : undefined}
            onClose={() => setSelectedId(null)}
            onPrevious={() => step(-1)}
            onNext={() => step(1)}
          />
        </main>
      </div>
    </div>
  );
}
