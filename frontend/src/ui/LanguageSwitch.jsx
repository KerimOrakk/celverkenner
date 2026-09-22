import { useLang, LANGUAGES } from '../i18n/index.jsx';

/** NL | EN. Changing it re-fetches the data in the other language. */
export default function LanguageSwitch() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      {LANGUAGES.map((language) => (
        <button
          key={language.code}
          type="button"
          className={`lang-switch__item${language.code === lang ? ' is-active' : ''}`}
          aria-pressed={language.code === lang}
          lang={language.code}
          title={language.name}
          onClick={() => setLang(language.code)}
        >
          {language.label}
        </button>
      ))}
    </div>
  );
}
