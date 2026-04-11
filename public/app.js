const state = {
  version: null,
  summary: null,
  leaderboard: [],
  selectedCellId: null
};

const teamTitle = document.getElementById('team-title');
const gameMeta = document.getElementById('game-meta');
const scoreBadge = document.getElementById('score-badge');
const taskBadge = document.getElementById('task-badge');
const cardGrid = document.getElementById('card-grid');
const leaderboardList = document.getElementById('leaderboard-list');
const taskModal = document.getElementById('task-modal');
const taskImage = document.getElementById('task-image');
const taskType = document.getElementById('task-type');
const taskTitle = document.getElementById('task-title');
const taskDescription = document.getElementById('task-description');
const taskPoints = document.getElementById('task-points');
const taskDeadline = document.getElementById('task-deadline');
const taskOpenLimit = document.getElementById('task-open-limit');
const taskBonus = document.getElementById('task-bonus');
const taskState = document.getElementById('task-state');
const taskMessage = document.getElementById('task-message');
const openTaskButton = document.getElementById('open-task-button');
const completeTaskButton = document.getElementById('complete-task-button');
const gameAlert = document.getElementById('game-alert');

function formatDateTime(value) {
  if (!value) {
    return 'není nastaveno';
  }

  return new Date(value).toLocaleString('cs-CZ');
}

function formatMinutes(value) {
  if (!value) {
    return 'bez limitu';
  }

  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  }

  return `${value} min`;
}

function stateLabel(cell) {
  const map = {
    closed: 'zavřené',
    open: 'otevřené',
    completed: 'splněné',
    expired: 'propadlé'
  };
  return map[cell.state] || cell.state;
}

function typeLabel(cell) {
  const map = {
    easy: 'Lehké',
    hard: 'Složité',
    timed: 'Časované'
  };
  return map[cell.type] || cell.type;
}

function renderCard() {
  if (!state.summary) {
    return;
  }

  teamTitle.textContent = state.summary.teamName;
  gameMeta.textContent = `Karta ${state.summary.cardId} · Bonus za řadu ${window.currentRowBonus || 0} bodů`;
  scoreBadge.textContent = `${state.summary.score} bodů`;
  taskBadge.textContent = `${state.summary.completedTasks} splněno`;

  cardGrid.innerHTML = '';

  state.summary.cells.forEach((cell, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `card-cell is-${cell.state} ${cell.type} ${cell.image ? 'has-image' : ''}`;
    button.dataset.cellId = cell.id;

    if (cell.image) {
      button.style.setProperty('--cell-image', `url("${cell.image}")`);
      button.style.backgroundImage = '';
      button.style.position = 'relative';
      button.style.setProperty('background-size', 'cover');
      button.style.setProperty('background-position', 'center');
      button.style.setProperty('background-repeat', 'no-repeat');
    }

    let innerHtml = '';
    if (cell.state === 'closed') {
      innerHtml = `<div><strong>${index + 1}</strong><small>${typeLabel(cell)}</small></div>`;
    } else {
      innerHtml = `<div><strong>${cell.title}</strong><small>${stateLabel(cell)}</small></div>`;
    }

    button.innerHTML = innerHtml;
    if (cell.image) {
      button.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.9)), url("${cell.image}")`;
    }

    button.addEventListener('click', () => openModal(cell.id));
    cardGrid.appendChild(button);
  });
}

function renderLeaderboard() {
  leaderboardList.innerHTML = '';

  state.leaderboard.forEach((item) => {
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
    leaderboardList.appendChild(row);
  });
}

function getSelectedCell() {
  return state.summary ? state.summary.cells.find((cell) => cell.id === state.selectedCellId) : null;
}

function openModal(cellId) {
  state.selectedCellId = cellId;
  renderModal();
  taskModal.classList.remove('hidden');
}

function closeModal() {
  taskModal.classList.add('hidden');
  state.selectedCellId = null;
  taskMessage.textContent = '';
}

function renderModal() {
  const cell = getSelectedCell();
  if (!cell) {
    return;
  }

  taskType.textContent = typeLabel(cell);
  taskTitle.textContent = cell.state === 'closed' ? `Zavřené políčko ${cell.index + 1}` : cell.title;
  taskDescription.textContent = cell.state === 'closed' ? 'Po otevření se už úkol nedá znovu zavřít.' : cell.description;
  taskPoints.textContent = `${cell.basePoints} bodů`;
  taskDeadline.textContent = formatDateTime(cell.fixedDeadline);
  taskOpenLimit.textContent = formatMinutes(cell.openLimitMinutes);
  taskBonus.textContent = cell.fastBonusPoints > 0 && cell.fastBonusMinutes > 0
    ? `+${cell.fastBonusPoints} bod do ${formatMinutes(cell.fastBonusMinutes)}`
    : 'bez bonusu';
  taskState.textContent = stateLabel(cell);

  if (cell.image) {
    taskImage.classList.remove('hidden');
    taskImage.style.backgroundImage = `linear-gradient(rgba(10,15,28,0.15), rgba(10,15,28,0.2)), url("${cell.image}")`;
  } else {
    taskImage.classList.add('hidden');
    taskImage.style.backgroundImage = '';
  }

  openTaskButton.classList.toggle('hidden', cell.state !== 'closed');
  completeTaskButton.classList.toggle('hidden', cell.state !== 'open');

  if (window.currentGameEnded) {
    openTaskButton.disabled = true;
    completeTaskButton.disabled = true;
    taskMessage.textContent = 'Hra byla ukončena adminem.';
  } else {
    openTaskButton.disabled = false;
    completeTaskButton.disabled = false;
  }
}

async function fetchTeamState() {
  const response = await fetch('/team-state', { credentials: 'include' });
  if (response.status === 401) {
    window.location.href = '/login.html';
    return false;
  }

  const data = await response.json();
  state.version = data.version;
  state.summary = data.summary;
  window.currentGameEnded = data.gameEnded;
  window.currentRowBonus = data.rowBonus;

  gameAlert.classList.toggle('hidden', !data.gameEnded);
  gameAlert.textContent = data.gameEnded ? 'Hra je ukončená. Karta i leaderboard zůstávají jen ke čtení.' : '';

  renderCard();
  if (!taskModal.classList.contains('hidden')) {
    renderModal();
  }
  return true;
}

async function fetchLeaderboard() {
  const response = await fetch('/leaderboard', { credentials: 'include' });
  const data = await response.json();
  state.leaderboard = data.leaderboard;
  renderLeaderboard();
}

async function refreshAll() {
  const ok = await fetchTeamState();
  if (!ok) {
    return;
  }
  await fetchLeaderboard();
}

async function sendTaskAction(url) {
  const cell = getSelectedCell();
  if (!cell) {
    return;
  }

  taskMessage.textContent = 'Ukládám...';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ cellId: cell.id })
  });

  const data = await response.json();
  if (!response.ok) {
    taskMessage.textContent = data.error || 'Akce se nepovedla.';
    return;
  }

  taskMessage.textContent = '';
  await refreshAll();
  renderModal();
}

document.querySelectorAll('[data-close-modal]').forEach((element) => {
  element.addEventListener('click', closeModal);
});

openTaskButton.addEventListener('click', () => sendTaskAction('/open-task'));
completeTaskButton.addEventListener('click', () => sendTaskAction('/complete-task'));

document.getElementById('logout-button').addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login.html';
});

refreshAll();
setInterval(refreshAll, 2000);
