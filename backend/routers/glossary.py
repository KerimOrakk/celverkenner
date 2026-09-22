from typing import List

from fastapi import APIRouter, HTTPException, Query

from data import repository
from models.schemas import GlossaryTerm, Lang

router = APIRouter(prefix="/glossary", tags=["glossary"])


@router.get("", response_model=List[GlossaryTerm], summary="Alle begrippen uit de uitlegteksten")
def list_glossary(lang: Lang = Query("nl", description="Taal van de teksten: nl of en")):
    return repository.get_glossary(lang)


@router.get("/{term_id}", response_model=GlossaryTerm, summary="Eén begrip")
def read_term(term_id: str, lang: Lang = Query("nl", description="Taal van de teksten: nl of en")):
    term = repository.get_glossary_term(term_id, lang)
    if term is None:
        raise HTTPException(status_code=404, detail=f"Begrip '{term_id}' bestaat niet")
    return term
