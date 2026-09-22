import { useEffect, useState } from 'react';
import { useLang } from '../i18n/index.jsx';

/**
 * Small helper for the pages that just need one API call:
 * `useFetch(() => api.getComparison(), [])` -> { status, data, source }.
 * Re-runs when the language changes.
 */
export function useFetch(call, deps = []) {
  const { lang } = useLang();
  const [state, setState] = useState({ status: 'loading', data: null, source: null });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, status: 'loading' }));
    call()
      .then(({ data, source }) => !cancelled && setState({ status: 'ready', data, source }))
      .catch((error) => !cancelled && setState({ status: error.status === 404 ? 'not-found' : 'error', data: null, source: null }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, ...deps]);

  return state;
}
