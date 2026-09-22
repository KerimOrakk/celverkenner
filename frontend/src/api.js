// Thin client for the FastAPI backend.
//
// When the backend is not running, every call falls back to the same JSON
// files the backend serves (see data/fallback.js), so the 3D viewer keeps
// working in class even without `uvicorn`. `source` tells the UI which one
// was used.

import { fallback } from './data/fallback.js';
import { getLanguage } from './i18n/index.jsx';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');

let apiReachable = null; // null = unknown, so the first call decides

async function request(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const error = new Error(`API antwoordde met status ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function withFallback(path, offline) {
  if (apiReachable !== false) {
    try {
      const data = await request(path);
      apiReachable = true;
      return { data, source: 'api' };
    } catch (error) {
      if (error.status === 404) throw error; // the API is fine, the thing just does not exist
      apiReachable = false;
    }
  }
  const data = offline();
  if (data == null) {
    const error = new Error('Niet gevonden');
    error.status = 404;
    throw error;
  }
  return { data, source: 'fallback' };
}

/** Forget that the API was unreachable, e.g. when the user presses "Opnieuw verbinden". */
export function retryApi() {
  apiReachable = null;
}

/** Query string with the current language and, optionally, a cell filter. */
function query(cellId) {
  const params = new URLSearchParams({ lang: getLanguage() });
  if (cellId) params.set('cell_id', cellId);
  return `?${params}`;
}

export const api = {
  getCells: () => withFallback(`/cells${query()}`, () => fallback.getCells(getLanguage())),
  getCell: (cellId) =>
    withFallback(`/cells/${encodeURIComponent(cellId)}${query()}`, () => fallback.getCell(cellId, getLanguage())),
  getOrganelles: (cellId) =>
    withFallback(`/organelles${query(cellId)}`, () => fallback.getOrganelles(cellId, getLanguage())),
  getExplanations: (cellId) =>
    withFallback(`/explanations${query(cellId)}`, () => fallback.getExplanations(cellId, getLanguage())),
  getGlossary: () => withFallback(`/glossary${query()}`, () => fallback.getGlossary(getLanguage())),
  getComparison: () => withFallback(`/comparison${query()}`, () => fallback.getComparison(getLanguage())),
  getProcesses: (cellId) =>
    withFallback(`/processes${query(cellId)}`, () => fallback.getProcesses(cellId, getLanguage())),
};
