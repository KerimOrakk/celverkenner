import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useLang } from '../i18n/index.jsx';

const cache = new Map(); // lang -> Map(id -> term)

/** All clickable terms, as a map id -> { term, definition }, in the current language. */
export function useGlossary() {
  const { lang } = useLang();
  const [glossary, setGlossary] = useState(() => cache.get(lang) ?? new Map());

  useEffect(() => {
    if (cache.has(lang)) {
      setGlossary(cache.get(lang));
      return undefined;
    }
    let cancelled = false;
    api
      .getGlossary()
      .then(({ data, source }) => {
        const map = new Map(data.map((term) => [term.id, term]));
        if (source === 'api') cache.set(lang, map);
        if (!cancelled) setGlossary(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return glossary;
}
