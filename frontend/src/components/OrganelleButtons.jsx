import { useLang } from '../i18n/index.jsx';

/** The list of organelles. Pressing one highlights it in 3D and opens the explanation. */
export default function OrganelleButtons({ organelles, counts = {}, selectedId, onSelect }) {
  const { t } = useLang();
  return (
    <nav className="organelle-nav" aria-label={t('organelles.title')}>
      <h2 className="organelle-nav__title">{t('organelles.title')}</h2>
      <ul className="organelle-nav__list">
        {organelles.map((organelle) => {
          const count = counts[organelle.id];
          const active = organelle.id === selectedId;
          return (
            <li key={organelle.id}>
              <button
                type="button"
                className={`organelle-btn${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => onSelect(active ? null : organelle.id)}
              >
                <span className="organelle-btn__swatch" style={{ background: organelle.color }} aria-hidden="true" />
                <span className="organelle-btn__name">{organelle.name}</span>
                {count > 1 && <span className="organelle-btn__count">{count}×</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
