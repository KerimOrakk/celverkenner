from typing import List

from fastapi import APIRouter, Query

from data import repository
from models.schemas import ComparisonRow, Lang

router = APIRouter(prefix="/comparison", tags=["comparison"])


@router.get("", response_model=List[ComparisonRow], summary="Dierlijke cel en plantencel vergeleken, rij voor rij")
def list_comparison(lang: Lang = Query("nl", description="Taal van de teksten: nl of en")):
    return repository.get_comparison(lang)
