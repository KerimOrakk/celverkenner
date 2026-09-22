"""Leest de JSON-bestanden in deze map en valideert ze met de Pydantic-modellen.

Alles wordt één keer geladen en daarna uit het geheugen geserveerd. Pas je een
JSON-bestand aan terwijl `uvicorn --reload` draait? Sla dan ook een .py-bestand
op (of herstart), zodat de cache opnieuw wordt opgebouwd.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

import re

from models.schemas import Cell, Explanation, GlossaryTerm, Organelle

DATA_DIR = Path(__file__).resolve().parent


def _read(filename: str):
    with (DATA_DIR / filename).open(encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def get_organelles() -> List[Organelle]:
    return [Organelle(**row) for row in _read("organelles.json")]


@lru_cache(maxsize=1)
def _organelle_index() -> Dict[str, Organelle]:
    return {organelle.id: organelle for organelle in get_organelles()}


def get_organelle(organelle_id: str) -> Optional[Organelle]:
    return _organelle_index().get(organelle_id)


@lru_cache(maxsize=1)
def get_cells() -> List[Cell]:
    cells = []
    for row in _read("cells.json"):
        cell = Cell(**row)
        cell.organelle_count = len(cell.organelles)
        unknown = [p.organelle_id for p in cell.organelles if p.organelle_id not in _organelle_index()]
        if unknown:
            raise ValueError(f"cells.json: onbekende organellen in '{cell.id}': {unknown}")
        cells.append(cell)
    return cells


def get_cell(cell_id: str) -> Optional[Cell]:
    return next((cell for cell in get_cells() if cell.id == cell_id), None)


TERM_PATTERN = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")


@lru_cache(maxsize=1)
def get_glossary() -> List[GlossaryTerm]:
    return [GlossaryTerm(**row) for row in _read("glossary.json")]


@lru_cache(maxsize=1)
def _glossary_index() -> Dict[str, GlossaryTerm]:
    return {term.id: term for term in get_glossary()}


def get_glossary_term(term_id: str) -> Optional[GlossaryTerm]:
    return _glossary_index().get(term_id)


@lru_cache(maxsize=1)
def get_explanations() -> List[Explanation]:
    index = _organelle_index()
    glossary = _glossary_index()
    explanations = []
    for row in _read("explanations.json"):
        organelle = index.get(row["organelle_id"])
        if organelle is None:
            raise ValueError(f"explanations.json: onbekend organel '{row['organelle_id']}'")
        details = row.get("details")
        unknown = [t for t in TERM_PATTERN.findall(details or "") if t not in glossary]
        if unknown:
            raise ValueError(f"explanations.json: '{organelle.id}' verwijst naar onbekende termen {unknown}")
        explanations.append(
            Explanation(organelle_id=organelle.id, name=organelle.name, text=row["text"], details=details)
        )
    return explanations


def get_explanation(organelle_id: str) -> Optional[Explanation]:
    return next((e for e in get_explanations() if e.organelle_id == organelle_id), None)


def organelle_ids_in_cell(cell_id: str) -> Optional[List[str]]:
    cell = get_cell(cell_id)
    if cell is None:
        return None
    return [placement.organelle_id for placement in cell.organelles]


def validate_all() -> None:
    """Laadt alles één keer, zodat fouten in de data meteen bij het opstarten opvallen."""
    get_organelles()
    get_cells()
    get_glossary()
    get_explanations()
