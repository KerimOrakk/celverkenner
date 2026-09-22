// Thin client for the FastAPI backend.
//
// When the backend is not running, every call falls back to the same JSON
// files the backend serves (see data/fallback.js), so the 3D viewer keeps
// working in class even without `uvicorn`. `source` tells the UI which one
// was used.

import { fallback } from './data/fallback.js';

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

export const api = {
  getCells: () => withFallback('/cells', fallback.getCells),
  getCell: (cellId) => withFallback(`/cells/${encodeURIComponent(cellId)}`, () => fallback.getCell(cellId)),
  getOrganelles: (cellId) =>
    withFallback(`/organelles?cell_id=${encodeURIComponent(cellId)}`, () => fallback.getOrganelles(cellId)),
  getExplanations: (cellId) =>
    withFallback(`/explanations?cell_id=${encodeURIComponent(cellId)}`, () => fallback.getExplanations(cellId)),
  getGlossary: () => withFallback('/glossary', fallback.getGlossary),
};
