// Offline stand-in for the API. It reads the very same JSON files the backend
// serves, so there is only one source of truth for cells, positions and texts.

import cells from '../../../backend/data/cells.json';
import organelles from '../../../backend/data/organelles.json';
import explanations from '../../../backend/data/explanations.json';
import glossary from '../../../backend/data/glossary.json';

const organelleById = new Map(organelles.map((organelle) => [organelle.id, organelle]));

const idsInCell = (cellId) => cells.find((cell) => cell.id === cellId)?.organelles.map((p) => p.organelle_id);

export const fallback = {
  getCells: () =>
    cells.map(({ shape, organelles: placements, ...summary }) => ({
      ...summary,
      organelle_count: placements.length,
    })),

  getCell: (cellId) => {
    const cell = cells.find((candidate) => candidate.id === cellId);
    return cell ? { ...cell, organelle_count: cell.organelles.length } : null;
  },

  getOrganelles: (cellId) => idsInCell(cellId)?.map((id) => organelleById.get(id)) ?? null,

  getExplanations: (cellId) => {
    const ids = idsInCell(cellId);
    if (!ids) return null;
    return explanations
      .filter((explanation) => ids.includes(explanation.organelle_id))
      .map((explanation) => ({
        ...explanation,
        name: organelleById.get(explanation.organelle_id)?.name ?? explanation.organelle_id,
      }));
  },

  getGlossary: () => glossary,
};
