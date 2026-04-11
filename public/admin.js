const adminState = {
  data: null,
  selectedCardIndex: 0,
  selectedCellIndex: 0
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

async function fetchAdminState() {
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
  return true;
}

function renderTeams() {
  teamsList.innerHTML = '';

  adminState.data.teams.forEach((team) => {
    const row = document.createElement('div');
    row.className = 'team-row';
    row.innerHTML = `
      <input data-team-field="name" data-team-id="${team.id}" value="${team.name}">
      <input data-team-field="password" data-team-id="${team.id}" value="${team.password}">
      <select data-team-field="cardId" data-team-id="${team.id}">
        ${adminState.data.cards.map((card) => `<option value="${card.id}" ${team.cardId === card.id ? 'selected' : ''}>${card.name}</option>`).join('')}
      </select>
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

  if (cell.image) {
    cellPreview.classList.remove('hidden');
    cellPreview.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.2)), url("${cell.image}")`;
  } else {
    cellPreview.classList.add('hidden');
    cellPreview.style.backgroundImage = '';
  }
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
    await fetchAdminState();
  }
}

async function saveTeams() {
  saveEditorToState();
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
    await fetchAdminState();
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
    saveEditorToState();
    fillEditor();
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
    saveEditorToState();
    fillEditor();
    renderCardGrid();
  });
});

document.getElementById('add-team-button').addEventListener('click', () => {
  const nextIndex = adminState.data.teams.length + 1;
  adminState.data.teams.push({
    id: `team-${Date.now()}`,
    name: `Nový tým ${nextIndex}`,
    password: 'heslo',
    cardId: adminState.data.cards[0].id
  });
  renderTeams();
});

document.getElementById('save-cards-button').addEventListener('click', saveCards);
document.getElementById('save-teams-button').addEventListener('click', saveTeams);
document.getElementById('upload-image-button').addEventListener('click', uploadImage);
document.getElementById('clear-image-button').addEventListener('click', () => {
  cellImageInput.value = '';
  saveEditorToState();
  fillEditor();
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
    await fetchAdminState();
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
    await fetchAdminState();
  }
});

document.getElementById('admin-refresh-button').addEventListener('click', fetchAdminState);
document.getElementById('admin-logout-button').addEventListener('click', async () => {
  await fetch('/admin/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/admin';
});

fetchAdminState();
setInterval(fetchAdminState, 3000);
