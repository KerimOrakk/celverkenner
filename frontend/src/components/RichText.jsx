import { useEffect, useRef, useState } from 'react';

const TERM_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

/** Split "text with [[id|label]] terms" into plain strings and term tokens. */
export function parseTerms(text) {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(TERM_PATTERN)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push({ id: match[1], label: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** "Cellulose" -> "cellulose" mid-sentence, but "DNA", "mRNA" and "ATP" stay as they are. */
const inSentence = (term) => (/^[A-Z][a-z]/.test(term) ? term[0].toLowerCase() + term.slice(1) : term);

/**
 * A paragraph in which glossary terms are buttons. Press one and its
 * definition pops up in a card right under the paragraph; Esc, a click
 * elsewhere, the ✕ or pressing the same word again closes it.
 */
export default function RichText({ text, glossary }) {
  const rootRef = useRef(null);
  const [openId, setOpenId] = useState(null);

  // Forget the open definition when the text changes (next organelle).
  useEffect(() => setOpenId(null), [text]);

  useEffect(() => {
    if (!openId) return undefined;
    const onKey = (event) => event.key === 'Escape' && setOpenId(null);
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [openId]);

  const toggle = (id) => setOpenId((current) => (current === id ? null : id));

  const parts = parseTerms(text);
  const active = openId ? glossary.get(openId) : null;

  return (
    <div className="richtext" ref={rootRef}>
      <p>
        {parts.map((part, index) => {
          if (typeof part === 'string') return part;
          const entry = glossary.get(part.id);
          const label = part.label || (entry ? inSentence(entry.term) : part.id);
          if (!entry) return label;
          const isOpen = openId === part.id;
          return (
            <button
              key={index}
              type="button"
              className={`term${isOpen ? ' is-open' : ''}`}
              aria-expanded={isOpen}
              aria-controls={isOpen ? 'term-popover' : undefined}
              onClick={() => toggle(part.id)}
            >
              {label}
            </button>
          );
        })}
      </p>

      {active && (
        <div id="term-popover" role="note" aria-label={active.term} className="term-popover" key={active.id}>
          <strong className="term-popover__title">{active.term}</strong>
          <button type="button" className="term-popover__close" onClick={() => setOpenId(null)} aria-label="Sluiten">
            <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden="true">
              <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <p className="term-popover__text">{active.definition}</p>
        </div>
      )}
    </div>
  );
}
