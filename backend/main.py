"""CelVerkenner 3D – API.

Starten (vanuit de map backend/):

    uvicorn main:app --reload
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data import repository
from routers import cells, comparison, explanations, glossary, organelles, processes


@asynccontextmanager
async def lifespan(_: FastAPI):
    repository.validate_all()
    yield


app = FastAPI(
    title="CelVerkenner 3D API",
    version="1.0.0",
    description="Levert cellen, organellen, posities en uitlegteksten aan de 3D-frontend.",
    lifespan=lifespan,
)

# De Vite-frontend draait standaard op http://localhost:5173. Elke localhost-poort
# is toegestaan; extra adressen (bijv. een gehoste frontend) kun je komma-gescheiden
# meegeven via de omgevingsvariabele FRONTEND_ORIGINS.
extra_origins = [o.strip() for o in os.getenv("FRONTEND_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=extra_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(cells.router)
app.include_router(organelles.router)
app.include_router(explanations.router)
app.include_router(glossary.router)
app.include_router(comparison.router)
app.include_router(processes.router)


@app.get("/", tags=["meta"], summary="Overzicht van de API")
def root():
    return {
        "name": app.title,
        "version": app.version,
        "endpoints": ["/cells", "/cells/{cell_id}", "/organelles", "/explanations", "/glossary", "/comparison", "/processes"],
        "languages": ["nl", "en"],
        "docs": "/docs",
    }


@app.get("/health", tags=["meta"], summary="Draait de API?")
def health():
    return {"status": "ok"}
