import { useEffect, useState } from 'react';
import { api } from '../api.js';

/** The list of cells for the home page and the cell dropdown. */
export function useCells() {
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
  }, []);

  return state;
}
