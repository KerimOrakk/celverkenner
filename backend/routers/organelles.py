from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from data import repository
from models.schemas import Lang, Organelle

router = APIRouter(prefix="/organelles", tags=["organelles"])


@router.get("", response_model=List[Organelle], summary="Alle organellen, of alleen die van één cel")
def list_organelles(
    cell_id: Optional[str] = Query(None, description="Bijv. hartcel, darmcel of plantencel"),
    lang: Lang = Query("nl", description="Taal van de teksten: nl of en"),
):
    organelles = repository.get_organelles(lang)
    if cell_id is None:
        return organelles

    ids = repository.organelle_ids_in_cell(cell_id)
    if ids is None:
        raise HTTPException(status_code=404, detail=f"Cel '{cell_id}' bestaat niet")

    index = {organelle.id: organelle for organelle in organelles}
    return [index[organelle_id] for organelle_id in ids]


@router.get("/{organelle_id}", response_model=Organelle, summary="Eén organel")
def read_organelle(organelle_id: str, lang: Lang = Query("nl", description="Taal van de teksten: nl of en")):
    organelle = repository.get_organelle(organelle_id, lang)
    if organelle is None:
        raise HTTPException(status_code=404, detail=f"Organel '{organelle_id}' bestaat niet")
    return organelle
