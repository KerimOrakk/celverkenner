import Button from '../ui/Button.jsx';

function Switch({ checked, onChange, children }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      {children}
    </button>
  );
}

/** The buttons that float over the 3D stage. */
export default function ViewerControls({
  mode,
  autoRotate,
  onAutoRotate,
  isOpen,
  onToggleOpen,
  onReset,
  onTour,
  tourActive,
}) {
  return (
    <div className="viewer-controls" role="toolbar" aria-label="Bediening van de 3D-weergave">
      <Switch checked={autoRotate} onChange={onAutoRotate}>
        Auto-rotatie
      </Switch>

      {mode === 'viewer' && (
        <Button variant="outline" size="sm" onClick={onToggleOpen} aria-pressed={isOpen}>
          {isOpen ? 'Cel sluiten' : 'Cel openen'}
        </Button>
      )}

      {mode === 'intracellular' && (
        <Button variant="outline" size="sm" onClick={onTour}>
          {tourActive ? 'Volgend organel' : 'Rondleiding starten'}
        </Button>
      )}

      <Button variant="quiet" size="sm" onClick={onReset}>
        Beginstand
      </Button>
    </div>
  );
}
