"""Pydantic-modellen: dit is het contract tussen de API en de frontend."""

from typing import List, Literal, Optional, Tuple

from pydantic import BaseModel, Field

Vec3 = Tuple[float, float, float]

# Alle teksten staan in de JSON-bestanden als {"nl": "...", "en": "..."}.
# De API geeft één taal terug (query-parameter ?lang=nl|en, standaard nl).
Lang = Literal["nl", "en"]
LANGUAGES = ("nl", "en")


class RandomSpec(BaseModel):
    """Extra exemplaren die de frontend willekeurig (maar reproduceerbaar) plaatst."""

    count: int = Field(..., ge=0, description="Aantal willekeurig geplaatste exemplaren")
    range: float = Field(..., gt=0, description="Posities liggen binnen ±range op elke as")


class OrganellePlacement(BaseModel):
    """Waar een organel in één bepaalde cel staat."""

    organelle_id: str
    positions: List[Vec3] = Field(default_factory=list, description="Vaste posities (x, y, z)")
    scale: Optional[float] = Field(None, description="Relatieve schaal, celmembraan = 1.0")
    random: Optional[RandomSpec] = None


class CellShape(BaseModel):
    """Vorm van de cel. De frontend bouwt hiermee het membraan in Three.js."""

    kind: Literal["ellipsoid", "box", "disc"]
    radii: Vec3 = Field(..., description="Halve afmetingen bij schaal 1.0")
    flat_top: Optional[float] = Field(None, description="Y-waarde waarop de bovenkant wordt afgevlakt")
    flat_bottom: Optional[float] = Field(None, description="Y-waarde waarop de onderkant wordt afgevlakt")
    membrane_color: str


class CellSummary(BaseModel):
    id: str
    name: str
    type: Literal["dierlijk", "plantaardig", "prokaryoot"]
    type_label: str
    tagline: str
    description: str
    organelle_count: int = 0


class Cell(CellSummary):
    shape: CellShape
    organelles: List[OrganellePlacement]


class Organelle(BaseModel):
    id: str
    name: str
    color: str
    category: str
    cell_types: List[str]


class Explanation(BaseModel):
    organelle_id: str
    name: str
    text: str
    # Langere uitleg. Termen tussen [[ ]] verwijzen naar glossary.json en zijn
    # in de frontend klikbaar: [[plasmodesmata]] of [[porien|poriën]] (id|label).
    details: Optional[str] = None


class GlossaryTerm(BaseModel):
    id: str
    term: str
    definition: str


class ComparisonRow(BaseModel):
    """Eén rij in de vergelijking dierlijke cel <-> plantencel."""

    id: str
    organelle_id: Optional[str] = None
    label: str
    animal: Optional[bool] = Field(None, description="Aanwezig in dierlijke cel (None = n.v.t.)")
    plant: Optional[bool] = Field(None, description="Aanwezig in plantencel (None = n.v.t.)")
    bacteria: Optional[bool] = Field(None, description="Aanwezig in bacterie (None = n.v.t.)")
    animal_text: str
    plant_text: str
    bacteria_text: Optional[str] = None


class ProcessStep(BaseModel):
    organelle_id: str
    title: str
    text: str  # mag [[begrippen]] bevatten, zie Explanation.details


class Process(BaseModel):
    id: str
    name: str
    summary: str
    cells: List[str]
    steps: List[ProcessStep]
