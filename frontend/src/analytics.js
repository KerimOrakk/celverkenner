// Optional analytics and error reporting. Nothing loads unless the matching
// VITE_* variables are set at build time (see .env.example), so the app stays
// free of third-party scripts by default.
//
//   VITE_UMAMI_SRC    e.g. https://cloud.umami.is/script.js
//   VITE_UMAMI_ID     the website id from the Umami dashboard
//   VITE_SENTRY_LOADER the "Loader Script" URL from Sentry (js.sentry-cdn.com/...)

const UMAMI_SRC = import.meta.env.VITE_UMAMI_SRC;
const UMAMI_ID = import.meta.env.VITE_UMAMI_ID;
const SENTRY_LOADER = import.meta.env.VITE_SENTRY_LOADER;

function addScript(src, attributes = {}) {
  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
  document.head.appendChild(script);
}

export function initAnalytics() {
  if (!import.meta.env.PROD) return;
  if (UMAMI_SRC && UMAMI_ID) addScript(UMAMI_SRC, { 'data-website-id': UMAMI_ID });
  if (SENTRY_LOADER) addScript(SENTRY_LOADER, { crossorigin: 'anonymous' });
}

/** Count something that happened (a cell opened, a quiz finished). Silently does nothing without Umami. */
export function track(name, data) {
  try {
    window.umami?.track?.(name, data);
  } catch {
    // never let analytics break the app
  }
}

/** Send an error to Sentry, if configured. */
export function reportError(error, context) {
  try {
    window.Sentry?.captureException?.(error, context ? { extra: context } : undefined);
  } catch {
    // ignore
  }
}
