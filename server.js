const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { scenarioForPlayerCount } = require('./scenarios');
const { publicRoleDefinition, roleDefinition } = require('./game/roles');
const { resolveNight: resolveNightRules, alignmentFor } = require('./game/nightResolver');
const { resolveNominationVotes, resolveFinalVotes } = require('./game/voting');
const { evaluateVictory } = require('./game/victory');
const { canStartGame, canUseNightAction, canSkipNightAction, canSubmitVote, canSubmitDefense, canAdvancePhase, canChat } = require('./game/permissions');
const { WebSocketServer } = require('ws');

const port = Number(process.env.PORT) || 4173;
const root = __dirname;
const maxMessageBytes = 16 * 1024;
const maxMessagesPerWindow = 60;
const messageWindowMs = 10_000;
const room = {
  code: 'MOON-01',
  createdByUser: false,
  phase: 'lobby',
  phaseStartedAt: null,
  phaseDuration: 0,
  nightNumber: 1,
  nominated: null,
  finalVotes: new Map(),
  nominationVotes: new Map(),
  dayProceedVotes: new Set(),
  defenseMessages: [],
  lastNightResult: null,
  nightTurns: [],
  nightTurnIndex: -1,
  nightTurnStartedAt: null,
  scenario: null,
  players: new Map(),
  nextPlayerId: 1
};
const sessions = new Map([['MOON-01', room]]);
const maximumPlayers = 11;
let nextConnectionId = 1;

function createSession(code) {
  return {
    ...room,
    code,
    createdByUser: true,
    finalVotes: new Map(),
    nominationVotes: new Map(),
    dayProceedVotes: new Set(),
    defenseMessages: [],
    players: new Map(),
    nextPlayerId: 1
  };
}

function sessionSummary(session) {
  const identifiedPlayers = [...session.players.values()].filter(player => player.identityReady);
  const host = session.players.get(session.hostId);
  return {
    code: session.code,
    hostId: session.hostId || null,
    hostName: host ? host.name : null,
    phase: session.phase,
    playerCount: identifiedPlayers.length,
    minimumPlayers,
    maximumPlayers,
    status: session.phase === 'lobby' ? 'waiting' : session.phase === 'game-over' ? 'complete' : 'in-progress'
  };
}

function listSessions() {
  return [...sessions.values()].filter(session => session.createdByUser).map(sessionSummary);
}

function removeSessionIfAbandoned(target) {
  if (['lobby', 'game-over'].includes(target.phase) && target.players.size === 0 && target.code !== 'MOON-01') sessions.delete(target.code);
}

function withSession(session, callback) {
  if (session === room) return callback();
  const previous = { ...room };
  for (const key of Object.keys(room)) delete room[key];
  Object.assign(room, session);
  try {
    return callback();
  } finally {
    Object.assign(session, room);
    for (const key of Object.keys(room)) delete room[key];
    Object.assign(room, previous);
  }
}
const phaseDurations = { preparation: 30, night: 40, 'night-resolution': 1, 'night-results': 3, day: 240, vote: 60, defense: 60, final: 40 };
const minimumPlayers = 4;
const nightTurnDuration = 40;

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8'
};

function publicRoomState() {
  const identifiedPlayers = [...room.players.values()].filter(player => player.identityReady);
  return {
    code: room.code,
    isLobby: Boolean(room.createdByUser),
    phase: room.phase,
    winner: room.winner || null,
    hostId: room.hostId || null,
    minimumPlayers,
    maximumPlayers,
    scenarioId: room.scenario?.id || null,
    scenarioPlayerCount: room.scenario?.playerCount || null,
    finalVoteCount: room.finalVotes.size,
    nominationVoteCount: room.nominationVotes.size,
    dayProceedCount: room.dayProceedVotes.size,
    players: identifiedPlayers.map(player => ({ id: player.id, name: player.name, gender: player.gender, alive: player.alive !== false, role: player.alive === false ? player.role : null }))
  };
}

function send(socket, message) {
  if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(message) {
  for (const player of room.players.values()) send(player.socket, message);
}

function broadcastLiving(message) {
  for (const player of room.players.values()) {
    if (player.alive !== false) send(player.socket, message);
  }
}

function broadcastRoom() {
  broadcast({ type: 'room-state', room: publicRoomState() });
}

function announceMembership(playerName, action) {
  if (room.createdByUser) broadcast({ type: 'chat', author: 'System', text: `${playerName} has ${action} the room.`, variant: action === 'joined' ? 'join' : 'leave' });
}

function gameStateFor(player) {
  const timerStart = room.phase === 'night' ? room.nightTurnStartedAt : room.phaseStartedAt;
  const duration = room.phase === 'night' ? nightTurnDuration : room.phaseDuration;
  const elapsed = timerStart ? Math.floor((Date.now() - timerStart) / 1000) : 0;
  return {
    phase: room.phase,
    nightNumber: room.nightNumber,
    nominated: room.nominated,
    finalVoteCount: room.finalVotes.size,
    finalVoted: room.finalVotes.has(player.id),
    nominationVoteCount: room.nominationVotes.size,
    nominationVoted: room.nominationVotes.has(player.id),
    dayProceedCount: room.dayProceedVotes.size,
    dayProceeding: room.dayProceedVotes.has(player.id),
    defenseMessages: player.alive !== false ? [...room.defenseMessages] : [],
    livingPlayerCount: [...room.players.values()].filter(candidate => candidate.alive !== false).length,
    scenarioId: room.scenario?.id || null,
    scenarioPlayerCount: room.scenario?.playerCount || null,
    winner: room.winner || null,
    remainingSeconds: Math.max(0, duration - elapsed),
    activeRole: room.phase === 'night' ? room.nightTurns[room.nightTurnIndex]?.role || null : null,
    activePlayerId: room.phase === 'night' ? room.nightTurns[room.nightTurnIndex]?.id || null : null,
    activeTurnBlocked: room.phase === 'night' && room.nightTurns[room.nightTurnIndex]?.id === player.id ? room.nightTurns[room.nightTurnIndex].blocked === true : false,
    activeTurnInformational: room.phase === 'night' && room.nightTurns[room.nightTurnIndex]?.id === player.id ? room.nightTurns[room.nightTurnIndex].informational === true : false,
    activeTurnInfoTarget: room.phase === 'night' && room.nightTurns[room.nightTurnIndex]?.id === player.id ? room.nightTurns[room.nightTurnIndex].infoTarget || null : null,
    role: player.role || null,
    roleDefinition: player.role ? publicRoleDefinition(player.role) : null,
    selfHealAvailable: player.role === 'Healer' && player.selfHealUsed !== true,
    gender: player.gender || null,
    name: player.name,
    alive: player.alive !== false,
    spectator: player.alive === false,
    deadPlayers: [...room.players.values()].filter(candidate => candidate.alive === false).map(candidate => ({ id: candidate.id, name: candidate.name, role: candidate.role })),
    nightResult: room.lastNightResult
  };
}

function setPhase(phase) {
  room.phase = phase;
  room.phaseStartedAt = phaseDurations[phase] ? Date.now() : null;
  room.phaseDuration = phaseDurations[phase] || 0;
  if (phase !== 'day') room.dayProceedVotes.clear();
}

function proceedToVoting() {
  setPhase('vote');
  broadcastGameState();
  broadcastRoom();
}

function beginNight() {
  setPhase('night');
  room.nightTurns = room.scenario.nightRoleOrder
    .map(role => [...room.players.values()].find(player => player.role === role && player.alive !== false))
    .filter(Boolean)
    .filter(player => player.role !== 'Werewolf' || room.nightNumber % 2 === 0)
    .map(player => ({ id: player.id, role: player.role }));
  room.nightTurnIndex = -1;
  room.nightTurnStartedAt = null;
  advanceNightTurn();
}

function livingThiefExists() {
  return [...room.players.values()].some(player => player.role === 'Thief' && player.alive !== false);
}

function isTurnBlocked(turn) {
  const target = room.players.get(turn.id);
  const keeper = [...room.players.values()].find(player => player.role === 'TavernKeeper' && player.alive !== false);
  if (!target || !keeper || !roleDefinition(target.role)?.canBeBlocked || keeper.action === 'none' || keeper.action !== target.name) return false;
  if (target.role === 'MasterThief' && livingThiefExists()) return false;
  return !(target.role === 'Werewolf' && room.nightNumber % 2 === 0);
}

function advanceNightTurn() {
  room.nightTurnIndex += 1;
  const turn = room.nightTurns[room.nightTurnIndex];
  if (!turn) {
    room.nightTurnStartedAt = null;
    setPhase('night-resolution');
    return;
  }
  turn.blocked = isTurnBlocked(turn);
  if (turn.role === 'Thief') {
    const masterThief = [...room.players.values()].find(candidate => candidate.role === 'MasterThief' && candidate.alive !== false);
    turn.informational = Boolean(masterThief);
    turn.infoTarget = masterThief && masterThief.action && masterThief.action !== 'none' ? masterThief.action : null;
  }
  room.nightTurnStartedAt = Date.now();
}

function broadcastGameState() {
  for (const player of room.players.values()) send(player.socket, { type: 'game-state', game: gameStateFor(player) });
}

function resolveNight() {
  const result = resolveNightRules({ players: [...room.players.values()], nightNumber: room.nightNumber });
  for (const message of result.privateMessages) {
    if (message.type === 'investigation-result' && room.investigationDeliveredNight === room.nightNumber) continue;
    const recipient = room.players.get(message.recipientId);
    if (recipient) {
      const { recipientId, ...payload } = message;
      send(recipient.socket, payload);
    }
  }
  room.lastNightResult = { deaths: result.deaths, healed: result.healed, nightNumber: result.nightNumber };
  room.pendingKillNotices = result.deaths
    .filter(death => ['Thief', 'MasterThief', 'Werewolf', 'Hunter'].includes(death.killerRole))
    .map(death => ({ name: death.name, killerRole: death.killerRole }));
  room.pendingHealNotice = Boolean(result.healed);
  setPhase('night-results');
}

function deliverKillNotices() {
  for (const notice of room.pendingKillNotices || []) {
    const victim = [...room.players.values()].find(player => player.name === notice.name);
    if (victim) send(victim.socket, { type: 'killed-by', killerRole: notice.killerRole });
  }
  room.pendingKillNotices = [];
  if (room.pendingHealNotice) broadcast({ type: 'heal-notice' });
  room.pendingHealNotice = false;
}

function validNightTarget(player, target) {
  if (target === 'none') return true;
  const definition = roleDefinition(player.role);
  if (!definition || definition.targeting.type !== 'living-player') return false;
  const targetPlayer = [...room.players.values()].find(candidate => candidate.name === target && candidate.alive !== false);
  if (!targetPlayer) return false;
  if (player.role === 'Healer' && targetPlayer.id === player.id && player.selfHealUsed === true) return false;
  if (['MasterThief', 'Thief'].includes(player.role) && ['MasterThief', 'Thief'].includes(targetPlayer.role)) return false;
  return definition.targeting.allowSelf || targetPlayer.id !== player.id;
}

function checkVictory(event) {
  return evaluateVictory([...room.players.values()], event);
}

function finishWithWinner(winner) {
  room.winner = winner;
  room.phase = 'game-over';
  room.phaseStartedAt = null;
  room.phaseDuration = 0;
}

function resolveFinalVote() {
  const votes = [...room.finalVotes.values()];
  const nominee = [...room.players.values()].find(candidate => candidate.name === room.nominated);
  const voteResult = resolveFinalVotes({ votes, nominee: nominee?.name || null });
  const executed = voteResult.executed && nominee && nominee.alive !== false;
  if (executed) {
    nominee.alive = false;
    room.lastNightResult = { deaths: [{ name: nominee.name, role: nominee.role, cause: 'execution' }], nightNumber: room.nightNumber };
    const winner = checkVictory({ type: 'execution', role: nominee.role });
    if (winner) finishWithWinner(winner);
  }
  const result = { ...voteResult, executed };
  if (nominee) send(nominee.socket, { type: 'gallows-result', executed: Boolean(executed) });
  room.finalVotes.clear();
  room.nominated = null;
  room.defenseMessages = [];
  if (room.phase !== 'game-over') {
    room.nightNumber += 1;
    room.lastNightResult = null;
    beginNight();
  }
  broadcast({ type: 'vote-result', result });
}

function finalVoters() {
  return [...room.players.values()].filter(player => player.alive !== false && player.name !== room.nominated);
}

function resolveNominationVote() {
  const result = resolveNominationVotes([...room.nominationVotes.values()]);
  const nominee = result.nominee;
  room.nominationVotes.clear();
  if (nominee) {
    room.nominated = nominee;
    room.defenseMessages = [];
    setPhase('defense');
  } else {
    room.nominated = null;
    room.defenseMessages = [];
    room.nightNumber += 1;
    beginNight();
  }
  broadcast({ type: 'nomination-result', result });
}

function advanceExpiredPhase() {
  if (!room.phaseStartedAt || room.phase === 'game-over') return;
  if (room.phase === 'night') {
    if (room.nightTurnStartedAt && Math.floor((Date.now() - room.nightTurnStartedAt) / 1000) >= nightTurnDuration) {
      advanceNightTurn();
      broadcastGameState();
      broadcastRoom();
    }
    return;
  }
  const elapsed = Math.floor((Date.now() - room.phaseStartedAt) / 1000);
  if (elapsed < room.phaseDuration) return;
  if (room.phase === 'preparation') {
    beginNight();
  } else if (room.phase === 'night-resolution') {
    resolveNight();
    const winner = checkVictory();
    if (winner) finishWithWinner(winner);
  } else if (room.phase === 'night-results') {
    setPhase('day');
    deliverKillNotices();
  } else if (room.phase === 'day') {
    proceedToVoting();
  } else if (room.phase === 'vote') {
    resolveNominationVote();
  } else if (room.phase === 'defense') {
    setPhase('final');
  } else if (room.phase === 'final') {
    resolveFinalVote();
  }
  broadcastGameState();
  broadcastRoom();
}

const server = http.createServer((request, response) => {
  let requestPath;
  try {
    requestPath = decodeURIComponent(request.url.split('?')[0]);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
    return;
  }
  if (requestPath === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ status: 'ok', sessions: sessions.size }));
    return;
  }
  const relativePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const filePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, filePath);
  if (relativeToRoot.startsWith('..' + path.sep) || path.isAbsolute(relativeToRoot)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(file);
  });
});

const webSocketServer = new WebSocketServer({ server, path: '/ws', maxPayload: maxMessageBytes });
setInterval(() => {
  for (const session of sessions.values()) withSession(session, advanceExpiredPhase);
}, 1000).unref();

webSocketServer.on('connection', socket => {
  const id = String(nextConnectionId++);
  let player = { id, name: `Player ${id}`, socket, alive: false, identityReady: false, reconnectToken: crypto.randomUUID(), session: room };
  player.messageCount = 0;
  player.messageWindowStartedAt = Date.now();
  if (room.phase !== 'lobby') {
    const code = `VILLAGE-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    player.session = createSession(code);
    sessions.set(code, player.session);
  }
  withSession(player.session, () => {
    if (!room.hostId) room.hostId = id;
    room.players.set(id, player);
  });

  const welcome = withSession(player.session, () => ({ room: publicRoomState(), game: gameStateFor(player) }));
  send(socket, { type: 'welcome', playerId: id, reconnectToken: player.reconnectToken, identityRequired: true, ...welcome });
  withSession(player.session, broadcastRoom);

  socket.on('message', rawMessage => {
    const now = Date.now();
    if (now - player.messageWindowStartedAt >= messageWindowMs) {
      player.messageWindowStartedAt = now;
      player.messageCount = 0;
    }
    player.messageCount += 1;
    if (player.messageCount > maxMessagesPerWindow) {
      send(socket, { type: 'error', code: 'RATE_LIMITED', message: 'Too many messages. Please wait and try again.' });
      return;
    }
    if (Buffer.byteLength(rawMessage) > maxMessageBytes) {
      send(socket, { type: 'error', code: 'MESSAGE_TOO_LARGE', message: 'Message exceeds the allowed size.' });
      return;
    }
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      send(socket, { type: 'error', message: 'Messages must be valid JSON.' });
      return;
    }

    if (message.type === 'list-lobbies') {
      send(socket, { type: 'lobby-list', lobbies: listSessions() });
      return;
    }

    if (message.type === 'delete-lobby' && typeof message.code === 'string') {
      const requestedName = message.code.trim().toLowerCase();
      const target = [...sessions.values()].find(existing => existing.createdByUser && existing.code.toLowerCase() === requestedName);
      if (!target) {
        send(socket, { type: 'error', code: 'LOBBY_NOT_FOUND', message: 'That lobby does not exist.' });
        return;
      }
      if (target.hostId !== player.id) {
        send(socket, { type: 'error', code: 'NOT_HOST', message: 'Only the lobby host can delete this lobby.' });
        return;
      }
      sessions.delete(target.code);
      for (const participant of target.players.values()) {
        if (participant.id === player.id) continue;
        participant.session = room;
        room.players.set(participant.id, participant);
        if (!room.hostId) room.hostId = participant.id;
        send(participant.socket, { type: 'lobby-deleted', code: target.code, message: 'The host deleted the lobby.', room: sessionSummary(room), roomState: publicRoomState() });
      }
      if (player.session.code === target.code) {
        player.session = room;
        room.players.set(player.id, player);
        if (!room.hostId) room.hostId = player.id;
      }
      broadcastRoom();
      send(socket, { type: 'lobby-joined', room: sessionSummary(player.session), roomState: withSession(player.session, publicRoomState) });
      send(socket, { type: 'lobby-list', lobbies: listSessions() });
      return;
    }

    if (message.type === 'leave-lobby') {
      if (!player.session.createdByUser) {
        send(socket, { type: 'error', code: 'NOT_IN_LOBBY', message: 'You are not currently in a lobby.' });
        return;
      }
      if (player.session.phase !== 'lobby') {
        send(socket, { type: 'error', code: 'GAME_ALREADY_STARTED', message: 'You cannot leave a lobby while your current game is active.' });
        return;
      }
      withSession(player.session, () => {
        if (player.identityReady) announceMembership(player.name, 'left');
        room.players.delete(player.id);
        if (room.hostId === player.id) room.hostId = room.players.keys().next().value || null;
        broadcastRoom();
      });
      removeSessionIfAbandoned(player.session);
      player.session = room;
      withSession(player.session, () => {
        player.socket = socket;
        room.players.set(player.id, player);
        if (!room.hostId) room.hostId = player.id;
        broadcastRoom();
      });
      send(socket, { type: 'lobby-joined', room: sessionSummary(player.session), roomState: withSession(player.session, publicRoomState) });
      send(socket, { type: 'lobby-list', lobbies: listSessions() });
      return;
    }

    if (message.type === 'create-lobby') {
      if (player.session.phase !== 'lobby') {
        send(socket, { type: 'error', code: 'GAME_ALREADY_STARTED', message: 'You cannot create a lobby while your current game is active.' });
        return;
      }
      const name = typeof message.name === 'string' ? message.name.trim().slice(0, 30) : '';
      if (!name) {
        send(socket, { type: 'error', code: 'LOBBY_NAME_REQUIRED', message: 'Enter a name for your lobby.' });
        return;
      }
      const nameTaken = [...sessions.values()].some(existing => existing.createdByUser && existing.code.toLowerCase() === name.toLowerCase());
      if (nameTaken) {
        send(socket, { type: 'error', code: 'LOBBY_EXISTS', message: 'That lobby name is already in use.' });
        return;
      }
      const alreadyHosting = [...sessions.values()].some(existing => existing.createdByUser && existing.hostId === player.id);
      if (alreadyHosting) {
        send(socket, { type: 'error', code: 'ALREADY_HOSTING', message: 'You are already hosting another lobby.' });
        return;
      }
      withSession(player.session, () => {
        if (player.identityReady) announceMembership(player.name, 'left');
        room.players.delete(player.id);
        if (room.hostId === player.id) room.hostId = room.players.keys().next().value || null;
        broadcastRoom();
      });
      removeSessionIfAbandoned(player.session);
      const created = createSession(name);
      created.hostId = player.id;
      created.players.set(player.id, player);
      sessions.set(name, created);
      player.session = created;
      if (player.identityReady) withSession(player.session, () => announceMembership(player.name, 'joined'));
      send(socket, { type: 'lobby-joined', room: sessionSummary(player.session), roomState: withSession(player.session, publicRoomState) });
      return;
    }

    if (message.type === 'join-lobby' && typeof message.code === 'string') {
      const requestedName = message.code.trim().toLowerCase();
      const target = [...sessions.values()].find(existing => existing.createdByUser && existing.code.toLowerCase() === requestedName);
      const targetCount = target ? target.players.size : 0;
      if (!target) {
        send(socket, { type: 'error', code: 'LOBBY_NOT_FOUND', message: 'That lobby does not exist.' });
        return;
      }
      if (target.phase !== 'lobby') {
        send(socket, { type: 'error', code: 'GAME_ALREADY_STARTED', message: 'That game has already started.' });
        return;
      }
      if (targetCount >= maximumPlayers) {
        send(socket, { type: 'error', code: 'LOBBY_FULL', message: 'That lobby is full.' });
        return;
      }
      withSession(player.session, () => {
        if (player.identityReady) announceMembership(player.name, 'left');
        room.players.delete(player.id);
        if (room.hostId === player.id) room.hostId = room.players.keys().next().value || null;
        broadcastRoom();
      });
      removeSessionIfAbandoned(player.session);
      player.session = target;
      withSession(player.session, () => {
        player.socket = socket;
        target.players.set(player.id, player);
        if (!room.hostId) room.hostId = player.id;
        if (player.identityReady) announceMembership(player.name, 'joined');
        broadcastRoom();
      });
      send(socket, { type: 'lobby-joined', room: withSession(player.session, publicRoomState), roomSummary: sessionSummary(player.session) });
      return;
    }

    withSession(player.session, () => {

    if (message.type === 'join' && typeof message.name === 'string') {
      const reconnecting = room.phase === 'lobby' && typeof message.reconnectToken === 'string' ? [...room.players.values()].find(candidate => candidate.reconnectToken === message.reconnectToken && candidate.socket === null) : null;
      if (reconnecting) {
        room.players.delete(player.id);
        if (room.hostId === player.id) room.hostId = reconnecting.id;
        player = reconnecting;
        player.socket = socket;
        player.disconnected = false;
        send(socket, { type: 'welcome', playerId: player.id, reconnectToken: player.reconnectToken, identityRequired: false, room: publicRoomState(), game: gameStateFor(player) });
        broadcastRoom();
        return;
      }
      const name = message.name.trim().slice(0, 24);
      const gender = message.gender === 'male' || message.gender === 'female' ? message.gender : null;
      if (!name || !gender || room.phase !== 'lobby' || room.players.size > maximumPlayers) {
        send(socket, { type: 'error', code: 'INVALID_IDENTITY', message: 'Choose a name and gender before entering the lobby.' });
        return;
      }
      if ([...room.players.values()].some(candidate => candidate.id !== player.id && candidate.identityReady && candidate.name.toLowerCase() === name.toLowerCase())) {
        send(socket, { type: 'error', code: 'NAME_TAKEN', message: 'That player name is already in use in this lobby.' });
        return;
      }
      player.name = name;
      player.gender = gender;
      player.identityReady = true;
      broadcastRoom();
      send(socket, { type: 'identity-accepted', playerId: player.id, reconnectToken: player.reconnectToken, name: player.name, gender: player.gender, room: publicRoomState() });
      return;
    }

    if (message.type === 'start-game') {
      const identifiedCount = [...room.players.values()].filter(connectedPlayer => connectedPlayer.identityReady).length;
      if (!canStartGame({ player, hostId: room.hostId, phase: room.phase, identifiedCount, minimumPlayers })) {
        const code = room.phase !== 'lobby' || player.id !== room.hostId ? 'NOT_HOST' : 'NOT_ENOUGH_PLAYERS';
        const messageText = code === 'NOT_HOST' ? 'Only the lobby host can start the game.' : `At least ${minimumPlayers} players are required.`;
        send(socket, { type: 'error', code, message: messageText });
        return;
      }
      room.scenario = scenarioForPlayerCount(identifiedCount);
      if (!room.scenario) {
        send(socket, { type: 'error', code: 'UNSUPPORTED_PLAYER_COUNT', message: `No scenario is configured for ${identifiedCount} players.` });
        return;
      }
      const eligiblePlayers = [...room.players.values()].filter(connectedPlayer => connectedPlayer.identityReady);
      const assignedRoles = shuffled(room.scenario.roles);
      eligiblePlayers.forEach((connectedPlayer, index) => {
        connectedPlayer.role = assignedRoles[index];
        connectedPlayer.alive = true;
        connectedPlayer.action = null;
        connectedPlayer.selfHealUsed = false;
      });
      const thieves = eligiblePlayers.filter(connectedPlayer => ['MasterThief', 'Thief'].includes(connectedPlayer.role));
      if (thieves.length === 2) {
        for (const thief of thieves) {
          const teammate = thieves.find(candidate => candidate.id !== thief.id);
          send(thief.socket, { type: 'team-info', team: 'Thieves', teammate: { id: teammate.id, name: teammate.name, role: teammate.role } });
        }
      }
      setPhase('preparation');
      room.nightNumber = 1;
      room.nominated = null;
      room.finalVotes.clear();
      room.nominationVotes.clear();
      room.defenseMessages = [];
      room.lastNightResult = null;
      room.pendingKillNotices = [];
      room.pendingHealNotice = false;
      room.winner = null;
      broadcast({ type: 'phase-changed', phase: room.phase, by: player.name });
      broadcastGameState();
      broadcastRoom();
      return;
    }

    if (message.type === 'game-action' && message.action === 'night-action') {
      const activeTurn = room.nightTurns[room.nightTurnIndex];
      if (!canUseNightAction({ player, activeTurn, phase: room.phase })) {
        send(socket, { type: 'error', code: 'NOT_ACTIVE_ROLE', message: 'It is not your role turn.' });
        return;
      }
      const target = typeof message.target === 'string' ? message.target : 'none';
      if (!validNightTarget(player, target)) {
        send(socket, { type: 'error', code: 'INVALID_NIGHT_TARGET', message: 'That target is not available for this role.' });
        return;
      }
      player.action = target;
      send(socket, { type: 'action-accepted', action: 'night-action', target: player.action });
      if (player.role === 'Militia' && target !== 'none') {
        const investigated = [...room.players.values()].find(candidate => candidate.name === target && candidate.alive !== false);
        if (investigated) {
          room.investigationDeliveredNight = room.nightNumber;
          send(socket, { type: 'investigation-result', target: investigated.name, alignment: alignmentFor(investigated.role) });
        }
      }
      if (player.role === 'TavernKeeper' && target !== 'none') {
        const blocked = [...room.players.values()].find(candidate => candidate.name === target && candidate.alive !== false);
        if (blocked && roleDefinition(blocked.role)?.canBeBlocked) send(blocked.socket, { type: 'blocked-notice' });
      }
      advanceNightTurn();
      broadcastGameState();
      broadcastRoom();
      return;
    }

    if (message.type === 'game-action' && message.action === 'night-skip') {
      const activeTurn = room.nightTurns[room.nightTurnIndex];
      if (!canSkipNightAction({ player, activeTurn, phase: room.phase })) {
        send(socket, { type: 'error', code: 'NOT_BLOCKED_ROLE', message: 'Only the currently blocked role can skip its turn.' });
        return;
      }
      player.action = 'none';
      send(socket, { type: 'action-accepted', action: 'night-skip', target: 'none' });
      advanceNightTurn();
      broadcastGameState();
      broadcastRoom();
      return;
    }

    if (message.type === 'game-action') {
      if (player.alive === false) {
        send(socket, { type: 'error', code: 'SPECTATOR_ACTION_BLOCKED', message: 'Spectators cannot perform game actions.' });
        return;
      }
      if (message.action === 'advance' && room.phase === 'night') return;
      if (message.action === 'proceed-to-voting' && room.phase === 'day') {
        if (!canAdvancePhase({ player, phase: room.phase })) return;
        room.dayProceedVotes.add(player.id);
        if (room.dayProceedVotes.size >= [...room.players.values()].filter(candidate => candidate.alive !== false).length) proceedToVoting();
        broadcastGameState();
        broadcastRoom();
        return;
      }
      if (message.action === 'defense-message' && room.phase === 'defense') {
        if (!canSubmitDefense({ player, nominee: room.nominated, phase: room.phase }) || typeof message.text !== 'string') return;
        const text = message.text.trim().slice(0, 500);
        if (!text) return;
        const defenseMessage = { author: player.name, text };
        room.defenseMessages.push(defenseMessage);
        broadcastLiving({ type: 'defense-message', message: defenseMessage });
      } else if (message.action === 'nomination-vote' && room.phase === 'vote') {
        if (!canSubmitVote({ player, phase: room.phase }) || typeof message.target !== 'string') return;
        const target = message.target === 'none' ? 'none' : [...room.players.values()].find(candidate => candidate.name === message.target && candidate.alive !== false)?.name;
        if (!target) return;
        room.nominationVotes.set(player.id, target);
        if (room.nominationVotes.size >= [...room.players.values()].filter(candidate => candidate.alive !== false).length) resolveNominationVote();
      } else if (message.action === 'final-vote' && room.phase === 'final') {
        if (!canSubmitVote({ player, phase: room.phase, nominee: room.nominated }) || (message.choice !== 'yes' && message.choice !== 'no')) return;
        room.finalVotes.set(player.id, message.choice);
        if (room.finalVotes.size >= finalVoters().length) resolveFinalVote();
      } else return;
      broadcastGameState();
      broadcastRoom();
      return;
    }

    if (message.type === 'chat' && typeof message.text === 'string' && canChat({ player, phase: room.phase })) {
      const text = message.text.trim().slice(0, 240);
      if (text) broadcast({ type: 'chat', author: player.name, text });
    } else if (message.type === 'chat' && player.alive === false) {
      send(socket, { type: 'error', code: 'SPECTATOR_CHAT_BLOCKED', message: 'Spectators cannot use the living-player chat.' });
    }

    });
  });

  socket.on('error', () => {});

  socket.on('close', () => {
    withSession(player.session, () => {
    if (room.phase !== 'lobby' && room.phase !== 'game-over') {
      player.alive = false;
      player.disconnected = true;
      player.socket = null;
      room.nominationVotes.delete(player.id);
      room.finalVotes.delete(player.id);
      room.dayProceedVotes.delete(player.id);
      const winner = checkVictory({ type: 'disconnect', role: player.role });
      if (winner) finishWithWinner(winner);
      if (room.phase === 'vote' && room.nominationVotes.size >= [...room.players.values()].filter(candidate => candidate.alive !== false).length) resolveNominationVote();
      if (room.phase === 'final' && room.finalVotes.size >= finalVoters().length) resolveFinalVote();
      if (room.phase === 'day' && room.dayProceedVotes.size >= [...room.players.values()].filter(candidate => candidate.alive !== false).length) proceedToVoting();
      broadcastGameState();
      broadcastRoom();
      return;
    }
    room.players.delete(id);
    if (room.hostId === id && room.phase === 'lobby') {
      room.hostId = room.players.keys().next().value || null;
    }
    if (player.identityReady) announceMembership(player.name, 'left');
    broadcastRoom();
    });
    removeSessionIfAbandoned(player.session);
  });
});

server.listen(port, () => {
  console.log(`Village After Dark running at http://localhost:${port}`);
  console.log(`WebSocket room available at ws://localhost:${port}/ws`);
});

function shutdown() {
  for (const session of sessions.values()) {
    for (const participant of session.players.values()) participant.socket?.close(1001, 'Server shutting down');
  }
  webSocketServer.close();
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
