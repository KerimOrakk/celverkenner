# CelVerkenner 3D

Een webapp waarmee leerlingen drie cellen in 3D verkennen: een **hartcel**, een **darmcel** (beide dierlijk) en een **plantencel**. Draai de cel rond, open het membraan, klik op een organel voor uitleg, of stap met de intracellulaire modus midden in het cytoplasma.

Alle 3D-modellen zijn in code opgebouwd uit Three.js-geometrieën (Sphere, Cylinder, Box, Torus, Ring, Circle) met `MeshStandardMaterial`/`MeshPhysicalMaterial`. Er zijn geen externe modelbestanden en er is geen Blender gebruikt.

- **Backend:** FastAPI (Python) – levert cellen, organellen, posities en uitlegteksten als JSON.
- **Frontend:** React + Vite + Three.js.

## Snel starten

Je hebt **Python 3.10+** en **Node.js 18+** nodig. Open de map `project` in VS Code en gebruik twee terminals.

**Terminal 1 – backend**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

De API draait nu op <http://localhost:8000> (interactieve documentatie op <http://localhost:8000/docs>).

**Terminal 2 – frontend**

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

> Tip: in VS Code kun je via `Terminal → Run Task… → Start alles` beide servers in één keer starten (zie `.vscode/tasks.json`).

Wil je een virtuele Python-omgeving gebruiken?

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate      macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Mappenstructuur

```
project/
├── backend/
│   ├── main.py                 FastAPI-app, CORS, routers
│   ├── requirements.txt
│   ├── routers/
│   │   ├── cells.py            GET /cells, GET /cells/{id}
│   │   ├── organelles.py       GET /organelles, GET /organelles/{id}
│   │   └── explanations.py     GET /explanations, GET /explanations/{id}
│   ├── models/
│   │   └── schemas.py          Pydantic-modellen (Cell, Organelle, Explanation, …)
│   └── data/
│       ├── cells.json          drie cellen: vorm, kleur, organelposities en schalen
│       ├── organelles.json     naam, kleur en categorie per organel
│       ├── explanations.json   de uitlegteksten
│       └── repository.py       laadt en valideert de JSON-bestanden
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/favicon.svg
│   └── src/
│       ├── main.jsx, App.jsx   router: /, /viewer/:cellId, /intracellulair/:cellId
│       ├── api.js              client voor de API (met offline-terugval)
│       ├── styles.css          thema en lay-out
│       ├── pages/
│       │   ├── HomePage.jsx            celkeuze met live 3D-voorbeeld
│       │   ├── ViewerPage.jsx          3D-viewer (van buiten)
│       │   └── IntracellularPage.jsx   intracellulaire modus (van binnen)
│       ├── components/
│       │   ├── CellExperience.jsx      gedeelde lay-out en toestand van beide 3D-pagina's
│       │   ├── CellViewer.jsx          React-wrapper om de Three.js-scène
│       │   ├── OrganelleButtons.jsx    de groene organelknoppen
│       │   ├── ExplanationPanel.jsx    het inschuivende uitlegpaneel
│       │   ├── TopBar.jsx              terugknop, cel-dropdown, weergavekeuze, API-status
│       │   ├── ViewerControls.jsx      auto-rotatie, cel openen/sluiten, beginstand, rondleiding
│       │   └── ApiStatus.jsx
│       ├── ui/                 Button, Dropdown, Spinner
│       ├── hooks/              useCells, useCellData
│       ├── data/fallback.js    offline kopie (leest backend/data/*.json)
│       └── three/
│           ├── CellScene.js        renderer, camera, OrbitControls, picking, glow, animaties
│           ├── cellBuilder.js      bouwt één cel op uit de API-gegevens
│           ├── organelles.js       een fabriek per organel (alles uit basisgeometrieën)
│           ├── geometryUtils.js    afgeronde doos, celvorm, doorsnedes, samenvoegen
│           ├── layout.js           plaatsing: ankerposities + overlap wegwerken
│           └── random.js           herhaalbare toevalsgenerator (seed)
├── .vscode/tasks.json
└── README.md
```

## API

| Endpoint | Beschrijving |
|---|---|
| `GET /cells` | Lijst van cellen (id, naam, type, tagline, beschrijving) |
| `GET /cells/{cell_id}` | Eén cel, inclusief vorm en alle organelposities/schalen |
| `GET /organelles` | Alle organellen (naam, kleur, categorie, celtypes) |
| `GET /organelles?cell_id=hartcel` | Alleen de organellen die in die cel voorkomen |
| `GET /organelles/{organelle_id}` | Eén organel |
| `GET /explanations` | Alle uitlegteksten |
| `GET /explanations?cell_id=plantencel` | Uitlegteksten voor één cel |
| `GET /explanations/{organelle_id}` | Eén uitlegtekst |
| `GET /health` | Draait de API? |

Cel-id's: `hartcel`, `darmcel`, `plantencel`.
Organel-id's: `celmembraan`, `celwand`, `celnucleus`, `nucleolus`, `mitochondrien`, `ribosomen`, `golgi`, `ruw_er`, `glad_er`, `lysosomen`, `centriolen`, `microvilli`, `chloroplasten`, `vacuole`.

Voorbeeld van een organelplaatsing uit `GET /cells/hartcel`:

```json
{
  "organelle_id": "mitochondrien",
  "positions": [[0.4, 0.1, 0.1], [0.3, -0.2, 0.2], [0.1, -0.4, -0.1], [-0.3, 0.3, 0.1], [-0.4, -0.1, -0.2]],
  "random": { "count": 14, "range": 0.5 }
}
```

`positions` zijn de vaste posities uit de les, `random` vult aan met willekeurig geplaatste exemplaren binnen ±`range`. Organellen met een vaste grootte (membraan, celkern, nucleolus, celwand) hebben daarnaast een `scale`.

### Gegevens aanpassen

Alle inhoud staat in `backend/data/*.json`. Voeg je een organel toe, zet het dan in alle drie de bestanden (`organelles.json`, `explanations.json` en de betreffende cel in `cells.json`). De backend controleert bij het opstarten of alles op elkaar aansluit en meldt anders precies wat er ontbreekt. De frontend heeft voor elk organel een 3D-fabriek in `src/three/organelles.js`; een onbekend organel wordt als eenvoudige bol getekend.

## Bediening

| Actie | Hoe |
|---|---|
| Cel draaien / zoomen | slepen, scrollen of knijpen (OrbitControls) |
| Organel bekijken | klik erop in 3D of druk op de groene knop; de camera zoomt ernaartoe en het organel licht op |
| Volgend / vorig organel | knoppen in het paneel of de pijltjestoetsen ← → |
| Paneel sluiten | ✕ of `Esc` |
| Cel openen / sluiten | knop onderaan (alleen in de 3D-viewer) |
| Andere cel of weergave | dropdown en weergavekeuze in de bovenbalk |
| Rondleiding (intracellulair) | knop "Rondleiding starten" vliegt van organel naar organel |

## Ontwerpkeuzes

**Posities uit de les vs. overlap.** De API levert de posities en schalen *exact* zoals in de opdracht. Enkele daarvan overlappen in 3D (het Golgi-apparaat en een paar mitochondriën liggen bijvoorbeeld binnen de straal van de celkern). De frontend gebruikt de posities daarom als *ankerpunt* en verschuift organellen alleen zover als nodig is om elkaar niet te doorsnijden (maximaal ongeveer 0,3 eenheid; celkern, nucleolus en vacuole blijven op hun plek). Dat gebeurt deterministisch, dus dezelfde cel ziet er elke keer hetzelfde uit. Wil je de ruwe posities zien, zet dan `RESOLVE_OVERLAPS` in `frontend/src/three/layout.js` op `false`. In het uitlegpaneel staan onder "Posities in de cel" altijd de oorspronkelijke waarden uit de API.

**Cel openen.** Het membraan (en bij de plantencel de celwand en bij de darmcel de microvilli) wordt met twee clipping planes opengesneden in het kwadrant x > 0, z > 0. Organellen met een doorsnede (celkern, mitochondriën met cristae, chloroplasten met grana) zijn in datzelfde kwadrant opengewerkt, zodat je er ook echt in kijkt.

**Glow.** Een geselecteerd organel krijgt een pulserende emissive-kleur plus een zachte lichtkring (additieve sprites) in de accentkleur `#00E5FF`. Bij hover licht het licht op en verschijnt de naam.

**Intracellulaire modus.** Dezelfde cel, maar de camera staat binnen het membraan (brede lens, lichte mist, zwevende stofdeeltjes). De camera kan niet door organellen of door het membraan heen; het membraan en de wand zijn van binnen iets minder doorzichtig zodat je de rand van de cel blijft zien.

**Offline-terugval.** Draait de backend niet, dan laadt de frontend dezelfde JSON-bestanden rechtstreeks uit `backend/data/` en toont "Offline gegevens" met een knop om opnieuw te verbinden. Zo werkt de viewer in de klas ook zonder Python.

**Vormgeving.** Achtergrond `#0F0F1A`, panelen `#1A1A2D`, knoppen `#4CAF50` (hover `#81C784`), highlight `#00E5FF`, tekst wit. Het uitlegpaneel schuift van rechts in (op smalle schermen van onderen). Toetsenbord­focus is zichtbaar en animaties respecteren `prefers-reduced-motion`.

## Instellingen

| Variabele | Waar | Standaard | Doel |
|---|---|---|---|
| `VITE_API_URL` | `frontend/.env` (zie `.env.example`) | `http://localhost:8000` | Adres van de API |
| `FRONTEND_ORIGINS` | omgeving van de backend | leeg | Extra toegestane origins voor CORS, komma-gescheiden. Alle `localhost`- en `127.0.0.1`-poorten zijn altijd toegestaan. |

## Productie-build

```bash
cd frontend
npm run build      # statische bestanden in frontend/dist/
npm run preview    # test de build lokaal
```

Zet `VITE_API_URL` vóór het bouwen op het adres waar de API straks draait, en geef dat frontend-adres aan de backend mee via `FRONTEND_ORIGINS`.

## Problemen oplossen

- **"Offline gegevens" in de bovenbalk** – de backend draait niet of op een andere poort. Start `uvicorn main:app --reload` in `backend/` en klik op "Opnieuw verbinden".
- **CORS-fout in de browserconsole** – de frontend draait op een ander adres dan `localhost`/`127.0.0.1`. Voeg dat adres toe aan `FRONTEND_ORIGINS`.
- **"3D kan hier niet starten"** – WebGL is uitgeschakeld. Gebruik een recente Chrome, Edge of Firefox en zet hardwareversnelling aan.
- **JSON aangepast maar niets veranderd** – de backend cachet de data. Sla ook een `.py`-bestand op (dan herstart `--reload`) of herstart uvicorn.
