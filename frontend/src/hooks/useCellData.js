import { useEffect, useState } from 'react';
import { api } from '../api.js';

const cache = new Map();

async function load(cellId) {
  const [cell, definitions, explanations] = await Promise.all([
    api.getCell(cellId),
    api.getOrganelles(cellId),
    api.getExplanations(cellId),
  ]);

  const definitionById = new Map(definitions.data.map((d) => [d.id, d]));
  const explanationById = new Map(explanations.data.map((e) => [e.organelle_id, e]));

  // One tidy list for the UI: definition + placement + explanation per organelle.
  const organelles = cell.data.organelles.map((placement) => ({
    ...(definitionById.get(placement.organelle_id) ?? {
      id: placement.organelle_id,
      name: placement.organelle_id,
      color: '#B0BEC5',
      cell_types: [],
    }),
    positions: placement.positions,
    scale: placement.scale,
    random: placement.random,
    explanation: explanationById.get(placement.organelle_id)?.text ?? '',
    details: explanationById.get(placement.organelle_id)?.details ?? null,
  }));

  const sources = [cell.source, definitions.source, explanations.source];
  return {
    cell: cell.data,
    definitions: definitions.data,
    organelles,
    source: sources.every((s) => s === 'api') ? 'api' : 'fallback',
  };
}

/** Everything the viewer needs for one cell: /cells/{id}, /organelles and /explanations. */
export function useCellData(cellId) {
  const [state, setState] = useState(() =>
    cache.has(cellId) ? { status: 'ready', ...cache.get(cellId) } : { status: 'loading' },
  );

  useEffect(() => {
    if (!cellId) return undefined;
    let cancelled = false;
    if (cache.has(cellId)) {
      setState({ status: 'ready', ...cache.get(cellId) });
      return undefined;
    }
    setState({ status: 'loading' });
    load(cellId)
      .then((data) => {
        if (data.source === 'api') cache.set(cellId, data);
        if (!cancelled) setState({ status: 'ready', ...data });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: error.status === 404 ? 'not-found' : 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [cellId]);

  return state;
}
