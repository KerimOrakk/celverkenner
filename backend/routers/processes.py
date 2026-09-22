from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from data import repository
from models.schemas import Lang, Process

router = APIRouter(prefix="/processes", tags=["processes"])


@router.get("", response_model=List[Process], summary="Celprocessen als stappenreeks, optioneel per cel")
def list_processes(
    cell_id: Optional[str] = Query(None, description="Alleen processen die in deze cel te zien zijn"),
    lang: Lang = Query("nl", description="Taal van de teksten: nl of en"),
):
    processes = repository.get_processes(lang)
    if cell_id is None:
        return processes
    if repository.get_cell(cell_id) is None:
        raise HTTPException(status_code=404, detail=f"Cel '{cell_id}' bestaat niet")
    return [process for process in processes if cell_id in process.cells]


@router.get("/{process_id}", response_model=Process, summary="Eén proces")
def read_process(process_id: str, lang: Lang = Query("nl", description="Taal van de teksten: nl of en")):
    process = repository.get_process(process_id, lang)
    if process is None:
        raise HTTPException(status_code=404, detail=f"Proces '{process_id}' bestaat niet")
    return process
