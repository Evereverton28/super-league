const API = "http://127.0.0.1:5000";
let db;
let _unsaved = false;
let _undoStack = [];
const UNDO_LIMIT = 20;

/* =========================
   UNDO
========================= */
function pushUndo() {
    _undoStack.push(JSON.stringify(db));
    if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
    updateUndoBtn();
}

function undo() {
    if (_undoStack.length === 0) return;
    db = JSON.parse(_undoStack.pop());
    updateUndoBtn();
    resetStats();
    calculateResults();
    calculateCleanSheets();
    if (document.getElementById('table'))        { sortTable(); renderTable(); }
    if (document.getElementById('fixtures'))     renderFixtures();
    if (document.getElementById('top-scorers'))  renderStatTable('top-scorers',  'scorers_goals',   'Top Scorers');
    if (document.getElementById('top-assists'))  renderStatTable('top-assists',  'scorers_assists',  'Top Assists');
    if (document.getElementById('yellow-cards')) renderStatTable('yellow-cards', 'scorers_yellow',  'Yellow Cards');
    if (document.getElementById('red-cards'))    renderStatTable('red-cards',    'scorers_red',     'Red Cards');
    if (document.getElementById('clean-sheets')) renderStatTable('clean-sheets', 'scorers_cleansheets', 'Clean Sheets');
    markUnsaved();
}

function updateUndoBtn() {
    const btn = document.getElementById('undo-btn');
    if (!btn) return;
    btn.disabled = _undoStack.length === 0;
    btn.title = _undoStack.length > 0
        ? `Undo (${_undoStack.length} step${_undoStack.length > 1 ? 's' : ''} available)`
        : 'Nothing to undo';
}

document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
});

/* =========================
   SAVE ENGINE (manual only)
========================= */
function markUnsaved() {
    _unsaved = true;
    const btn = document.getElementById('save-btn');
    if (btn) {
        btn.textContent = 'Save';
        btn.classList.add('unsaved');
        btn.disabled = false;
    }
}

async function save() {
    const btn = document.getElementById('save-btn');
    if (btn) {
        btn.textContent = 'Saving...';
        btn.classList.remove('unsaved');
        btn.disabled = true;
    }
    try {
        await fetch(`${API}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(db)
        });
        _unsaved = false;
        if (btn) {
            btn.textContent = 'Saved';
            btn.classList.add('saved');
            setTimeout(() => {
                btn.textContent = 'Saved';
                btn.classList.remove('saved');
                btn.disabled = false;
            }, 2000);
        }
    } catch (e) {
        if (btn) {
            btn.textContent = 'Save Failed';
            btn.classList.add('error');
            btn.disabled = false;
            setTimeout(() => {
                btn.textContent = 'Save';
                btn.classList.remove('error');
                btn.classList.add('unsaved');
            }, 2500);
        }
    }
}

/* =========================
   UNSAVED CHANGES MODAL
========================= */
let _pendingNav = null;

function showUnsavedModal(onSave, onDiscard, onCancel) {
    document.getElementById('unsaved-modal').style.display = 'flex';
    document.getElementById('modal-save-btn').onclick = onSave;
    document.getElementById('modal-discard-btn').onclick = onDiscard;
    document.getElementById('modal-cancel-btn').onclick = onCancel;
}

function hideUnsavedModal() {
    document.getElementById('unsaved-modal').style.display = 'none';
    _pendingNav = null;
}

function navigateWithCheck(href) {
    if (!_unsaved) { location.href = href; return; }
    showUnsavedModal(
        async () => { hideUnsavedModal(); await save(); location.href = href; },
        ()       => { _unsaved = false; hideUnsavedModal(); location.href = href; },
        ()       => { hideUnsavedModal(); }
    );
}

window.addEventListener('beforeunload', e => {
    if (_unsaved) { e.preventDefault(); e.returnValue = ''; }
});

/* =========================
   EXPORT CSV
========================= */
function exportCSV() {
    let csv = '';

    csv += 'LEAGUE TABLE\n';
    csv += 'Pos,Team,P,W,D,L,GF,GA,GD,Pts,Form\n';
    const form = calculateForm();
    db.table.forEach(t => {
        const f = (form[t.team] || []).join(' ');
        csv += `${t.pos},"${t.team}",${t.played},${t.won},${t.drawn},${t.lost},${t.gf},${t.ga},${t.gd},${t.pts},"${f}"\n`;
    });

    csv += '\nTOP SCORERS\nRank,Player,Club,Goals\n';
    [...db.scorers_goals].sort((a,b) => (b.value||0)-(a.value||0)).forEach((s,i) => {
        csv += `${i+1},"${s.player}","${s.club}",${s.value||0}\n`;
    });

    csv += '\nTOP ASSISTS\nRank,Player,Club,Assists\n';
    [...db.scorers_assists].sort((a,b) => (b.value||0)-(a.value||0)).forEach((s,i) => {
        csv += `${i+1},"${s.player}","${s.club}",${s.value||0}\n`;
    });

    csv += '\nYELLOW CARDS\nRank,Player,Club,Cards\n';
    [...db.scorers_yellow].sort((a,b) => (b.value||0)-(a.value||0)).forEach((s,i) => {
        csv += `${i+1},"${s.player}","${s.club}",${s.value||0}\n`;
    });

    csv += '\nRED CARDS\nRank,Player,Club,Cards\n';
    [...db.scorers_red].sort((a,b) => (b.value||0)-(a.value||0)).forEach((s,i) => {
        csv += `${i+1},"${s.player}","${s.club}",${s.value||0}\n`;
    });

    csv += '\nCLEAN SHEETS\nRank,Player,Club,Clean Sheets\n';
    [...db.scorers_cleansheets].sort((a,b) => (b.value||0)-(a.value||0)).forEach((s,i) => {
        csv += `${i+1},"${s.player}","${s.club}",${s.value||0}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `league-export-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

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
                allMatches.push({
                    home: teams[i], away: teams[j],
                    homeGoals: null, awayGoals: null,
                    played: false
                });
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
   FORM CALCULATION
========================= */
function calculateForm() {
    const history = {};
    db.table.forEach(t => history[t.team] = []);
    db.fixtures.forEach(matchday => {
        matchday.forEach(f => {
            if (!f.played || f.homeGoals === null || f.awayGoals === null) return;
            const hg = Number(f.homeGoals);
            const ag = Number(f.awayGoals);
            if (hg > ag) {
                history[f.home].push('W'); history[f.away].push('L');
            } else if (ag > hg) {
                history[f.home].push('L'); history[f.away].push('W');
            } else {
                history[f.home].push('D'); history[f.away].push('D');
            }
        });
    });
    const form = {};
    Object.keys(history).forEach(team => { form[team] = history[team].slice(-5); });
    return form;
}

/* =========================
   CLEAN SHEETS CALCULATION
========================= */
function calculateCleanSheets() {
    const csMap = {};
    db.table.forEach(t => csMap[t.team.trim().toLowerCase()] = 0);
    db.fixtures.forEach(matchday => {
        matchday.forEach(f => {
            if (!f.played || f.homeGoals === null || f.awayGoals === null) return;
            const home = f.home.trim().toLowerCase();
            const away = f.away.trim().toLowerCase();
            if (Number(f.awayGoals) === 0) csMap[home] = (csMap[home] || 0) + 1;
            if (Number(f.homeGoals) === 0) csMap[away] = (csMap[away] || 0) + 1;
        });
    });
    db.scorers_cleansheets.forEach(entry => {
        const key = (entry.club || '').trim().toLowerCase();
        entry.value = csMap[key] || 0;
    });
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
    const form = calculateForm();
    let html = `
        <thead><tr>
            <th>Pos</th><th>Team</th>
            <th>P</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
            <th>Form</th>
        </tr></thead><tbody>
    `;
    db.table.forEach(t => {
        const teamForm = form[t.team] || [];
        const formHTML = teamForm.map(r => `<span class="form-badge form-${r}">${r}</span>`).join('');
        html += `<tr>
            <td>${t.pos}</td>
            <td class="team-name">${t.team}</td>
            <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
            <td>${t.gf}</td><td>${t.ga}</td><td>${t.gd}</td>
            <td class="pts">${t.pts}</td>
            <td class="form-cell">${formHTML}</td>
        </tr>`;
    });
    document.getElementById('table').innerHTML = html + '</tbody>';
}

/* =========================
   FIXTURES
========================= */
function renderFixtures() {
    let html = '';
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
                <td><input type="checkbox" ${f.played ? 'checked' : ''}
                    onchange="togglePlayed(${mdIndex},${i})"></td>
            </tr>`;
        });
        html += `</tbody></table>`;
    });
    document.getElementById('fixtures').innerHTML = html;
}

/* =========================
   STAT TABLES
========================= */
const _searches    = {};
const _initialized = {};

function renderStatTable(id, key, title) {
    const container  = document.getElementById(id);
    const isComputed = (key === 'scorers_cleansheets');

    if (!_initialized[id]) {
        container.innerHTML = `
            <div class="section-header">
                <h2>${title}</h2>
                ${isComputed
                    ? '<span class="computed-label">Auto-calculated</span>'
                    : `<button class="add-btn" onclick="addEntry('${key}','${id}','${title}')">+ Add Player</button>`
                }
            </div>
            <div class="search-bar">
                <span class="search-icon">⌕</span>
                <input type="text" class="search-input" placeholder="Search player or club..."
                    oninput="handleSearch('${id}','${key}','${title}',this.value)" />
                <button class="search-clear" id="clear-${id}"
                    onclick="clearSearch('${id}','${key}','${title}')" style="display:none">✕</button>
            </div>
            <p class="search-empty" id="empty-${id}" style="display:none"></p>
            <table>
                <thead><tr>
                    <th>#</th><th>Player</th><th>Club</th><th>Value</th>
                    ${!isComputed ? '<th></th>' : ''}
                </tr></thead>
                <tbody id="tbody-${id}"></tbody>
            </table>
        `;
        _initialized[id] = true;
    }

    const list = db[key];
    list.sort((a, b) =>
        ((b.value || 0) - (a.value || 0)) ||
        (a.club   || '').localeCompare(b.club   || '') ||
        (a.player || '').localeCompare(b.player || '')
    );

    const query = (_searches[id] || '').toLowerCase().trim();
    const filtered = query
        ? list.filter(s =>
            (s.player || '').toLowerCase().includes(query) ||
            (s.club   || '').toLowerCase().includes(query))
        : list;

    const rankMap = new Map(list.map((s, i) => [s, i + 1]));

    const clearBtn = document.getElementById(`clear-${id}`);
    if (clearBtn) clearBtn.style.display = query ? 'inline-block' : 'none';

    const emptyEl = document.getElementById(`empty-${id}`);
    if (emptyEl) {
        emptyEl.style.display = (query && filtered.length === 0) ? 'block' : 'none';
        if (query && filtered.length === 0)
            emptyEl.innerHTML = `No results for "<strong>${query}</strong>"`;
    }

    let rows = '';
    filtered.forEach(s => {
        const origIdx = list.indexOf(s);
        rows += `<tr>
            <td>${rankMap.get(s)}</td>
            <td>${isComputed
                ? `<span class="player-name-text">${s.player}</span>`
                : `<input value="${s.player}"
                    onblur="updateStat('${key}',${origIdx},'player',this.value,'${id}','${title}')">`
            }</td>
            <td>${isComputed
                ? `<span class="player-name-text">${s.club}</span>`
                : `<select onchange="updateStat('${key}',${origIdx},'club',this.value,'${id}','${title}')">
                    <option value="">--</option>${teamOptions(s.club)}</select>`
            }</td>
            <td>${isComputed
                ? `<span class="computed-value">${s.value || 0}</span>`
                : `<input type="number" value="${s.value || 0}"
                    onblur="updateStat('${key}',${origIdx},'value',this.value,'${id}','${title}')">`
            }</td>
            ${!isComputed ? `<td><button onclick="removeEntry('${key}',${origIdx},'${id}','${title}')">X</button></td>` : ''}
        </tr>`;
    });

    document.getElementById(`tbody-${id}`).innerHTML = rows;
}

function handleSearch(id, key, title, value) {
    _searches[id] = value;
    renderStatTable(id, key, title);
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
        `<option value="${t.team}" ${t.team === selected ? 'selected' : ''}>${t.team}</option>`
    ).join('');
}

function updateStat(key, i, field, value, id, title) {
    pushUndo();
    db[key][i][field] = field === 'value' ? Number(value) : value;
    renderStatTable(id, key, title);
    markUnsaved();
}

function addEntry(key, id, title) {
    pushUndo();
    db[key].push({ player: 'New Player', club: '', value: 0 });
    renderStatTable(id, key, title);
    markUnsaved();
}

function removeEntry(key, i, id, title) {
    pushUndo();
    db[key].splice(i, 1);
    renderStatTable(id, key, title);
    markUnsaved();
}

/* =========================
   FIXTURES EDIT
========================= */
function setScore(md, i, field, value) {
    pushUndo();
    const f = db.fixtures[md][i];
    f[field] = value === '' ? null : Number(value);
    if (f.homeGoals !== null && f.awayGoals !== null) f.played = true;
    calculateCleanSheets();
    renderFixtures();
    markUnsaved();
}

function togglePlayed(md, i) {
    pushUndo();
    db.fixtures[md][i].played = !db.fixtures[md][i].played;
    calculateCleanSheets();
    renderFixtures();
    markUnsaved();
}