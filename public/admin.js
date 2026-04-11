const adminState = {
  data: null,
  selectedCardIndex: 0,
  selectedCellIndex: 0,
  hasUnsavedChanges: false
};

const teamsList = document.getElementById('teams-list');
const adminScoreboard = document.getElementById('admin-scoreboard');
const cardTabs = document.getElementById('card-tabs');
const adminCardGrid = document.getElementById('admin-card-grid');
const editorTitle = document.getElementById('editor-title');
const editorMessage = document.getElementById('editor-message');
const rowBonusInput = document.getElementById('row-bonus-input');
const cellTitleInput = document.getElementById('cell-title-input');
const cellDescriptionInput = document.getElementById('cell-description-input');
const cellTypeInput = document.getElementById('cell-type-input');
const cellPointsInput = document.getElementById('cell-points-input');
const cellDeadlineInput = document.getElementById('cell-deadline-input');
const cellOpenLimitInput = document.getElementById('cell-open-limit-input');
const cellFastBonusMinutesInput = document.getElementById('cell-fast-bonus-minutes-input');
const cellFastBonusPointsInput = document.getElementById('cell-fast-bonus-points-input');
const cellImageInput = document.getElementById('cell-image-input');
const cellPreview = document.getElementById('cell-preview');

function currentCard() {
  return adminState.data.cards[adminState.selectedCardIndex];
}

function currentCell() {
  return currentCard().cells[adminState.selectedCellIndex];
}

function markDirty() {
  adminState.hasUnsavedChanges = true;
}

function clearDirty() {
  adminState.hasUnsavedChanges = false;
}

function updateCellPreview() {
  const cell = currentCell();

  if (cell.image) {
    cellPreview.classList.remove('hidden');
    cellPreview.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.2)), url("${cell.image}")`;
  } else {
    cellPreview.classList.add('hidden');
    cellPreview.style.backgroundImage = '';
  }
}

async function fetchAdminState(force = false) {
  if (adminState.hasUnsavedChanges && !force) {
    return true;
  }

  const response = await fetch('/admin/state', { credentials: 'include' });
  if (response.status === 401) {
    window.location.href = '/admin';
    return false;
  }

  adminState.data = await response.json();
  rowBonusInput.value = adminState.data.config.rowBonus;
  renderTeams();
  renderScoreboard();
  renderCardTabs();
  renderCardGrid();
  fillEditor();
  clearDirty();
  return true;
}

function renderTeams() {
  teamsList.innerHTML = '';

  adminState.data.teams.forEach((team) => {
    const row = document.createElement('div');
    row.className = 'team-row';
    row.innerHTML = `
      <input class="team-name-input" data-team-field="name" data-team-id="${team.id}" value="${team.name}">
      <input class="team-password-input" data-team-field="password" data-team-id="${team.id}" value="${team.password}">
      <select class="team-card-select" data-team-field="cardId" data-team-id="${team.id}">
        ${adminState.data.cards.map((card) => `<option value="${card.id}" ${team.cardId === card.id ? 'selected' : ''}>${card.name}</option>`).join('')}
      </select>
      <button type="button" class="danger-button team-remove-button" data-team-remove="${team.id}" ${adminState.data.teams.length <= 1 ? 'disabled' : ''}>Odebrat</button>
    `;
    teamsList.appendChild(row);
  });
}

function renderScoreboard() {
  adminScoreboard.innerHTML = '';

  adminState.data.leaderboard.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-item';
    row.innerHTML = `
      <div class="leaderboard-rank">${item.rank}</div>
      <div>
        <strong>${item.teamName}</strong>
        <div class="muted">${item.completedTasks} úkolů · ${item.completedLines} řad</div>
      </div>
      <div><strong>${item.score}</strong> b</div>
    `;
    adminScoreboard.appendChild(row);
  });
}

function renderCardTabs() {
  cardTabs.innerHTML = '';

  adminState.data.cards.forEach((card, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `card-tab ${index === adminState.selectedCardIndex ? 'active' : ''}`;
    button.textContent = card.name;
    button.addEventListener('click', () => {
      adminState.selectedCardIndex = index;
      adminState.selectedCellIndex = 0;
      renderCardTabs();
      renderCardGrid();
      fillEditor();
    });
    cardTabs.appendChild(button);
  });
}

function renderCardGrid() {
  adminCardGrid.innerHTML = '';
  currentCard().cells.forEach((cell, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `card-cell is-${cell.type === 'timed' ? 'closed' : 'closed'} ${cell.type} ${index === adminState.selectedCellIndex ? 'selected' : ''}`;
    button.innerHTML = `<div><strong>${index + 1}</strong><small>${cell.title}</small></div>`;
    if (cell.image) {
      button.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.9)), url("${cell.image}")`;
    }
    button.addEventListener('click', () => {
      adminState.selectedCellIndex = index;
      renderCardGrid();
      fillEditor();
    });
    adminCardGrid.appendChild(button);
  });
}

function fillEditor() {
  const cell = currentCell();
  editorTitle.textContent = `${currentCard().name} · políčko ${adminState.selectedCellIndex + 1}`;
  cellTitleInput.value = cell.title;
  cellDescriptionInput.value = cell.description;
  cellTypeInput.value = cell.type;
  cellPointsInput.value = cell.basePoints;
  cellDeadlineInput.value = cell.fixedDeadline ? cell.fixedDeadline.slice(0, 16) : '';
  cellOpenLimitInput.value = cell.openLimitMinutes;
  cellFastBonusMinutesInput.value = cell.fastBonusMinutes;
  cellFastBonusPointsInput.value = cell.fastBonusPoints;
  cellImageInput.value = cell.image || '';
  updateCellPreview();
}

function saveEditorToState() {
  const cell = currentCell();
  cell.title = cellTitleInput.value.trim() || `Úkol ${adminState.selectedCellIndex + 1}`;
  cell.description = cellDescriptionInput.value.trim();
  cell.type = cellTypeInput.value;
  cell.basePoints = Number(cellPointsInput.value) || 0;
  cell.fixedDeadline = cellDeadlineInput.value ? `${cellDeadlineInput.value}:00` : '';
  cell.openLimitMinutes = Number(cellOpenLimitInput.value) || 0;
  cell.fastBonusMinutes = Number(cellFastBonusMinutesInput.value) || 0;
  cell.fastBonusPoints = Number(cellFastBonusPointsInput.value) || 0;
  cell.image = cellImageInput.value.trim();
}

function collectTeamsFromForm() {
  const teams = adminState.data.teams.map((team) => ({ ...team }));

  teams.forEach((team) => {
    const nameInput = teamsList.querySelector(`[data-team-field="name"][data-team-id="${team.id}"]`);
    const passwordInput = teamsList.querySelector(`[data-team-field="password"][data-team-id="${team.id}"]`);
    const cardInput = teamsList.querySelector(`[data-team-field="cardId"][data-team-id="${team.id}"]`);
    team.name = nameInput.value.trim();
    team.password = passwordInput.value;
    team.cardId = cardInput.value;
  });

  return teams;
}

async function saveCards() {
  saveEditorToState();
  clearDirty();
  editorMessage.textContent = 'Ukládám karty...';

  const response = await fetch('/admin/save-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ cards: adminState.data.cards })
  });

  const data = await response.json();
  editorMessage.textContent = response.ok ? 'Karty uloženy.' : (data.error || 'Uložení selhalo.');
  if (response.ok) {
    await fetchAdminState(true);
  }
}

async function saveTeams() {
  saveEditorToState();
  clearDirty();
  const response = await fetch('/admin/save-teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      teams: collectTeamsFromForm(),
      rowBonus: Number(rowBonusInput.value) || 0
    })
  });

  const data = await response.json();
  editorMessage.textContent = response.ok ? 'Týmy a nastavení uloženy.' : (data.error || 'Uložení selhalo.');
  if (response.ok) {
    await fetchAdminState(true);
  }
}

async function uploadImage() {
  const fileInput = document.getElementById('cell-image-upload');
  const file = fileInput.files[0];
  if (!file) {
    editorMessage.textContent = 'Nejdřív vyber obrázek.';
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    editorMessage.textContent = 'Nahrávám obrázek...';
    const response = await fetch('/admin/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        filename: file.name,
        data: reader.result
      })
    });

    const data = await response.json();
    if (!response.ok) {
      editorMessage.textContent = data.error || 'Nahrání se nepovedlo.';
      return;
    }

    cellImageInput.value = data.imagePath;
    markDirty();
    saveEditorToState();
    updateCellPreview();
    renderCardGrid();
    editorMessage.textContent = 'Obrázek nahrán. Nezapomeň uložit karty.';
  };
  reader.readAsDataURL(file);
}

[
  cellTitleInput,
  cellDescriptionInput,
  cellTypeInput,
  cellPointsInput,
  cellDeadlineInput,
  cellOpenLimitInput,
  cellFastBonusMinutesInput,
  cellFastBonusPointsInput,
  cellImageInput
].forEach((input) => {
  input.addEventListener('input', () => {
    markDirty();
    saveEditorToState();
    updateCellPreview();
    renderCardGrid();
  });
});

teamsList.addEventListener('input', markDirty);
teamsList.addEventListener('change', markDirty);
teamsList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-team-remove]');
  if (!button) {
    return;
  }

  const teamId = button.dataset.teamRemove;
  const team = adminState.data.teams.find((item) => item.id === teamId);
  if (!team) {
    return;
  }

  if (adminState.data.teams.length <= 1) {
    editorMessage.textContent = 'Musí zůstat alespoň jeden tým.';
    return;
  }

  const confirmed = window.confirm(`Odebrat tým "${team.name}"?`);
  if (!confirmed) {
    return;
  }

  adminState.data.teams = adminState.data.teams.filter((item) => item.id !== teamId);
  markDirty();
  renderTeams();
  editorMessage.textContent = 'Tým byl odebrán z formuláře. Nezapomeň změnu uložit.';
});
rowBonusInput.addEventListener('input', markDirty);

document.getElementById('add-team-button').addEventListener('click', () => {
  const nextIndex = adminState.data.teams.length + 1;
  adminState.data.teams.push({
    id: `team-${Date.now()}`,
    name: `Nový tým ${nextIndex}`,
    password: 'heslo',
    cardId: adminState.data.cards[0].id
  });
  markDirty();
  renderTeams();
});

document.getElementById('save-cards-button').addEventListener('click', saveCards);
document.getElementById('save-teams-button').addEventListener('click', saveTeams);
document.getElementById('upload-image-button').addEventListener('click', uploadImage);
document.getElementById('clear-image-button').addEventListener('click', () => {
  cellImageInput.value = '';
  markDirty();
  saveEditorToState();
  updateCellPreview();
  renderCardGrid();
});

document.getElementById('end-game-button').addEventListener('click', async () => {
  const response = await fetch('/admin/end-game', {
    method: 'POST',
    credentials: 'include'
  });
  const data = await response.json();
  editorMessage.textContent = response.ok ? 'Hra ukončena.' : (data.error || 'Akce selhala.');
  if (response.ok) {
    await fetchAdminState(true);
  }
});

document.getElementById('reset-game-button').addEventListener('click', async () => {
  const confirmed = window.confirm('Reset vymaže rozehraný stav všech týmů. Pokračovat?');
  if (!confirmed) {
    return;
  }

  const response = await fetch('/admin/reset-game', {
    method: 'POST',
    credentials: 'include'
  });
  const data = await response.json();
  editorMessage.textContent = response.ok ? 'Rozehraná hra resetována.' : (data.error || 'Akce selhala.');
  if (response.ok) {
    await fetchAdminState(true);
  }
});

document.getElementById('admin-refresh-button').addEventListener('click', () => fetchAdminState(true));
document.getElementById('admin-logout-button').addEventListener('click', async () => {
  await fetch('/admin/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/admin';
});

fetchAdminState(true);
setInterval(() => {
  fetchAdminState(false);
}, 3000);
