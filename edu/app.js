const state = {
  classes: [],
  activeCode: 'HOME',
};

const tabsEl = document.getElementById('tabs');
const panelEl = document.getElementById('classPanel');
const toastEl = document.getElementById('toast');

// ---------- API ----------

// The frontend is served separately (e.g. `python -m http.server`), so API
// calls need the Node server's full address rather than a relative path.
const API_BASE = 'https://xh5qpk10-3000.auc1.devtunnels.ms';

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

async function loadData() {
  state.classes = await api('/api/classes').then(d => d.classes);
}

// ---------- Math ----------

function computeStats(cls) {
  const scoredItems = cls.items.filter(i => i.score != null);
  const pendingItems = cls.items.filter(i => i.score == null);

  const totalEnteredWeight = cls.items.reduce((s, i) => s + i.weight, 0);
  const scoredWeight = scoredItems.reduce((s, i) => s + i.weight, 0);
  const pendingWeight = pendingItems.reduce((s, i) => s + i.weight, 0);
  const unallocatedWeight = Math.max(0, 100 - totalEnteredWeight);

  // "remaining" = everything not yet graded: pending items + weight not yet logged at all
  const remainingWeight = Math.max(0, 100 - scoredWeight);

  const currentPoints = scoredItems.reduce((s, i) => s + (i.weight * i.score) / 100, 0);
  const currentAverage = scoredWeight > 0 ? (currentPoints / scoredWeight) * 100 : null;

  let projected = null;
  if (scoredWeight > 0) {
    projected = remainingWeight > 0
      ? currentPoints + (remainingWeight * currentAverage) / 100
      : currentPoints;
  }

  let neededAvg = null;
  let goalState = null; // 'met' | 'impossible' | 'possible' | 'no-room-short'
  if (remainingWeight === 0) {
    if (scoredWeight === 0) {
      goalState = null;
    } else if (currentPoints >= cls.goal - 1e-9) {
      goalState = 'met';
    } else {
      goalState = 'no-room-short';
    }
  } else {
    neededAvg = ((cls.goal - currentPoints) / remainingWeight) * 100;
    if (neededAvg <= 0) goalState = 'met';
    else if (neededAvg > 100) goalState = 'impossible';
    else goalState = 'possible';
  }

  return {
    totalEnteredWeight, scoredWeight, pendingWeight, unallocatedWeight, remainingWeight,
    currentPoints, currentAverage, projected, neededAvg, goalState,
  };
}

function computeOverall(classes) {
  const withStats = classes.map(cls => ({ cls, stats: computeStats(cls) }));
  const graded = withStats.filter(c => c.stats.scoredWeight > 0);

  if (graded.length === 0) {
    return { hasData: false, gradedCount: 0, total: classes.length };
  }

  const avgCurrent = graded.reduce((s, c) => s + c.stats.currentAverage, 0) / graded.length;
  const avgProjected = graded.reduce((s, c) => s + c.stats.projected, 0) / graded.length;

  return {
    hasData: true,
    gradedCount: graded.length,
    total: classes.length,
    avgCurrent,
    avgProjected,
  };
}

// ---------- Rendering ----------

function renderTabs() {
  tabsEl.innerHTML = '';

  const homeTab = document.createElement('button');
  homeTab.className = 'tab tab--home' + (state.activeCode === 'HOME' ? ' active' : '');
  homeTab.innerHTML = `Home<span class="tab-code">overview</span>`;
  homeTab.addEventListener('click', () => {
    state.activeCode = 'HOME';
    renderTabs();
    renderPanel();
  });
  tabsEl.appendChild(homeTab);

  state.classes.forEach(cls => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (cls.code === state.activeCode ? ' active' : '');
    tab.innerHTML = `${escapeHtml(cls.name)}<span class="tab-code">${escapeHtml(cls.code)}</span>`;
    tab.addEventListener('click', () => {
      state.activeCode = cls.code;
      renderTabs();
      renderPanel();
    });
    tabsEl.appendChild(tab);
  });
}

function renderPanel() {
  if (state.activeCode === 'HOME') {
    renderHome();
    return;
  }
  const cls = state.classes.find(c => c.code === state.activeCode);
  if (!cls) { panelEl.innerHTML = ''; return; }
  const stats = computeStats(cls);

  const stampState = stats.projected == null ? '' :
    stats.projected >= cls.goal ? 'state-good' : (stats.projected < cls.goal - 10 ? 'state-risk' : '');

  panelEl.innerHTML = `
    <div class="class-heading">
      <h2>${escapeHtml(cls.name)}</h2>
      <span class="class-code">${escapeHtml(cls.code)}</span>
    </div>

    <div class="hero">
      <div class="stamp ${stampState}">
        <div class="stamp__value">${stats.projected == null ? '—' : Math.round(stats.projected * 10) / 10 + '%'}</div>
        <div class="stamp__label">projected</div>
      </div>
      <div class="hero__info">
        <p>${stats.scoredWeight === 0
          ? (stats.pendingWeight > 0
              ? `${stats.pendingWeight}% of the semester is logged and waiting on a grade. Add scores as they come in to see a projection.`
              : 'No tests or exams logged yet for this class. Add one below to start the ledger.')
          : `Currently averaging <strong>${round1(stats.currentAverage)}%</strong> across the work graded so far. If the rest of the semester lands at that same average, this class finishes around <strong>${round1(stats.projected)}%</strong>.`
        }</p>
        <div class="weightbar">
          <div class="weightbar__fill" style="width:${stats.scoredWeight}%"></div>
          <div class="weightbar__fill weightbar__fill--pending" style="width:${stats.pendingWeight}%"></div>
        </div>
        <div class="weightbar__meta">
          <span>${stats.scoredWeight}% graded${stats.pendingWeight ? ` · ${stats.pendingWeight}% awaiting grade` : ''}</span>
          <span>${stats.unallocatedWeight}% not yet logged</span>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <h3>Goal grade</h3>
        <p class="card-sub">What you're aiming for this semester</p>
        <form class="goal-form" id="goalForm">
          <div class="field">
            <label for="goalInput">Target grade (%)</label>
            <input type="number" id="goalInput" min="0" max="100" step="0.5" value="${cls.goal}">
          </div>
          <button class="btn-primary" type="submit">Set goal</button>
        </form>
        ${renderGoalReadout(stats, cls)}
      </div>

      <div class="card">
        <h3>Add a test or exam</h3>
        <p class="card-sub">Weight = share of the semester grade, out of 100</p>
        <form id="itemForm">
          <div class="field-row">
            <div class="field">
              <label for="itemName">Name</label>
              <input type="text" id="itemName" placeholder="e.g. Unit 3 Test" required>
            </div>
            <div class="field">
              <label for="itemWeight">Weight %</label>
              <input type="number" id="itemWeight" min="0.5" max="100" step="0.5" required>
            </div>
            <div class="field">
              <label for="itemScore">Score % <span class="optional-tag">(optional)</span></label>
              <input type="number" id="itemScore" min="0" max="100" step="0.5" placeholder="add later">
            </div>
            <button class="btn-primary" type="submit">Add</button>
          </div>
        </form>
        <p class="error-msg" id="itemError"></p>
      </div>
    </div>

    <div class="card ledger-card">
      <h3>Ledger</h3>
      <p class="card-sub">Every graded item entered for ${escapeHtml(cls.code)}</p>
      ${renderLedgerTable(cls, stats)}
    </div>
  `;

  wirePanelEvents(cls);
}

function renderHome() {
  const overall = computeOverall(state.classes);

  const stampState = !overall.hasData ? '' :
    overall.avgProjected >= 85 ? 'state-good' : (overall.avgProjected < 75 ? 'state-risk' : '');

  const cards = state.classes.map(cls => {
    const stats = computeStats(cls);
    const rowState = stats.projected == null ? '' :
      stats.projected >= cls.goal ? 'good' : (stats.projected < cls.goal - 10 ? 'risk' : '');

    return `
      <button class="home-card" data-code="${escapeHtml(cls.code)}">
        <div class="home-card__top">
          <div>
            <h4>${escapeHtml(cls.name)}</h4>
            <span class="class-code">${escapeHtml(cls.code)}</span>
          </div>
          <div class="home-card__grade ${rowState}">${stats.projected == null ? '—' : round1(stats.projected) + '%'}</div>
        </div>
        <div class="weightbar weightbar--mini">
          <div class="weightbar__fill" style="width:${stats.scoredWeight}%"></div>
          <div class="weightbar__fill weightbar__fill--pending" style="width:${stats.pendingWeight}%"></div>
        </div>
        <div class="home-card__meta">
          <span>${stats.scoredWeight === 0 ? 'No grades yet' : `avg ${round1(stats.currentAverage)}%`}</span>
          <span>goal ${cls.goal}%</span>
        </div>
      </button>
    `;
  }).join('');

  panelEl.innerHTML = `
    <div class="class-heading">
      <h2>Overview</h2>
      <span class="class-code">${overall.hasData ? `${overall.gradedCount} of ${overall.total} classes graded` : `${overall.total} classes`}</span>
    </div>

    <div class="hero">
      <div class="stamp ${stampState}">
        <div class="stamp__value">${overall.hasData ? round1(overall.avgProjected) + '%' : '—'}</div>
        <div class="stamp__label">overall</div>
      </div>
      <div class="hero__info">
        <p>${overall.hasData
          ? `Averaged across <strong>${overall.gradedCount} of ${overall.total}</strong> classes with grades logged, currently sitting at <strong>${round1(overall.avgCurrent)}%</strong>. If every class finishes the semester at its own current average, the overall projected grade lands around <strong>${round1(overall.avgProjected)}%</strong>.`
          : `No grades logged anywhere yet. Open a class below and add its first test or exam to start tracking.`
        }</p>
      </div>
    </div>

    <div class="home-grid">
      ${cards}
    </div>
  `;

  panelEl.querySelectorAll('.home-card').forEach(card => {
    card.addEventListener('click', () => {
      state.activeCode = card.dataset.code;
      renderTabs();
      renderPanel();
    });
  });
}

function renderGoalReadout(stats, cls) {
  if (cls.items.length === 0) {
    return `<div class="goal-readout">Add a test or exam to see what it takes to reach <strong>${cls.goal}%</strong>.</div>`;
  }
  const pendingNote = stats.pendingWeight > 0
    ? ` (${stats.pendingWeight}% of that is already logged, just waiting on a grade)`
    : '';

  if (stats.goalState === 'met' && stats.remainingWeight === 0) {
    return `<div class="goal-readout good">Goal reached — final grade is locked in at <strong>${round1(stats.currentPoints)}%</strong>.</div>`;
  }
  if (stats.goalState === 'met') {
    return `<div class="goal-readout good">Goal already secured. Even a <strong>0%</strong> average on the remaining ${stats.remainingWeight}%${pendingNote} still clears ${cls.goal}%.</div>`;
  }
  if (stats.goalState === 'no-room-short') {
    return `<div class="goal-readout risk">All 100% of the weight is graded and the goal wasn't reached — final grade is <strong>${round1(stats.currentPoints)}%</strong>.</div>`;
  }
  if (stats.goalState === 'impossible') {
    return `<div class="goal-readout risk">Not mathematically possible anymore — even a perfect <strong>100%</strong> on the remaining ${stats.remainingWeight}%${pendingNote} tops out at ${round1(stats.currentPoints + stats.remainingWeight)}%.</div>`;
  }
  return `<div class="goal-readout good">Needs at least <strong>${round1(stats.neededAvg)}%</strong> average on the remaining ${stats.remainingWeight}%${pendingNote} to hit ${cls.goal}%.</div>`;
}

function renderLedgerTable(cls, stats) {
  if (cls.items.length === 0) {
    return `<div class="empty-state">Nothing logged yet — this class's ledger is empty.</div>`;
  }
  const rows = cls.items.map(item => {
    const isPending = item.score == null;
    const scoreCell = isPending
      ? `<form class="grade-fill-form" data-id="${item.id}">
           <input type="number" class="grade-fill-input" min="0" max="100" step="0.5" placeholder="grade" required>
           <button type="submit" class="icon-btn add-grade-btn" title="Save grade">✓</button>
         </form>`
      : `${item.score}%`;
    const contribCell = isPending ? `<span class="pending-tag">pending</span>` : `${round1((item.weight * item.score) / 100)} pts`;

    return `
      <tr class="${isPending ? 'is-pending' : ''}">
        <td>${escapeHtml(item.name)}</td>
        <td>${item.weight}%</td>
        <td>${scoreCell}</td>
        <td>${contribCell}</td>
        <td style="text-align:right"><button class="icon-btn del-btn" data-id="${item.id}" title="Remove entry">✕</button></td>
      </tr>
    `;
  }).join('');

  return `
    <table class="ledger">
      <thead>
        <tr><th>Item</th><th>Weight</th><th>Score</th><th>Contribution</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function wirePanelEvents(cls) {
  document.getElementById('goalForm').addEventListener('submit', async e => {
    e.preventDefault();
    const val = parseFloat(document.getElementById('goalInput').value);
    if (Number.isNaN(val)) return;
    try {
      await api(`/api/classes/${cls.code}/goal`, { method: 'PUT', body: JSON.stringify({ goal: val }) });
      cls.goal = val;
      renderPanel();
      showToast('Goal updated.');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('itemForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('itemName').value.trim();
    const weight = parseFloat(document.getElementById('itemWeight').value);
    const scoreRaw = document.getElementById('itemScore').value.trim();
    const score = scoreRaw === '' ? null : parseFloat(scoreRaw);
    const errEl = document.getElementById('itemError');
    errEl.textContent = '';

    if (!name || Number.isNaN(weight) || (score !== null && Number.isNaN(score))) return;

    try {
      const item = await api(`/api/classes/${cls.code}/items`, {
        method: 'POST',
        body: JSON.stringify({ name, weight, score }),
      });
      cls.items.push(item);
      renderPanel();
      showToast(score === null ? 'Entry added — add its grade whenever it comes in.' : 'Entry added.');
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  panelEl.querySelectorAll('.grade-fill-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const id = form.dataset.id;
      const input = form.querySelector('.grade-fill-input');
      const score = parseFloat(input.value);
      if (Number.isNaN(score) || score < 0 || score > 100) return;

      try {
        const item = await api(`/api/classes/${cls.code}/items/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ score }),
        });
        const idx = cls.items.findIndex(i => i.id === id);
        if (idx !== -1) cls.items[idx] = item;
        renderPanel();
        showToast('Grade added.');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });

  panelEl.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      try {
        await api(`/api/classes/${cls.code}/items/${id}`, { method: 'DELETE' });
        cls.items = cls.items.filter(i => i.id !== id);
        renderPanel();
        showToast('Entry removed.');
      } catch (err) {
        showToast(err.message, true);
      }
    });
  });
}

// ---------- Utilities ----------

function round1(n) {
  if (n == null) return '—';
  return Math.round(n * 10) / 10;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

let toastTimer = null;
function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 2600);
}

// ---------- Init ----------

(async function init() {
  try {
    await loadData();
    renderTabs();
    renderPanel();
  } catch (err) {
    panelEl.innerHTML = `<div class="empty-state">Couldn't load data: ${escapeHtml(err.message)}</div>`;
  }
})();
