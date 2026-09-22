from typing import List

from fastapi import APIRouter, HTTPException

from data import repository
from models.schemas import GlossaryTerm

router = APIRouter(prefix="/glossary", tags=["glossary"])


@router.get("", response_model=List[GlossaryTerm], summary="Alle begrippen uit de uitlegteksten")
def list_glossary():
    return repository.get_glossary()


@router.get("/{term_id}", response_model=GlossaryTerm, summary="Eén begrip")
def read_term(term_id: str):
    term = repository.get_glossary_term(term_id)
    if term is None:
        raise HTTPException(status_code=404, detail=f"Begrip '{term_id}' bestaat niet")
    return term
