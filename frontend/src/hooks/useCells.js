import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLang } from '../i18n/index.jsx';

/** The list of cells for the home page and the cell dropdown. Reloads when the language changes. */
export function useCells() {
  const { lang } = useLang();
  const [state, setState] = useState({ status: 'loading', cells: [], source: null });

  useEffect(() => {
    let cancelled = false;
    api
      .getCells()
      .then(({ data, source }) => !cancelled && setState({ status: 'ready', cells: data, source }))
      .catch(() => !cancelled && setState({ status: 'error', cells: [], source: null }));
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return state;
}
