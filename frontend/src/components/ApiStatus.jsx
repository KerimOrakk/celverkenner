import { API_URL, retryApi } from '../api.js';

/** Tells the user whether the data came from the FastAPI backend or from the offline copy. */
export default function ApiStatus({ source }) {
  if (!source) return null;
  if (source === 'api') {
    return (
      <span className="api-status api-status--ok" title={`Gegevens komen van ${API_URL}`}>
        <span className="api-status__dot" aria-hidden="true" />
        <span className="api-status__label">API verbonden</span>
      </span>
    );
  }
  return (
    <span className="api-status api-status--offline">
      <span className="api-status__dot" aria-hidden="true" />
      <span title={`Geen verbinding met ${API_URL}. Start de backend met: uvicorn main:app --reload`}>
        Offline gegevens
      </span>
      <button
        type="button"
        className="api-status__retry"
        onClick={() => {
          retryApi();
          window.location.reload();
        }}
      >
        Opnieuw verbinden
      </button>
    </span>
  );
}
