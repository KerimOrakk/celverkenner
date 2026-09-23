# CelVerkenner 3D

Een webapp waarmee leerlingen vier cellen in 3D verkennen: een **hartcel**, een **darmcel** (beide dierlijk), een **plantencel** en een **bacterie** (prokaryoot). Draai de cel rond, open het membraan, klik op een organel voor uitleg, of stap met de intracellulaire modus midden in het cytoplasma.

Verder in de app:

- **Processen** – de route van een eiwit, celademhaling, fotosynthese, opname in de darm, celdeling en afval opruimen, stap voor stap: de camera vliegt van organel naar organel en tekent de route in 3D.
- **Vergelijken** – dierlijke cel, plantencel en bacterie naast elkaar met een verschillentabel (eukaryoot vs. prokaryoot); tik op een rij en het organel licht in de cellen op.
- **Begrippenlijst** – alle begrippen uit de uitleg op alfabet, met zoekvak en links naar het organel in 3D.
- **Quiz** – drie spelvormen: *Vind het organel* (klik in 3D op wat gevraagd wordt), *Hoe heet dit?* (een organel licht op, kies de naam uit vier) en *Welke cel is dit?* (een cel van buiten of van binnen, zonder naam). Timer, straftijd bij fouten, beste tijd per spelvorm en celkeuze wordt onthouden.
- **Namen tonen** – schakelaar in de 3D-weergave: zwevende naamlabels bij elk organel, klikbaar.
- **Nederlands en Engels** – schakelaar rechtsboven (of `?lang=en` in het adres); de API levert beide talen.
- **Offline / installeerbaar (PWA)** – na één bezoek werkt de site zonder internet en kan hij als app op telefoon of laptop worden gezet.

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
│   │   ├── explanations.py     GET /explanations, GET /explanations/{id}
│   │   ├── glossary.py         GET /glossary, GET /glossary/{id}
│   │   ├── comparison.py       GET /comparison
│   │   └── processes.py        GET /processes, GET /processes/{id}
│   ├── models/
│   │   └── schemas.py          Pydantic-modellen (Cell, Organelle, Explanation, …)
│   └── data/
│       ├── cells.json          drie cellen: vorm, kleur, organelposities en schalen
│       ├── organelles.json     naam, kleur en categorie per organel
│       ├── explanations.json   de uitlegteksten (kort + lang, met [[begrippen]])
│       ├── glossary.json       definities van de klikbare begrippen
│       ├── comparison.json     verschillentabel dierlijke cel / plantencel
│       ├── processes.json      celprocessen als stappenreeks
│       └── repository.py       laadt en valideert de JSON-bestanden
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   │   ├── favicon.svg, icon-*.png
│   │   ├── manifest.webmanifest   app-manifest (installeerbaar)
│   │   └── sw.js                  service worker (offline)
│   └── src/
│       ├── main.jsx, App.jsx   router: /, /viewer/:cellId, /intracellulair/:cellId, /proces/:cellId, /vergelijk, /begrippen
│       ├── i18n/               strings.js (NL/EN interface-teksten), index.jsx (LanguageProvider, useLang)
│       ├── api.js              client voor de API (met offline-terugval)
│       ├── styles.css          thema en lay-out
│       ├── pages/
│       │   ├── HomePage.jsx            celkeuze met live 3D-voorbeeld
│       │   ├── ViewerPage.jsx          3D-viewer (van buiten)
│       │   ├── IntracellularPage.jsx   intracellulaire modus (van binnen)
│       │   ├── ProcessPage.jsx         processen, stap voor stap
│       │   ├── ComparePage.jsx         dierlijke cel en plantencel naast elkaar
│       │   ├── GlossaryPage.jsx        begrippenlijst met zoekvak
│       │   └── QuizPage.jsx            organellenquiz (celkeuze, spel, uitslag)
│       ├── components/
│       │   ├── CellExperience.jsx      gedeelde lay-out en toestand van viewer en intracellulair
│       │   ├── ProcessExperience.jsx   lay-out en toestand van de processenpagina
│       │   ├── SiteHeader.jsx          kop van de pagina's zonder 3D-podium
│       │   ├── CellViewer.jsx          React-wrapper om de Three.js-scène
│       │   ├── OrganelleButtons.jsx    de groene organelknoppen
│       │   ├── ExplanationPanel.jsx    het inschuivende uitlegpaneel (met "Meer uitleg")
│       │   ├── RichText.jsx            tekst met klikbare begrippen en definitiekaartje
│       │   ├── TopBar.jsx              terugknop, cel-dropdown, weergavekeuze, API-status
│       │   ├── ViewerControls.jsx      auto-rotatie, cel openen/sluiten, beginstand, rondleiding
│       │   └── ApiStatus.jsx
│       ├── ui/                 Button, Dropdown, Spinner
│       ├── hooks/              useCells, useCellData, useGlossary, useFetch
│       ├── ui/LanguageSwitch.jsx  NL | EN
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
| `GET /glossary` | Alle begrippen (term + definitie) die in de langere uitleg klikbaar zijn |
| `GET /glossary/{term_id}` | Eén begrip |
| `GET /comparison` | Verschillentabel dierlijke cel / plantencel |
| `GET /processes` | Alle processen als stappenreeks |
| `GET /processes?cell_id=darmcel` | Alleen de processen die in die cel te zien zijn |
| `GET /processes/{process_id}` | Eén proces |
| `GET /health` | Draait de API? |

Elk endpoint accepteert `?lang=nl` (standaard) of `?lang=en`. Alleen de teksten veranderen; id's, kleuren en posities zijn taalonafhankelijk.

Cel-id's: `hartcel`, `darmcel`, `plantencel`, `bacterie`.
Organel-id's: `celmembraan`, `celwand`, `celnucleus`, `nucleolus`, `mitochondrien`, `ribosomen`, `golgi`, `ruw_er`, `glad_er`, `lysosomen`, `centriolen`, `microvilli`, `chloroplasten`, `vacuole`, en voor de bacterie `kapsel`, `bacteriewand`, `nucleoide`, `plasmiden`, `flagel`, `pili`.
Celtypes (`type` en `cell_types`): `dierlijk`, `plantaardig`, `prokaryoot`.

Voorbeeld van een organelplaatsing uit `GET /cells/hartcel`:

```json
{
  "organelle_id": "mitochondrien",
  "positions": [[0.4, 0.1, 0.1], [0.3, -0.2, 0.2], [0.1, -0.4, -0.1], [-0.3, 0.3, 0.1], [-0.4, -0.1, -0.2]],
  "random": { "count": 14, "range": 0.5 }
}
```

`positions` zijn de vaste posities uit de les, `random` vult aan met willekeurig geplaatste exemplaren binnen ±`range`. Organellen met een vaste grootte (membraan, celkern, nucleolus, celwand) hebben daarnaast een `scale`.

### Twee talen

Elke tekst in de JSON-bestanden is een object met beide talen:

```json
"name": { "nl": "Celwand", "en": "Cell wall" }
```

De backend kiest één taal per aanvraag (`?lang=`), met Nederlands als terugval wanneer een Engelse tekst ontbreekt. De teksten van de interface zelf (knoppen, koppen, meldingen) staan in `frontend/src/i18n/strings.js`; een derde taal toevoegen is daar een extra blok plus een extra sleutel in de JSON-bestanden.

### Langere uitleg en klikbare begrippen

Elke uitleg in `explanations.json` heeft naast de korte `text` ook een langere `details`. Die verschijnt in het paneel achter de knop **Meer uitleg**. Woorden tussen dubbele haken verwijzen naar `glossary.json` en worden klikbaar; wie erop tikt, ziet de definitie in een kaartje onder de tekst.

```json
{
  "organelle_id": "celwand",
  "text": "bescherming + structuur",
  "details": "De celwand is opgebouwd uit [[cellulose]]. Kleine [[porien|poriën]] maken de wand doorlaatbaar …"
}
```

- `[[cellulose]]` toont de term uit `glossary.json` (met kleine letter midden in een zin).
- `[[porien|poriën]]` toont het label na de `|`, handig voor tekens of meervouden.

Een nieuw begrip toevoegen: zet het in `glossary.json` (`id`, `term`, `definition`) en gebruik het `id` tussen haken. De backend weigert bij het opstarten uitleg die naar een onbekend `id` verwijst.

### Processen

`processes.json` bevat per proces een naam, een samenvatting, de cellen waarin het te zien is en een lijst stappen. Elke stap hoort bij één organel; de tekst mag dezelfde `[[begrippen]]` gebruiken als de uitleg. De frontend laat de camera van stap naar stap vliegen en tekent de route als lichtgevende lijn met bewegende deeltjes. Een stap bij het celmembraan of de celwand begint op het oppervlak van de cel, aan de kant van de volgende stap.

```json
{
  "id": "fotosynthese",
  "name": { "nl": "Fotosynthese", "en": "Photosynthesis" },
  "summary": { "nl": "…", "en": "…" },
  "cells": ["plantencel"],
  "steps": [
    { "organelle_id": "celwand", "title": { "nl": "…", "en": "…" }, "text": { "nl": "… [[porien|poriën]] …", "en": "…" } }
  ]
}
```

De backend controleert bij het opstarten dat elke stap een organel noemt dat ook echt in die cellen zit.

### Vergelijking

`comparison.json` is de verschillentabel: per rij een label, de tekst voor de drie celtypes (`animal_text`, `plant_text`, `bacteria_text`) en optioneel `animal`/`plant`/`bacteria` (true, false of null voor "niet van toepassing") en een `organelle_id` om de rij aan een organel te koppelen.

### De bacterie

De bacterie is een gewone cel in `cells.json` met `type: "prokaryoot"` en een langwerpige `ellipsoid`. Haar eigen structuren hebben een 3D-fabriek in `organelles.js`: `nucleoide` (torus-knoop), `plasmiden` (ringen), `flagel` (spiraal met motor); `pili` worden als instanced mesh over het oppervlak gestrooid; `kapsel` en `bacteriewand` zijn extra schillen naast het membraan. Ze is op dezelfde grootte getekend als de andere cellen; in werkelijkheid is ze honderd keer kleiner (zie de rij "Grootte" in de vergelijking).

### Gegevens aanpassen

Alle inhoud staat in `backend/data/*.json`. Voeg je een organel toe, zet het dan in alle drie de bestanden (`organelles.json`, `explanations.json` en de betreffende cel in `cells.json`). De backend controleert bij het opstarten of alles op elkaar aansluit en meldt anders precies wat er ontbreekt. De frontend heeft voor elk organel een 3D-fabriek in `src/three/organelles.js`; een onbekend organel wordt als eenvoudige bol getekend.

## Bediening

| Actie | Hoe |
|---|---|
| Cel draaien / zoomen | slepen, scrollen of knijpen (OrbitControls) |
| Organel bekijken | klik erop in 3D of druk op de groene knop; de camera zoomt ernaartoe en het organel licht op |
| Volgend / vorig organel | knoppen in het paneel of de pijltjestoetsen ← → |
| Meer lezen | knop "Meer uitleg" in het paneel; tik op een gekleurd woord voor de definitie |
| Paneel sluiten | ✕ of `Esc` |
| Cel openen / sluiten | knop onderaan (alleen in de 3D-viewer) |
| Andere cel of weergave | dropdown en weergavekeuze in de bovenbalk |
| Rondleiding (intracellulair) | knop "Rondleiding starten" vliegt van organel naar organel |
| Processen | derde weergave in de bovenbalk; kies een proces, loop met "Volgende stap" of "Afspelen" door de stappen (ook met ← →) |
| Taal | NL / EN rechtsboven, wordt onthouden; `?lang=en` in een link forceert Engels |
| Rechtstreeks naar een organel | `/viewer/plantencel?organel=golgi` opent de plantencel met het Golgi-apparaat geselecteerd |
| Installeren als app | Chrome/Edge: adresbalk → installeren; iPhone: Deel → Zet op beginscherm |
| Quiz | `/quiz`: kies spelvorm en cellen. Fout = +3 s, overslaan = +5 s. Bij *Vind het organel* verschijnt de naam niet bij de muis en worden ribosomen niet gevraagd (te klein om eerlijk aan te klikken). *Welke cel is dit?* vraagt minstens twee cellen. Beste tijd per spelvorm en celkeuze staat in de browser (localStorage). |
| Namen tonen | schakelaar onderaan de 3D-weergave; labels schuiven uit elkaar als ze overlappen en zijn klikbaar. Keuze wordt onthouden. |

## Ontwerpkeuzes

**Posities uit de les vs. overlap.** De API levert de posities en schalen *exact* zoals in de opdracht. Enkele daarvan overlappen in 3D (het Golgi-apparaat en een paar mitochondriën liggen bijvoorbeeld binnen de straal van de celkern). De frontend gebruikt de posities daarom als *ankerpunt* en verschuift organellen alleen zover als nodig is om elkaar niet te doorsnijden (maximaal ongeveer 0,3 eenheid; celkern, nucleolus en vacuole blijven op hun plek). Dat gebeurt deterministisch, dus dezelfde cel ziet er elke keer hetzelfde uit. Wil je de ruwe posities zien, zet dan `RESOLVE_OVERLAPS` in `frontend/src/three/layout.js` op `false`. In het uitlegpaneel staan onder "Posities in de cel" altijd de oorspronkelijke waarden uit de API.

**Cel openen.** Het membraan (en bij de plantencel de celwand en bij de darmcel de microvilli) wordt met twee clipping planes opengesneden in het kwadrant x > 0, z > 0. Organellen met een doorsnede (celkern, mitochondriën met cristae, chloroplasten met grana) zijn in datzelfde kwadrant opengewerkt, zodat je er ook echt in kijkt.

**Glow.** Een geselecteerd organel krijgt een pulserende emissive-kleur plus een zachte lichtkring (additieve sprites) in de accentkleur `#00E5FF`. Bij hover licht het licht op en verschijnt de naam.

**Intracellulaire modus.** Dezelfde cel, maar de camera staat binnen het membraan (brede lens, lichte mist, zwevende stofdeeltjes). De camera kan niet door organellen of door het membraan heen; het membraan en de wand zijn van binnen iets minder doorzichtig zodat je de rand van de cel blijft zien.

**Offline-terugval.** Draait de backend niet, dan laadt de frontend dezelfde JSON-bestanden rechtstreeks uit `backend/data/` en toont "Offline gegevens" met een knop om opnieuw te verbinden. Zo werkt de viewer in de klas ook zonder Python.

**PWA.** `public/sw.js` bewaart de app-schil en de gebouwde bestanden in de browsercache en beantwoordt API-aanvragen uit de cache terwijl hij op de achtergrond ververst. Na één online bezoek opent de site dus ook zonder internet; de ingebouwde JSON-kopie zorgt dat de 3D-weergave dan nog werkt. De service worker wordt alleen in de productie-build geregistreerd (`npm run build`), niet tijdens `npm run dev`. Verhoog `VERSION` in `sw.js` als je de cache wilt leegmaken bij bezoekers.

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
