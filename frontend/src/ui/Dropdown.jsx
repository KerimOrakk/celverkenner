import { useEffect, useId, useRef, useState } from 'react';

/**
 * Accessible single-select dropdown.
 * options: [{ value, label, hint? }]
 */
export default function Dropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const openList = () => {
    setActiveIndex(Math.max(options.findIndex((option) => option.value === value), 0));
    setOpen(true);
  };

  const choose = (option) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (option.value !== value) onChange(option.value);
  };

  const onKeyDown = (event) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (options[activeIndex]) choose(options[activeIndex]);
    }
  };

  return (
    <div className="dropdown" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="dropdown__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${selected?.label ?? 'maak een keuze'}`}
        onClick={() => (open ? setOpen(false) : openList())}
      >
        <span className="dropdown__label">{label}</span>
        <span className="dropdown__value">{selected?.label ?? 'Kies…'}</span>
        <svg className="dropdown__chevron" viewBox="0 0 12 8" width="12" height="8" aria-hidden="true">
          <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <ul id={listId} className="dropdown__list" role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={`dropdown__option${index === activeIndex ? ' is-active' : ''}`}
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              <span>{option.label}</span>
              {option.hint && <span className="dropdown__hint">{option.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
