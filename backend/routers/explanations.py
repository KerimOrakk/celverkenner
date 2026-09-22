from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from data import repository
from models.schemas import Explanation

router = APIRouter(prefix="/explanations", tags=["explanations"])


@router.get("", response_model=List[Explanation], summary="Alle uitlegteksten, of alleen die van één cel")
def list_explanations(
    cell_id: Optional[str] = Query(None, description="Bijv. hartcel, darmcel of plantencel"),
):
    explanations = repository.get_explanations()
    if cell_id is None:
        return explanations

    ids = repository.organelle_ids_in_cell(cell_id)
    if ids is None:
        raise HTTPException(status_code=404, detail=f"Cel '{cell_id}' bestaat niet")
    return [explanation for explanation in explanations if explanation.organelle_id in ids]


@router.get("/{organelle_id}", response_model=Explanation, summary="Uitleg bij één organel")
def read_explanation(organelle_id: str):
    explanation = repository.get_explanation(organelle_id)
    if explanation is None:
        raise HTTPException(status_code=404, detail=f"Geen uitleg voor '{organelle_id}'")
    return explanation
