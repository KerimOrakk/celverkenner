import { useEffect, useState } from 'react';
import { api } from '../api.js';

let cached = null;

/** All clickable terms, as a map id -> { term, definition }. Loaded once. */
export function useGlossary() {
  const [glossary, setGlossary] = useState(cached ?? new Map());

  useEffect(() => {
    if (cached) return undefined;
    let cancelled = false;
    api
      .getGlossary()
      .then(({ data, source }) => {
        const map = new Map(data.map((term) => [term.id, term]));
        if (source === 'api') cached = map;
        if (!cancelled) setGlossary(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return glossary;
}
