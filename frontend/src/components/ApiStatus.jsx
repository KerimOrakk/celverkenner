import { API_URL, retryApi } from '../api.js';
import { useLang } from '../i18n/index.jsx';

/** Tells the user whether the data came from the FastAPI backend or from the offline copy. */
export default function ApiStatus({ source }) {
  const { t } = useLang();
  if (!source) return null;
  if (source === 'api') {
    return (
      <span className="api-status api-status--ok" title={t('api.from', { url: API_URL })}>
        <span className="api-status__dot" aria-hidden="true" />
        <span className="api-status__label">{t('api.connected')}</span>
      </span>
    );
  }
  return (
    <span className="api-status api-status--offline">
      <span className="api-status__dot" aria-hidden="true" />
      <span title={t('api.noConnection', { url: API_URL })}>{t('api.offline')}</span>
      <button
        type="button"
        className="api-status__retry"
        onClick={() => {
          retryApi();
          window.location.reload();
        }}
      >
        {t('api.retry')}
      </button>
    </span>
  );
}
