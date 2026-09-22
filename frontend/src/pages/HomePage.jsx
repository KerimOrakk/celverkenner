import { useEffect, useState } from 'react';
import ApiStatus from '../components/ApiStatus.jsx';
import CellViewer from '../components/CellViewer.jsx';
import { useCellData } from '../hooks/useCellData.js';
import { useCells } from '../hooks/useCells.js';
import Button from '../ui/Button.jsx';
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
  const { status, cells, source } = useCells();
  const [chosenId, setChosenId] = useState(rememberedCell);

  const chosen = cells.find((cell) => cell.id === chosenId) ?? cells[0] ?? null;
  const preview = useCellData(chosen?.id);

  useEffect(() => {
    document.title = 'CelVerkenner 3D | Kies een cel';
  }, []);

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
        <p className="brand">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          CelVerkenner 3D
        </p>

        <h1 className="home__title">Kies een cel en kijk erin.</h1>
        <p className="home__lead">
          Draai de cel rond, open het membraan en klik op een organel om te lezen wat het doet. Of stap zelf het
          cytoplasma in.
        </p>

        {status === 'loading' && <Spinner label="Cellen laden…" />}
        {status === 'error' && (
          <p className="home__error" role="alert">
            De lijst met cellen kon niet worden geladen. Herlaad de pagina om het opnieuw te proberen.
          </p>
        )}

        {cells.length > 0 && (
          <fieldset className="cell-choice">
            <legend className="visually-hidden">Welke cel wil je bekijken?</legend>
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
              <Button to={`/viewer/${chosen.id}`}>Bekijk de {chosen.name.toLowerCase()} in 3D</Button>
              <Button to={`/intracellulair/${chosen.id}`} variant="outline">
                Ga de cel in
              </Button>
            </div>
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
