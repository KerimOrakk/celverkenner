from typing import List

from fastapi import APIRouter, HTTPException

from data import repository
from models.schemas import Cell, CellSummary

router = APIRouter(prefix="/cells", tags=["cells"])


@router.get("", response_model=List[CellSummary], summary="Alle cellen (voor de celkeuze)")
def list_cells():
    return repository.get_cells()


@router.get("/{cell_id}", response_model=Cell, summary="Eén cel met vorm en organelposities")
def read_cell(cell_id: str):
    cell = repository.get_cell(cell_id)
    if cell is None:
        raise HTTPException(status_code=404, detail=f"Cel '{cell_id}' bestaat niet")
    return cell
