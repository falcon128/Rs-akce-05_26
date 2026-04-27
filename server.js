const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

const FILES = {
  config: path.join(DATA_DIR, 'config.json'),
  teams: path.join(DATA_DIR, 'teams.json'),
  cards: path.join(DATA_DIR, 'cards.json'),
  gameState: path.join(DATA_DIR, 'game-state.json')
};

const sessions = {
  team: new Map(),
  admin: new Map()
};

ensureDataFiles();

function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  writeJsonIfMissing(FILES.config, {
    adminPassword: 'bosákješpek',
    rowBonus: 10,
    gameEnded: false,
    version: 1
  });

  writeJsonIfMissing(FILES.teams, []);

  writeJsonIfMissing(FILES.cards, createDefaultCards());
  writeJsonIfMissing(FILES.gameState, createEmptyGameState());
}

function writeJsonIfMissing(filePath, data) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}

function createEmptyCell(index, cardNumber) {
  const row = Math.floor(index / 5) + 1;
  const col = (index % 5) + 1;
  const hard = index % 4 === 0;
  const timed = index % 5 === 2;

  return {
    id: `cell-${index}`,
    title: `Úkol ${cardNumber}.${index + 1}`,
    description: `Popis úkolu pro kartu ${cardNumber}, řádek ${row}, sloupec ${col}.`,
    type: timed ? 'timed' : hard ? 'hard' : 'easy',
    basePoints: hard ? 3 : 1,
    fixedDeadline: '',
    openLimitMinutes: timed ? 120 : 0,
    fastBonusMinutes: timed ? 60 : 0,
    fastBonusPoints: timed ? 1 : 0,
    image: ''
  };
}

function createDefaultCards() {
  const cards = [];

  for (let cardNumber = 1; cardNumber <= 5; cardNumber += 1) {
    const cells = [];

    for (let i = 0; i < 25; i += 1) {
      cells.push(createEmptyCell(i, cardNumber));
    }

    cards.push({
      id: `card-${cardNumber}`,
      name: `Karta ${cardNumber}`,
      cells
    });
  }

  return cards;
}

function createEmptyGameState() {
  return {
    version: 1,
    teams: {}
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function loadAllData() {
  const data = {
    config: readJson(FILES.config),
    teams: readJson(FILES.teams),
    cards: readJson(FILES.cards),
    gameState: readJson(FILES.gameState)
  };

  let changed = false;

  if (!Array.isArray(data.cards) || data.cards.length !== 5) {
    data.cards = createDefaultCards();
    changed = true;
  } else {
    data.cards = data.cards.map((card, index) => {
      const fallback = createDefaultCards()[index];
      const cells = Array.isArray(card.cells) ? card.cells.slice(0, 25) : [];

      while (cells.length < 25) {
        cells.push(createEmptyCell(cells.length, index + 1));
      }

      return {
        id: card.id || fallback.id,
        name: card.name || fallback.name,
        cells: cells.map((cell, cellIndex) => ({
          ...createEmptyCell(cellIndex, index + 1),
          ...cell,
          id: cell.id || `cell-${cellIndex}`
        }))
      };
    });
  }

  if (!data.config.version) {
    data.config.version = 1;
    changed = true;
  }

  if (!data.config.adminPassword) {
    data.config.adminPassword = 'bosákješpek';
    changed = true;
  }

  if (!data.gameState.version) {
    data.gameState.version = data.config.version;
    changed = true;
  }

  if (!data.gameState.teams || typeof data.gameState.teams !== 'object') {
    data.gameState.teams = {};
    changed = true;
  }

  if (changed) {
    saveAllData(data);
  }

  return data;
}

function saveAllData(data) {
  writeJson(FILES.config, data.config);
  writeJson(FILES.teams, data.teams);
  writeJson(FILES.cards, data.cards);
  writeJson(FILES.gameState, data.gameState);
}

function bumpVersion(data) {
  data.config.version += 1;
  data.gameState.version = data.config.version;
}

function getCookieMap(req) {
  const header = req.headers.cookie || '';
  const cookies = {};

  header.split(';').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    const key = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;
    const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : '';
    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

function getSession(req, kind) {
  const cookies = getCookieMap(req);
  const tokenName = kind === 'admin' ? 'adminToken' : 'teamToken';
  const token = cookies[tokenName];
  if (!token) {
    return null;
  }

  return sessions[kind].get(token) || null;
}

function createSession(res, kind, value) {
  const token = crypto.randomBytes(24).toString('hex');
  const tokenName = kind === 'admin' ? 'adminToken' : 'teamToken';
  sessions[kind].set(token, value);
  res.setHeader('Set-Cookie', `${tokenName}=${token}; HttpOnly; Path=/; SameSite=Lax`);
}

function clearSession(res, kind, req) {
  const cookies = getCookieMap(req);
  const tokenName = kind === 'admin' ? 'adminToken' : 'teamToken';
  const token = cookies[tokenName];
  if (token) {
    sessions[kind].delete(token);
  }
  res.setHeader('Set-Cookie', `${tokenName}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });

    req.on('error', reject);
  });
}

function getCardById(cards, cardId) {
  return cards.find((card) => card.id === cardId) || null;
}

function getTeamStateBucket(gameState, teamId) {
  if (!gameState.teams[teamId]) {
    gameState.teams[teamId] = {
      cells: {}
    };
  }
  return gameState.teams[teamId];
}

function getCellDeadline(cell) {
  if (!cell.fixedDeadline) {
    return null;
  }

  const timestamp = Date.parse(cell.fixedDeadline);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
}

function getCellProgressState(cell, progress, now) {
  if (!progress || !progress.openedAt) {
    return 'closed';
  }

  if (progress.completedAt) {
    return 'completed';
  }

  const expiredAt = getExpiryTime(cell, progress);
  if (progress.expiredAt || (expiredAt && now >= expiredAt)) {
    return 'expired';
  }

  return 'open';
}

function getExpiryTime(cell, progress) {
  const times = [];
  const fixedDeadline = getCellDeadline(cell);

  if (fixedDeadline) {
    times.push(fixedDeadline);
  }

  if (cell.openLimitMinutes > 0 && progress && progress.openedAt) {
    times.push(progress.openedAt + (cell.openLimitMinutes * 60 * 1000));
  }

  if (times.length === 0) {
    return null;
  }

  return Math.min(...times);
}

function applyExpirations(data) {
  const now = Date.now();
  let changed = false;

  data.teams.forEach((team) => {
    const card = getCardById(data.cards, team.cardId);
    if (!card) {
      return;
    }

    const bucket = getTeamStateBucket(data.gameState, team.id);

    card.cells.forEach((cell) => {
      const progress = bucket.cells[cell.id];
      if (!progress || !progress.openedAt || progress.completedAt || progress.expiredAt) {
        return;
      }

      const expiryTime = getExpiryTime(cell, progress);
      if (expiryTime && now >= expiryTime) {
        progress.expiredAt = expiryTime;
        changed = true;
      }
    });
  });

  if (changed) {
    bumpVersion(data);
    saveAllData(data);
  }
}

function countOpenTasks(card, teamBucket) {
  const now = Date.now();
  return card.cells.filter((cell) => {
    const progress = teamBucket.cells[cell.id];
    return getCellProgressState(cell, progress, now) === 'open';
  }).length;
}

function buildLineDefinitions() {
  const lines = [];

  for (let row = 0; row < 5; row += 1) {
    lines.push({
      key: `row-${row}`,
      indices: [0, 1, 2, 3, 4].map((offset) => row * 5 + offset)
    });
  }

  for (let col = 0; col < 5; col += 1) {
    lines.push({
      key: `col-${col}`,
      indices: [0, 1, 2, 3, 4].map((offset) => col + (offset * 5))
    });
  }

  lines.push({
    key: 'diag-main',
    indices: [0, 6, 12, 18, 24]
  });

  return lines;
}

const LINE_DEFINITIONS = buildLineDefinitions();

function buildTeamSummary(team, card, teamBucket, config) {
  const now = Date.now();
  let completedTasks = 0;
  let score = 0;

  const cells = card.cells.map((cell, index) => {
    const progress = teamBucket.cells[cell.id] || null;
    const state = getCellProgressState(cell, progress, now);
    const expiryTime = getExpiryTime(cell, progress);

    if (state === 'completed') {
      completedTasks += 1;
      score += cell.basePoints || 0;

      if (
        cell.fastBonusPoints > 0 &&
        cell.fastBonusMinutes > 0 &&
        progress &&
        progress.completedAt &&
        progress.openedAt &&
        progress.completedAt <= progress.openedAt + (cell.fastBonusMinutes * 60 * 1000)
      ) {
        score += cell.fastBonusPoints;
      }
    }

    return {
      id: cell.id,
      index,
      title: cell.title,
      description: cell.description,
      type: cell.type,
      basePoints: cell.basePoints,
      fixedDeadline: cell.fixedDeadline,
      openLimitMinutes: cell.openLimitMinutes,
      fastBonusMinutes: cell.fastBonusMinutes,
      fastBonusPoints: cell.fastBonusPoints,
      image: cell.image,
      state,
      openedAt: progress ? progress.openedAt || null : null,
      completedAt: progress ? progress.completedAt || null : null,
      expiredAt: progress ? progress.expiredAt || null : null,
      expiryTime
    };
  });

  let completedLines = 0;

  LINE_DEFINITIONS.forEach((line) => {
    const isComplete = line.indices.every((index) => cells[index].state === 'completed');
    if (isComplete) {
      completedLines += 1;
    }
  });

  score += completedLines * config.rowBonus;

  return {
    teamId: team.id,
    teamName: team.name,
    cardId: card.id,
    score,
    completedTasks,
    completedLines,
    cells
  };
}

function buildLeaderboard(data) {
  return data.teams
    .map((team) => {
      const card = getCardById(data.cards, team.cardId) || data.cards[0];
      const bucket = getTeamStateBucket(data.gameState, team.id);
      const summary = buildTeamSummary(team, card, bucket, data.config);

      return {
        teamId: team.id,
        teamName: team.name,
        score: summary.score,
        completedTasks: summary.completedTasks,
        completedLines: summary.completedLines
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.completedTasks !== a.completedTasks) {
        return b.completedTasks - a.completedTasks;
      }
      return a.teamName.localeCompare(b.teamName, 'cs');
    })
    .map((item, index) => ({
      rank: index + 1,
      ...item
    }));
}

function validateCards(cards) {
  if (!Array.isArray(cards) || cards.length !== 5) {
    return 'Musí existovat přesně 5 karet.';
  }

  for (const card of cards) {
    if (!card.id || !Array.isArray(card.cells) || card.cells.length !== 25) {
      return 'Každá karta musí mít 25 políček.';
    }

    for (const cell of card.cells) {
      if (!cell.id || !cell.title) {
        return 'Každé políčko musí mít id a název.';
      }
    }
  }

  return null;
}

function validateTeams(teams, cards) {
  const cardIds = new Set(cards.map((card) => card.id));
  const names = new Set();

  for (const team of teams) {
    if (!team.id || !team.name || !team.password) {
      return 'Každý tým musí mít id, název a heslo.';
    }

    const lowered = team.name.toLowerCase();
    if (names.has(lowered)) {
      return 'Názvy týmů musí být unikátní.';
    }
    names.add(lowered);

    if (!cardIds.has(team.cardId)) {
      return `Tým ${team.name} má neplatnou kartu.`;
    }
  }

  return null;
}

function sanitizeCards(cards) {
  return cards.map((card, cardIndex) => ({
    id: card.id || `card-${cardIndex + 1}`,
    name: card.name || `Karta ${cardIndex + 1}`,
    cells: card.cells.map((cell, cellIndex) => ({
      id: cell.id || `cell-${cellIndex}`,
      title: String(cell.title || `Úkol ${cellIndex + 1}`),
      description: String(cell.description || ''),
      type: ['easy', 'hard', 'timed'].includes(cell.type) ? cell.type : 'easy',
      basePoints: Number(cell.basePoints) || 0,
      fixedDeadline: String(cell.fixedDeadline || ''),
      openLimitMinutes: Number(cell.openLimitMinutes) || 0,
      fastBonusMinutes: Number(cell.fastBonusMinutes) || 0,
      fastBonusPoints: Number(cell.fastBonusPoints) || 0,
      image: String(cell.image || '')
    }))
  }));
}

function sanitizeTeams(teams) {
  return teams
    .filter((team) => team && team.name && team.password)
    .map((team, index) => ({
      id: team.id || `team-${index + 1}`,
      name: String(team.name).trim(),
      password: String(team.password),
      cardId: String(team.cardId || 'card-1')
    }));
}

function resetGameState(data) {
  data.gameState = createEmptyGameState();
  data.gameState.version = data.config.version;
  data.config.gameEnded = false;
}

function pruneGameState(data) {
  const validTeamIds = new Set(data.teams.map((team) => team.id));
  const prunedTeams = {};

  Object.keys(data.gameState.teams).forEach((teamId) => {
    if (validTeamIds.has(teamId)) {
      prunedTeams[teamId] = data.gameState.teams[teamId];
    }
  });

  data.gameState.teams = prunedTeams;
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp'
  };

  return map[ext] || 'application/octet-stream';
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    sendText(res, 404, 'File not found.');
    return;
  }

  res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

function safeJoin(base, requestedPath) {
  const normalized = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(base, normalized);
  if (!fullPath.startsWith(base)) {
    return null;
  }
  return fullPath;
}

async function handlePlayerLogin(req, res) {
  const body = await parseJsonBody(req);
  const name = String(body.name || '').trim();
  const password = String(body.password || '');
  const data = loadAllData();

  const team = data.teams.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (!team || team.password !== password) {
    sendJson(res, 401, { error: 'Neplatný název týmu nebo heslo.' });
    return;
  }

  createSession(res, 'team', team.id);
  sendJson(res, 200, { ok: true });
}

async function handleOpenTask(req, res) {
  const teamId = getSession(req, 'team');
  if (!teamId) {
    sendJson(res, 401, { error: 'Nejste přihlášeni.' });
    return;
  }

  const body = await parseJsonBody(req);
  const cellId = String(body.cellId || '');
  const data = loadAllData();
  applyExpirations(data);

  if (data.config.gameEnded) {
    sendJson(res, 400, { error: 'Hra už byla ukončena.' });
    return;
  }

  const team = data.teams.find((item) => item.id === teamId);
  const card = team ? getCardById(data.cards, team.cardId) : null;
  if (!team || !card) {
    sendJson(res, 404, { error: 'Tým nebo karta nebyly nalezeny.' });
    return;
  }

  const cell = card.cells.find((item) => item.id === cellId);
  if (!cell) {
    sendJson(res, 404, { error: 'Úkol nebyl nalezen.' });
    return;
  }

  const bucket = getTeamStateBucket(data.gameState, teamId);
  const progress = bucket.cells[cell.id];
  if (progress && progress.openedAt) {
    sendJson(res, 400, { error: 'Úkol už je otevřený.' });
    return;
  }

  if (countOpenTasks(card, bucket) >= 3) {
    sendJson(res, 400, { error: 'Nejdřív dokončete nebo nechte propadnout některý z otevřených úkolů.' });
    return;
  }

  bucket.cells[cell.id] = {
    openedAt: Date.now(),
    completedAt: null,
    expiredAt: null
  };

  bumpVersion(data);
  saveAllData(data);
  sendJson(res, 200, { ok: true, version: data.config.version });
}

async function handleCompleteTask(req, res) {
  const teamId = getSession(req, 'team');
  if (!teamId) {
    sendJson(res, 401, { error: 'Nejste přihlášeni.' });
    return;
  }

  const body = await parseJsonBody(req);
  const cellId = String(body.cellId || '');
  const data = loadAllData();
  applyExpirations(data);

  if (data.config.gameEnded) {
    sendJson(res, 400, { error: 'Hra už byla ukončena.' });
    return;
  }

  const team = data.teams.find((item) => item.id === teamId);
  const card = team ? getCardById(data.cards, team.cardId) : null;
  if (!team || !card) {
    sendJson(res, 404, { error: 'Tým nebo karta nebyly nalezeny.' });
    return;
  }

  const cell = card.cells.find((item) => item.id === cellId);
  const bucket = getTeamStateBucket(data.gameState, teamId);
  const progress = cell ? bucket.cells[cell.id] : null;
  if (!cell || !progress || !progress.openedAt) {
    sendJson(res, 404, { error: 'Úkol není otevřený.' });
    return;
  }

  const state = getCellProgressState(cell, progress, Date.now());
  if (state === 'expired') {
    progress.expiredAt = progress.expiredAt || Date.now();
    bumpVersion(data);
    saveAllData(data);
    sendJson(res, 400, { error: 'Úkol už propadl.' });
    return;
  }

  if (state === 'completed') {
    sendJson(res, 400, { error: 'Úkol už je splněný.' });
    return;
  }

  progress.completedAt = Date.now();
  bumpVersion(data);
  saveAllData(data);
  sendJson(res, 200, { ok: true, version: data.config.version });
}

function handleTeamState(req, res) {
  const teamId = getSession(req, 'team');
  if (!teamId) {
    sendJson(res, 401, { error: 'Nejste přihlášeni.' });
    return;
  }

  const data = loadAllData();
  applyExpirations(data);

  const team = data.teams.find((item) => item.id === teamId);
  if (!team) {
    clearSession(res, 'team', req);
    sendJson(res, 401, { error: 'Tým už neexistuje.' });
    return;
  }

  const card = getCardById(data.cards, team.cardId) || data.cards[0];
  const bucket = getTeamStateBucket(data.gameState, team.id);
  const summary = buildTeamSummary(team, card, bucket, data.config);

  sendJson(res, 200, {
    version: data.config.version,
    gameEnded: data.config.gameEnded,
    rowBonus: data.config.rowBonus,
    team: {
      id: team.id,
      name: team.name
    },
    summary
  });
}

function handleLeaderboard(req, res) {
  const teamId = getSession(req, 'team');
  const isAdmin = getSession(req, 'admin');
  if (!teamId && !isAdmin) {
    sendJson(res, 401, { error: 'Nejste přihlášeni.' });
    return;
  }

  const data = loadAllData();
  applyExpirations(data);
  sendJson(res, 200, {
    version: data.config.version,
    gameEnded: data.config.gameEnded,
    leaderboard: buildLeaderboard(data)
  });
}

async function handleAdminLogin(req, res) {
  const body = await parseJsonBody(req);
  const password = String(body.password || '');
  const data = loadAllData();

  if (password !== data.config.adminPassword) {
    sendJson(res, 401, { error: 'Neplatné admin heslo.' });
    return;
  }

  createSession(res, 'admin', true);
  sendJson(res, 200, { ok: true });
}

function requireAdmin(req, res) {
  const isAdmin = getSession(req, 'admin');
  if (!isAdmin) {
    sendJson(res, 401, { error: 'Nejste přihlášeni jako admin.' });
    return false;
  }
  return true;
}

function handleAdminState(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const data = loadAllData();
  applyExpirations(data);
  sendJson(res, 200, {
    version: data.config.version,
    config: data.config,
    teams: data.teams,
    cards: data.cards,
    leaderboard: buildLeaderboard(data),
    gameState: data.gameState
  });
}

async function handleAdminSaveCards(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const body = await parseJsonBody(req);
  const cards = sanitizeCards(body.cards || []);
  const error = validateCards(cards);
  if (error) {
    sendJson(res, 400, { error });
    return;
  }

  const data = loadAllData();
  data.cards = cards;
  bumpVersion(data);
  saveAllData(data);
  sendJson(res, 200, { ok: true, version: data.config.version });
}

async function handleAdminSaveTeams(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const body = await parseJsonBody(req);
  const data = loadAllData();
  const teams = sanitizeTeams(body.teams || []);
  const error = validateTeams(teams, data.cards);
  if (error) {
    sendJson(res, 400, { error });
    return;
  }

  data.teams = teams;
  if (typeof body.rowBonus !== 'undefined') {
    data.config.rowBonus = Number(body.rowBonus) || 0;
  }

  pruneGameState(data);
  bumpVersion(data);
  saveAllData(data);
  sendJson(res, 200, { ok: true, version: data.config.version });
}

async function handleAdminResetGame(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const data = loadAllData();
  bumpVersion(data);
  resetGameState(data);
  saveAllData(data);
  sendJson(res, 200, { ok: true, version: data.config.version });
}

async function handleAdminEndGame(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const data = loadAllData();
  data.config.gameEnded = true;
  bumpVersion(data);
  saveAllData(data);
  sendJson(res, 200, { ok: true, version: data.config.version });
}

async function handleAdminUploadImage(req, res) {
  if (!requireAdmin(req, res)) {
    return;
  }

  const body = await parseJsonBody(req);
  const originalName = String(body.filename || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const dataUrl = String(body.data || '');
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    sendJson(res, 400, { error: 'Nahrávání podporuje jen data URL obrázku.' });
    return;
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const extensions = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg'
  };

  const extension = path.extname(originalName) || extensions[mimeType];
  if (!extension) {
    sendJson(res, 400, { error: 'Nepodporovaný typ obrázku.' });
    return;
  }

  const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${extension}`;
  const filePath = path.join(UPLOADS_DIR, fileName);

  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  sendJson(res, 200, { ok: true, imagePath: `/uploads/${fileName}` });
}

async function routeRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'POST' && url.pathname === '/login') {
      await handlePlayerLogin(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/logout') {
      clearSession(res, 'team', req);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/team-state') {
      handleTeamState(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/open-task') {
      await handleOpenTask(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/complete-task') {
      await handleCompleteTask(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/leaderboard') {
      handleLeaderboard(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/login') {
      await handleAdminLogin(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/logout') {
      clearSession(res, 'admin', req);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin/state') {
      handleAdminState(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/save-cards') {
      await handleAdminSaveCards(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/save-teams') {
      await handleAdminSaveTeams(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/reset-game') {
      await handleAdminResetGame(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/end-game') {
      await handleAdminEndGame(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/admin/upload-image') {
      await handleAdminUploadImage(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      sendFile(res, path.join(PUBLIC_DIR, 'login.html'));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin') {
      sendFile(res, path.join(PUBLIC_DIR, 'admin.html'));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/admin-panel.html') {
      if (!getSession(req, 'admin')) {
        res.writeHead(302, { Location: '/admin' });
        res.end();
        return;
      }
      sendFile(res, path.join(PUBLIC_DIR, 'admin-panel.html'));
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/uploads/')) {
      const relativePath = url.pathname.replace('/uploads/', '');
      const filePath = safeJoin(UPLOADS_DIR, relativePath);
      if (!filePath) {
        sendText(res, 400, 'Invalid path.');
        return;
      }
      sendFile(res, filePath);
      return;
    }

    if (req.method === 'GET') {
      const relativePath = url.pathname === '/index' ? '/index.html' : url.pathname;
      const requestedPath = relativePath === '/login' ? '/login.html' : relativePath;
      const filePath = safeJoin(PUBLIC_DIR, requestedPath);
      if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        sendFile(res, filePath);
        return;
      }
    }

    sendText(res, 404, 'Not found.');
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Server error.' });
  }
}

const server = http.createServer(routeRequest);
server.listen(PORT, () => {
  console.log(`City task game running on http://0.0.0.0:${PORT}`);
});
