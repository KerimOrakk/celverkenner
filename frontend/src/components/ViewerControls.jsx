import Button from '../ui/Button.jsx';
import { useLang } from '../i18n/index.jsx';

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
  labels,
  onLabels,
}) {
  const { t } = useLang();
  return (
    <div className="viewer-controls" role="toolbar" aria-label={t('controls.aria')}>
      <Switch checked={autoRotate} onChange={onAutoRotate}>
        {t('controls.autorotate')}
      </Switch>

      {onLabels && (
        <Switch checked={labels} onChange={onLabels}>
          {t('controls.labels')}
        </Switch>
      )}

      {mode === 'viewer' && (
        <Button variant="outline" size="sm" onClick={onToggleOpen} aria-pressed={isOpen}>
          {isOpen ? t('controls.close') : t('controls.open')}
        </Button>
      )}

      {mode === 'intracellular' && (
        <Button variant="outline" size="sm" onClick={onTour}>
          {tourActive ? t('controls.tour.next') : t('controls.tour.start')}
        </Button>
      )}

      <Button variant="quiet" size="sm" onClick={onReset}>
        {t('controls.reset')}
      </Button>
    </div>
  );
}
