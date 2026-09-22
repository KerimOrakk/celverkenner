// Offline stand-in for the API. It reads the very same JSON files the backend
// serves, so there is only one source of truth for cells, positions and texts.
// Texts in those files are {"nl": .., "en": ..}; `localize` picks one language
// exactly like the backend does.

import cells from '../../../backend/data/cells.json';
import organelles from '../../../backend/data/organelles.json';
import explanations from '../../../backend/data/explanations.json';
import glossary from '../../../backend/data/glossary.json';
import comparison from '../../../backend/data/comparison.json';
import processes from '../../../backend/data/processes.json';

function localize(value, lang) {
  if (Array.isArray(value)) return value.map((item) => localize(item, lang));
  if (value && typeof value === 'object') {
    if ('nl' in value && Object.values(value).every((v) => typeof v === 'string')) return value[lang] || value.nl;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localize(item, lang)]));
  }
  return value;
}

const idsInCell = (cellId) => cells.find((cell) => cell.id === cellId)?.organelles.map((p) => p.organelle_id);

export const fallback = {
  getCells: (lang) =>
    localize(
      cells.map(({ shape, organelles: placements, ...summary }) => ({ ...summary, organelle_count: placements.length })),
      lang,
    ),

  getCell: (cellId, lang) => {
    const cell = cells.find((candidate) => candidate.id === cellId);
    return cell ? localize({ ...cell, organelle_count: cell.organelles.length }, lang) : null;
  },

  getOrganelles: (cellId, lang) => {
    const ids = cellId ? idsInCell(cellId) : organelles.map((o) => o.id);
    if (!ids) return null;
    return localize(ids.map((id) => organelles.find((o) => o.id === id)), lang);
  },

  getExplanations: (cellId, lang) => {
    const ids = cellId ? idsInCell(cellId) : null;
    if (cellId && !ids) return null;
    const rows = explanations.filter((explanation) => !ids || ids.includes(explanation.organelle_id));
    return localize(
      rows.map((explanation) => ({
        ...explanation,
        name: organelles.find((o) => o.id === explanation.organelle_id)?.name ?? explanation.organelle_id,
      })),
      lang,
    );
  },

  getGlossary: (lang) => localize(glossary, lang),
  getComparison: (lang) => localize(comparison, lang),
  getProcesses: (cellId, lang) => {
    if (cellId && !idsInCell(cellId)) return null;
    return localize(processes.filter((process) => !cellId || process.cells.includes(cellId)), lang);
  },
};
