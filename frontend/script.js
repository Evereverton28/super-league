const API = "http://127.0.0.1:5000";
let db;
let _saveTimer = null;
let _unsaved = false;

/* =========================
   AUTOSAVE ENGINE
========================= */
function markUnsaved() {
    _unsaved = true;
    const btn = document.getElementById("save-btn");
    if (btn) {
        btn.textContent = "Unsaved";
        btn.classList.add("unsaved");
        btn.disabled = false;
    }
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => autoSave(), 1500);
}

async function autoSave() {
    if (!_unsaved) return;
    const btn = document.getElementById("save-btn");
    if (btn) {
        btn.textContent = "Saving...";
        btn.classList.remove("unsaved");
        btn.disabled = true;
    }
    try {
        await fetch(`${API}/update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(db)
        });
        _unsaved = false;
        if (btn) {
            btn.textContent = "Saved";
            btn.classList.add("saved");
            setTimeout(() => {
                btn.textContent = "Saved";
                btn.classList.remove("saved");
                btn.disabled = false;
            }, 2000);
        }
    } catch (e) {
        if (btn) {
            btn.textContent = "Save Failed";
            btn.classList.add("error");
            btn.disabled = false;
            setTimeout(() => {
                btn.textContent = "Unsaved";
                btn.classList.remove("error");
                btn.classList.add("unsaved");
            }, 2500);
        }
    }
}

/* Manual save button still works */
async function save() {
    clearTimeout(_saveTimer);
    await autoSave();
}

/* Warn if leaving with unsaved changes */
window.addEventListener("beforeunload", e => {
    if (_unsaved) { e.preventDefault(); e.returnValue = ''; }
});

/* =========================
   LOAD DATA
========================= */
async function load() {
    const res = await fetch(`${API}/data`);
    db = await res.json();

    db.scorers_goals       ??= [];
    db.scorers_assists     ??= [];
    db.scorers_yellow      ??= [];
    db.scorers_red         ??= [];
    db.scorers_cleansheets ??= [];

    if (!db.fixtures || db.fixtures.length === 0) {
        const teams = db.table.map(t => t.team);
        db.fixtures = generateFixtures(teams);
    }
}

/* =========================
   FIXTURE GENERATION
========================= */
function generateFixtures(teams) {
    const allMatches = [];
    for (let i = 0; i < teams.length; i++) {
        for (let j = 0; j < teams.length; j++) {
            if (i !== j) {
                allMatches.push({ home: teams[i], away: teams[j], homeGoals: null, awayGoals: null, played: false });
            }
        }
    }
    const matchdays = [];
    const used = new Array(allMatches.length).fill(false);
    while (true) {
        const day = [];
        const teamsThisDay = new Set();
        for (let i = 0; i < allMatches.length; i++) {
            if (used[i]) continue;
            const m = allMatches[i];
            if (teamsThisDay.has(m.home) || teamsThisDay.has(m.away)) continue;
            day.push(m);
            teamsThisDay.add(m.home);
            teamsThisDay.add(m.away);
            used[i] = true;
            if (day.length === 8) break;
        }
        if (day.length === 0) break;
        matchdays.push(day);
    }
    return matchdays;
}

/* =========================
   RESET STATS
========================= */
function resetStats() {
    db.table.forEach(t => {
        t.played = 0; t.won = 0; t.drawn = 0; t.lost = 0;
        t.gf = 0; t.ga = 0; t.gd = 0; t.pts = 0;
    });
}

/* =========================
   RESULTS CALCULATION
========================= */
function calculateResults() {
    db.fixtures.forEach(matchday => {
        matchday.forEach(f => {
            if (!f.played || f.homeGoals === null || f.awayGoals === null) return;
            const home = db.table.find(t => t.team === f.home);
            const away = db.table.find(t => t.team === f.away);
            const hg = Number(f.homeGoals);
            const ag = Number(f.awayGoals);
            home.played++; away.played++;
            home.gf += hg; home.ga += ag;
            away.gf += ag; away.ga += hg;
            if (hg > ag)      { home.won++;   away.lost++;  home.pts += 3; }
            else if (ag > hg) { away.won++;   home.lost++;  away.pts += 3; }
            else               { home.drawn++; away.drawn++; home.pts++;    away.pts++; }
        });
    });
    db.table.forEach(t => t.gd = t.gf - t.ga);
}

/* =========================
   SORT TABLE
========================= */
function sortTable() {
    db.table.sort((a, b) =>
        (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf) || a.team.localeCompare(b.team)
    );
    db.table.forEach((t, i) => t.pos = i + 1);
}

/* =========================
   LEAGUE TABLE
========================= */
function renderTable() {
    let html = `
        <thead><tr>
            <th>Pos</th><th>Team</th>
            <th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
        </tr></thead><tbody>
    `;
    db.table.forEach(t => {
        html += `<tr>
            <td>${t.pos}</td>
            <td class="team-name">${t.team}</td>
            <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
            <td>${t.gf}</td><td>${t.ga}</td><td>${t.gd}</td>
            <td class="pts">${t.pts}</td>
        </tr>`;
    });
    document.getElementById("table").innerHTML = html + "</tbody>";
}

/* =========================
   FIXTURES
========================= */
function renderFixtures() {
    let html = "";
    db.fixtures.forEach((matchday, mdIndex) => {
        html += `
        <table class="matchday-table">
            <thead>
                <tr class="matchday-row"><th colspan="5">Matchday ${mdIndex + 1}</th></tr>
                <tr><th>Home</th><th>Away</th><th>HG</th><th>AG</th><th>&#10003;</th></tr>
            </thead>
            <tbody>
        `;
        matchday.forEach((f, i) => {
            html += `<tr>
                <td class="team-name">${f.home}</td>
                <td class="team-name">${f.away}</td>
                <td><input type="number" min="0" value="${f.homeGoals ?? ''}"
                    onchange="setScore(${mdIndex},${i},'homeGoals',this.value)"></td>
                <td><input type="number" min="0" value="${f.awayGoals ?? ''}"
                    onchange="setScore(${mdIndex},${i},'awayGoals',this.value)"></td>
                <td><input type="checkbox" ${f.played ? "checked" : ""}
                    onchange="togglePlayed(${mdIndex},${i})"></td>
            </tr>`;
        });
        html += `</tbody></table>`;
    });
    document.getElementById("fixtures").innerHTML = html;
}

/* =========================
   STAT TABLES WITH SEARCH
========================= */
const _searches = {};
const _initialized = {};

function renderStatTable(id, key, title) {
    const container = document.getElementById(id);

    /* Build the shell once — search input is NEVER rebuilt after this */
    if (!_initialized[id]) {
        container.innerHTML = `
            <div class="section-header">
                <h2>${title}</h2>
                <button class="add-btn" onclick="addEntry('${key}','${id}','${title}')">+ Add Player</button>
            </div>
            <div class="search-bar">
                <span class="search-icon">⌕</span>
                <input
                    type="text"
                    class="search-input"
                    placeholder="Search player or club..."
                    oninput="handleSearch('${id}','${key}','${title}',this.value)"
                />
                <button class="search-clear" id="clear-${id}" onclick="clearSearch('${id}','${key}','${title}')" style="display:none">✕</button>
            </div>
            <p class="search-empty" id="empty-${id}" style="display:none"></p>
            <table>
                <thead><tr><th>#</th><th>Player</th><th>Club</th><th>Value</th><th></th></tr></thead>
                <tbody id="tbody-${id}"></tbody>
            </table>
        `;
        _initialized[id] = true;
    }

    /* Sort */
    const list = db[key];
    list.sort((a, b) =>
        ((b.value || 0) - (a.value || 0)) ||
        (a.club || '').localeCompare(b.club || '') ||
        (a.player || '').localeCompare(b.player || '')
    );

    const query = (_searches[id] || '').toLowerCase().trim();
    const filtered = query
        ? list.filter(s =>
            (s.player || '').toLowerCase().includes(query) ||
            (s.club   || '').toLowerCase().includes(query)
          )
        : list;

    const rankMap = new Map(list.map((s, i) => [s, i + 1]));

    /* Update clear button visibility */
    const clearBtn = document.getElementById(`clear-${id}`);
    if (clearBtn) clearBtn.style.display = query ? 'inline-block' : 'none';

    /* Update empty message */
    const emptyEl = document.getElementById(`empty-${id}`);
    if (emptyEl) {
        if (query && filtered.length === 0) {
            emptyEl.style.display = 'block';
            emptyEl.innerHTML = `No results for "<strong>${query}</strong>"`;
        } else {
            emptyEl.style.display = 'none';
        }
    }

    /* Only rebuild tbody — search input untouched */
    let rows = '';
    filtered.forEach(s => {
        const origIdx = list.indexOf(s);
        rows += `<tr>
            <td>${rankMap.get(s)}</td>
            <td><input value="${s.player}"
                onblur="updateStat('${key}',${origIdx},'player',this.value,'${id}','${title}')"></td>
            <td>
                <select onchange="updateStat('${key}',${origIdx},'club',this.value,'${id}','${title}')">
                    <option value="">--</option>
                    ${teamOptions(s.club)}
                </select>
            </td>
            <td><input type="number" value="${s.value || 0}"
                onblur="updateStat('${key}',${origIdx},'value',this.value,'${id}','${title}')"></td>
            <td><button onclick="removeEntry('${key}',${origIdx},'${id}','${title}')">X</button></td>
        </tr>`;
    });

    document.getElementById(`tbody-${id}`).innerHTML = rows;
}

function handleSearch(id, key, title, value) {
    _searches[id] = value;
    renderStatTable(id, key, title);
    /* Search typing never triggers autosave */
}

function clearSearch(id, key, title) {
    _searches[id] = '';
    const input = document.querySelector(`#${id} .search-input`);
    if (input) input.value = '';
    renderStatTable(id, key, title);
}

/* =========================
   HELPERS
========================= */
function teamOptions(selected) {
    return db.table.map(t =>
        `<option value="${t.team}" ${t.team === selected ? "selected" : ""}>${t.team}</option>`
    ).join("");
}

function updateStat(key, i, field, value, id, title) {
    db[key][i][field] = field === "value" ? Number(value) : value;
    renderStatTable(id, key, title);
    markUnsaved();
}

function addEntry(key, id, title) {
    db[key].push({ player: "New Player", club: "", value: 0 });
    renderStatTable(id, key, title);
    markUnsaved();
}

function removeEntry(key, i, id, title) {
    db[key].splice(i, 1);
    renderStatTable(id, key, title);
    markUnsaved();
}

/* =========================
   FIXTURES EDIT
========================= */
function setScore(md, i, field, value) {
    const f = db.fixtures[md][i];
    f[field] = value === "" ? null : Number(value);
    if (f.homeGoals !== null && f.awayGoals !== null) f.played = true;
    renderFixtures();
    markUnsaved();
}

function togglePlayed(md, i) {
    db.fixtures[md][i].played = !db.fixtures[md][i].played;
    renderFixtures();
    markUnsaved();
}