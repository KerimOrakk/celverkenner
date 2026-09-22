"""Leest de JSON-bestanden in deze map en valideert ze met de Pydantic-modellen.

Alles wordt per taal één keer geladen en daarna uit het geheugen geserveerd. Pas
je een JSON-bestand aan terwijl `uvicorn --reload` draait? Sla dan ook een
.py-bestand op (of herstart), zodat de cache opnieuw wordt opgebouwd.

Teksten staan in de bestanden als {"nl": "...", "en": "..."}; `_localize` kiest
één taal (met Nederlands als terugval).
"""

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from models.schemas import (
    LANGUAGES,
    Cell,
    ComparisonRow,
    Explanation,
    GlossaryTerm,
    Organelle,
    Process,
)

DATA_DIR = Path(__file__).resolve().parent
TERM_PATTERN = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")


def _read(filename: str):
    with (DATA_DIR / filename).open(encoding="utf-8") as handle:
        return json.load(handle)


def _localize(value, lang: str):
    """{"nl": .., "en": ..} -> tekst in `lang`; werkt recursief door lijsten en dicts."""
    if isinstance(value, dict):
        if "nl" in value and all(isinstance(v, str) for v in value.values()):
            return value.get(lang) or value["nl"]
        return {key: _localize(item, lang) for key, item in value.items()}
    if isinstance(value, list):
        return [_localize(item, lang) for item in value]
    return value


def _load(filename: str, lang: str):
    return _localize(_read(filename), lang)


# ---------------------------------------------------------------- organelles
@lru_cache(maxsize=4)
def get_organelles(lang: str = "nl") -> List[Organelle]:
    return [Organelle(**row) for row in _load("organelles.json", lang)]


@lru_cache(maxsize=4)
def _organelle_index(lang: str = "nl") -> Dict[str, Organelle]:
    return {organelle.id: organelle for organelle in get_organelles(lang)}


def get_organelle(organelle_id: str, lang: str = "nl") -> Optional[Organelle]:
    return _organelle_index(lang).get(organelle_id)


# --------------------------------------------------------------------- cells
@lru_cache(maxsize=4)
def get_cells(lang: str = "nl") -> List[Cell]:
    cells = []
    index = _organelle_index(lang)
    for row in _load("cells.json", lang):
        cell = Cell(**row)
        cell.organelle_count = len(cell.organelles)
        unknown = [p.organelle_id for p in cell.organelles if p.organelle_id not in index]
        if unknown:
            raise ValueError(f"cells.json: onbekende organellen in '{cell.id}': {unknown}")
        cells.append(cell)
    return cells


def get_cell(cell_id: str, lang: str = "nl") -> Optional[Cell]:
    return next((cell for cell in get_cells(lang) if cell.id == cell_id), None)


def organelle_ids_in_cell(cell_id: str) -> Optional[List[str]]:
    cell = get_cell(cell_id)
    if cell is None:
        return None
    return [placement.organelle_id for placement in cell.organelles]


# ------------------------------------------------------------------ glossary
@lru_cache(maxsize=4)
def get_glossary(lang: str = "nl") -> List[GlossaryTerm]:
    return [GlossaryTerm(**row) for row in _load("glossary.json", lang)]


@lru_cache(maxsize=4)
def _glossary_index(lang: str = "nl") -> Dict[str, GlossaryTerm]:
    return {term.id: term for term in get_glossary(lang)}


def get_glossary_term(term_id: str, lang: str = "nl") -> Optional[GlossaryTerm]:
    return _glossary_index(lang).get(term_id)


def _check_terms(text: Optional[str], where: str) -> None:
    unknown = [t for t in TERM_PATTERN.findall(text or "") if t not in _glossary_index()]
    if unknown:
        raise ValueError(f"{where} verwijst naar onbekende begrippen {unknown}")


# -------------------------------------------------------------- explanations
@lru_cache(maxsize=4)
def get_explanations(lang: str = "nl") -> List[Explanation]:
    index = _organelle_index(lang)
    explanations = []
    for row in _load("explanations.json", lang):
        organelle = index.get(row["organelle_id"])
        if organelle is None:
            raise ValueError(f"explanations.json: onbekend organel '{row['organelle_id']}'")
        details = row.get("details")
        _check_terms(details, f"explanations.json: '{organelle.id}'")
        explanations.append(
            Explanation(organelle_id=organelle.id, name=organelle.name, text=row["text"], details=details)
        )
    return explanations


def get_explanation(organelle_id: str, lang: str = "nl") -> Optional[Explanation]:
    return next((e for e in get_explanations(lang) if e.organelle_id == organelle_id), None)


# ---------------------------------------------------------------- comparison
@lru_cache(maxsize=4)
def get_comparison(lang: str = "nl") -> List[ComparisonRow]:
    index = _organelle_index(lang)
    rows = [ComparisonRow(**row) for row in _load("comparison.json", lang)]
    unknown = [r.organelle_id for r in rows if r.organelle_id and r.organelle_id not in index]
    if unknown:
        raise ValueError(f"comparison.json: onbekende organellen {unknown}")
    return rows


# ----------------------------------------------------------------- processes
@lru_cache(maxsize=4)
def get_processes(lang: str = "nl") -> List[Process]:
    index = _organelle_index(lang)
    cell_ids = {cell.id for cell in get_cells(lang)}
    processes = []
    for row in _load("processes.json", lang):
        process = Process(**row)
        unknown_cells = [c for c in process.cells if c not in cell_ids]
        if unknown_cells:
            raise ValueError(f"processes.json: '{process.id}' noemt onbekende cellen {unknown_cells}")
        for step in process.steps:
            if step.organelle_id not in index:
                raise ValueError(f"processes.json: '{process.id}' noemt onbekend organel '{step.organelle_id}'")
            _check_terms(step.text, f"processes.json: '{process.id}'")
            for cell_id in process.cells:
                if step.organelle_id not in organelle_ids_in_cell(cell_id):
                    raise ValueError(
                        f"processes.json: '{process.id}' gebruikt '{step.organelle_id}', dat niet in '{cell_id}' zit"
                    )
        processes.append(process)
    return processes


def get_process(process_id: str, lang: str = "nl") -> Optional[Process]:
    return next((p for p in get_processes(lang) if p.id == process_id), None)


def validate_all() -> None:
    """Laadt alles in elke taal, zodat fouten in de data meteen bij het opstarten opvallen."""
    for lang in LANGUAGES:
        get_organelles(lang)
        get_cells(lang)
        get_glossary(lang)
        get_explanations(lang)
        get_comparison(lang)
        get_processes(lang)
