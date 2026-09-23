import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import SiteHeader from '../components/SiteHeader.jsx';
import { useCells } from '../hooks/useCells.js';
import { useFetch } from '../hooks/useFetch.js';
import { useLang } from '../i18n/index.jsx';
import Spinner from '../ui/Spinner.jsx';

const TERM_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
const collator = new Intl.Collator(['nl', 'en'], { sensitivity: 'base' });
const normalise = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Every term from the explanations, alphabetically, with a search box. */
export default function GlossaryPage() {
  const { t } = useLang();
  const { cells, source } = useCells();
  const glossary = useFetch(() => api.getGlossary(), []);
  const explanations = useFetch(() => api.getExplanations(null), []);
  const organelles = useFetch(() => api.getOrganelles(null), []);
  const [query, setQuery] = useState('');

  useEffect(() => {
    document.title = t('title.glossary');
  }, [t]);

  // Which organelles mention which term: scan the long explanations for [[id]].
  const usage = useMemo(() => {
    const map = new Map();
    for (const explanation of explanations.data ?? []) {
      const ids = new Set([...(explanation.details ?? '').matchAll(TERM_PATTERN)].map((m) => m[1]));
      ids.forEach((id) => {
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(explanation.organelle_id);
      });
    }
    return map;
  }, [explanations.data]);

  const organelleById = useMemo(
    () => new Map((organelles.data ?? []).map((organelle) => [organelle.id, organelle])),
    [organelles.data],
  );

  // A viewer link for an organelle: the first cell it occurs in.
  const cellFor = (organelleId) => {
    const definition = organelleById.get(organelleId);
    if (!definition) return null;
    if (organelleId === 'microvilli') return cells.find((cell) => cell.id === 'darmcel') ?? null;
    const type = ['dierlijk', 'plantaardig', 'prokaryoot'].find((candidate) => definition.cell_types.includes(candidate));
    return cells.find((cell) => cell.type === type) ?? null;
  };

  const terms = useMemo(() => {
    const all = [...(glossary.data ?? [])].sort((a, b) => collator.compare(a.term, b.term));
    const q = normalise(query.trim());
    if (!q) return all;
    return all.filter((term) => normalise(term.term).includes(q) || normalise(term.definition).includes(q));
  }, [glossary.data, query]);

  // Group by first letter for the alphabet headings.
  const groups = useMemo(() => {
    const byLetter = new Map();
    for (const term of terms) {
      const letter = normalise(term.term[0]).toUpperCase();
      if (!byLetter.has(letter)) byLetter.set(letter, []);
      byLetter.get(letter).push(term);
    }
    return [...byLetter.entries()];
  }, [terms]);

  return (
    <div className="page">
      <SiteHeader source={source} />
      <main className="page__main glossary">
        <div className="page__intro">
          <h1 className="page__title">{t('glossary.title')}</h1>
          <p className="page__lead">{t('glossary.lead', { n: glossary.data?.length ?? 0 })}</p>
        </div>

        <div className="glossary__search">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m13 13 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('glossary.search')}
            aria-label={t('glossary.search')}
          />
          <span className="glossary__count">{t('glossary.count', { n: terms.length })}</span>
        </div>

        {glossary.status === 'loading' && <Spinner label={t('glossary.loading')} />}
        {glossary.status === 'ready' && terms.length === 0 && (
          <p className="glossary__empty">{t('glossary.empty', { q: query.trim() })}</p>
        )}

        {groups.map(([letter, items]) => (
          <section key={letter} className="glossary__group">
            <h2 className="glossary__letter" aria-label={letter}>
              {letter}
            </h2>
            <dl className="glossary__list">
              {items.map((term) => {
                const used = usage.get(term.id) ?? [];
                return (
                  <div key={term.id} className="glossary__item" id={`begrip-${term.id}`}>
                    <dt>{term.term}</dt>
                    <dd>
                      <p>{term.definition}</p>
                      {used.length > 0 && (
                        <p className="glossary__usage">
                          <span>{t('glossary.usedIn')}</span>
                          {used.map((organelleId) => {
                            const cell = cellFor(organelleId);
                            const name = organelleById.get(organelleId)?.name ?? organelleId;
                            return cell ? (
                              <Link key={organelleId} to={`/viewer/${cell.id}?organel=${organelleId}`} className="chip">
                                {name}
                              </Link>
                            ) : (
                              <span key={organelleId} className="chip">
                                {name}
                              </span>
                            );
                          })}
                        </p>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </main>
    </div>
  );
}
