from typing import List

from fastapi import APIRouter, HTTPException, Query

from data import repository
from models.schemas import Cell, CellSummary, Lang

router = APIRouter(prefix="/cells", tags=["cells"])


@router.get("", response_model=List[CellSummary], summary="Alle cellen (voor de celkeuze)")
def list_cells(lang: Lang = Query("nl", description="Taal van de teksten: nl of en")):
    return repository.get_cells(lang)


@router.get("/{cell_id}", response_model=Cell, summary="Eén cel met vorm en organelposities")
def read_cell(cell_id: str, lang: Lang = Query("nl", description="Taal van de teksten: nl of en")):
    cell = repository.get_cell(cell_id, lang)
    if cell is None:
        raise HTTPException(status_code=404, detail=f"Cel '{cell_id}' bestaat niet")
    return cell
