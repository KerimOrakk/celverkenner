import { Component } from 'react';
import { reportError } from '../analytics.js';
import { LanguageContextConsumer } from '../i18n/index.jsx';

/** Catches a crash anywhere in the page and shows a way out instead of a blank screen. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportError(error, { componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <LanguageContextConsumer>
        {({ t }) => (
          <main className="experience__message" role="alert">
            <h1>{t('crash.title')}</h1>
            <p>{t('crash.text')}</p>
            <div className="home__actions">
              <button type="button" className="btn btn--primary btn--md" onClick={() => window.location.reload()}>
                {t('crash.reload')}
              </button>
              <a className="btn btn--outline btn--md" href="/">
                {t('nav.home')}
              </a>
            </div>
          </main>
        )}
      </LanguageContextConsumer>
    );
  }
}
