# Football League Manager

A local, browser-based football league management dashboard. Track standings, results, fixtures, player stats, discipline records, and clean sheets — all saved to a lightweight JSON backend.

---

## Project Structure

```
.
├── backend/
│   ├── app.py              # Flask API server
│   ├── data.py             # Initial data seed (teams, empty table)
│   ├── db.json             # Live database (JSON flat file)
│   └── requirements.txt    # Python dependencies
│
└── frontend/
    ├── index.html          # League Table page
    ├── fixtures.html       # Fixtures & Results page
    ├── stats.html          # Top Scorers & Assists page
    ├── discipline.html     # Yellow & Red Cards page
    ├── cleansheets.html    # Clean Sheets page
    ├── nav.js              # Shared navigation renderer
    ├── script.js           # All application logic
    └── style.css           # Full UI styling
```

---

## Getting Started

### 1. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

`requirements.txt` includes:
- `flask`
- `flask-cors`

### 2. Start the backend

```bash
cd backend
python app.py
```

The server runs at `http://127.0.0.1:5000`. Keep this terminal open while using the app.

### 3. Open the frontend

Open `frontend/index.html` in your browser. No build step or bundler required — it's plain HTML, CSS, and JavaScript.

> **Note:** Open via a local server or directly from the filesystem. The app communicates with the Flask API on port 5000, so both must be running simultaneously.

---

## Pages

| Page | File | Description |
|---|---|---|
| League Table | `index.html` | Live standings sorted by points, goal difference, goals scored |
| Fixtures | `fixtures.html` | Full match schedule across all matchdays, with score entry |
| Stats | `stats.html` | Top scorers and top assist providers |
| Discipline | `discipline.html` | Yellow card and red card leaderboards |
| Clean Sheets | `cleansheets.html` | Goalkeeper/defensive clean sheet records |

---

## Features

### League Table
- Auto-calculated from fixture results (played, won, drawn, lost, GF, GA, GD, points)
- Sorted by: points → goal difference → goals scored → alphabetical
- Top 3 positions highlighted with gold, silver, bronze
- Bottom 3 positions flagged as the relegation zone

### Fixtures & Results
- Full double round-robin schedule auto-generated on first load (every team plays every other team home and away)
- Enter home and away goals — the match is automatically marked as played when both scores are filled
- Checkbox to manually toggle played status
- Each matchday is its own table block for clarity

### Player Stat Tables (Scorers, Assists, Cards, Clean Sheets)
- Add and remove players freely
- Assign each player to a club via dropdown
- Sorted by value descending; ties broken by club name alphabetically, then player name alphabetically
- **Live search** — filter by player name or club without losing your cursor or triggering a save

### Autosave
- Any data change (score, checkbox, player edit, add, remove) triggers a 1.5 second debounce autosave
- Save button cycles through states: **Unsaved** (gold pulse) → **Saving...** → **Saved** (green) → resets
- If the save fails, the button returns to **Unsaved** so you know to retry
- Leaving the page with unsaved changes triggers a browser warning

---

## Backend API

The Flask server exposes two endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/data` | Returns the full `db.json` contents |
| `POST` | `/update` | Overwrites `db.json` with the request body |

All state lives in `db.json`. The frontend loads it once on page load and sends the full updated object back on every save.

---

## Data Shape (`db.json`)

```json
{
  "table": [
    {
      "pos": 1,
      "team": "Manchester City",
      "played": 0, "won": 0, "drawn": 0, "lost": 0,
      "gf": 0, "ga": 0, "gd": 0, "pts": 0
    }
  ],
  "fixtures": [
    [
      { "home": "Team A", "away": "Team B", "homeGoals": null, "awayGoals": null, "played": false }
    ]
  ],
  "scorers_goals":       [{ "player": "Name", "club": "Team", "value": 0 }],
  "scorers_assists":     [],
  "scorers_yellow":      [],
  "scorers_red":         [],
  "scorers_cleansheets": []
}
```

`fixtures` is an array of matchdays. Each matchday is an array of match objects.

---

## Frontend Architecture

All logic lives in `script.js`. The key separation is:

- **`load()`** — fetches data from the API and initialises missing fields
- **`generateFixtures()`** — builds the full round-robin schedule on first load if `fixtures` is empty
- **`resetStats()` + `calculateResults()`** — recompute the table from scratch on every render to avoid stale accumulation
- **`renderTable()`** — builds the league table HTML
- **`renderFixtures()`** — builds one `<table>` per matchday, inserted into a `<div>` container
- **`renderStatTable()`** — renders the shell (header, search bar, table frame) once, then only updates `<tbody>` on subsequent calls to preserve the search input's focus and cursor position
- **`markUnsaved()` + `autoSave()`** — debounced save engine; every data-mutating function calls `markUnsaved()` which sets a 1.5s timer

Navigation is handled by `nav.js`, which renders the nav bar on every page and detects the active page from `location.pathname`.

---

## Customising Teams

To change the team list, edit `backend/data.py` and update the `teams` array, then delete `db.json` and restart the server. A fresh `db.json` will be generated with the new teams and a blank fixture schedule.

---

## Known Limitations

- **Single user only** — no conflict handling. If two browser tabs are open and both save, the last write wins.
- **No authentication** — the API has no access control. It is intended for local/LAN use only.
- **Flat file storage** — `db.json` has no versioning or backup. Back it up manually before making large changes.
- **Player stats are manual** — goals and assists are entered by hand; they are not derived from match results.