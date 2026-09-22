import { useLang } from '../i18n/index.jsx';

export default function Spinner({ label }) {
  const { t } = useLang();
  return (
    <div className="spinner" role="status">
      <span className="spinner__cell" aria-hidden="true" />
      <span>{label ?? t('loading')}</span>
    </div>
  );
}
