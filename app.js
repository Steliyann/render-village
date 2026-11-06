const app = document.querySelector('#app');
const network = { socket: null, connected: false, roomCode: 'offline', playerId: null, name: null, playerCount: 0, hostId: null, minimumPlayers: 4, maximumPlayers: 11, identityReady: false, isLobby: false, gender: null, reconnectToken: localStorage.getItem('village-reconnect-token'), lobbies: [], loggingOut: false };

const roles = {
  Villager: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Male/1.Male_Villager.png', action: 'No active ability' },
  Healer: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Female/2.Female_Healer.png', action: 'Protect one player from a night attack' },
  Guard: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Male/11.Male_Guard.png', action: 'Guard one player from a night kill or pass' },
  Jailor: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Male/12.Male_Jailor.png', action: 'Jail one player for the night or pass' },
  TavernKeeper: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Male/3.Male_TavernKeeper.png', action: 'Block one player for the night' },
  Militia: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Male/4.Male_Militia.png', action: 'Investigate a player alignment' },
  Judge: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Male/10.Male_Judge.png', action: 'Compare two players as teammates or rivals' },
  Hunter: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Male/5.Male_Hunter.png', action: 'Shoot one player after the first night' },
  Crossbowman: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Male/9.Male_Crossbowman.png', action: 'Shoot up to two players after the first night' },
  Trapper: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Male/13.Male_Trapper.png', action: 'Place one of two traps on yourself; visitors die' },
  RedHat: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Female/6.Female_RedHat.png', action: 'Protected from night attacks while Hunter lives' },
  Shadow: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Female/7.Female_Shadow.png', action: 'See who visited a target' },
  Watcher: { team: 'Townsfolk', image: 'GameImages/Roles/Good/Female/8.Female_Watcher.png', action: 'Learn where a selected player went' },
  MasterThief: { team: 'Thieves', image: 'GameImages/Roles/Evil/Female/1.Female_MasterThief.png', action: 'Choose the target for the Thieves' },
  Thief: { team: 'Thieves', image: 'GameImages/Roles/Evil/Male/2.Male_Thief.png', action: 'Visit and attack the selected target' },
  ThiefShaman: { team: 'Thieves', image: 'GameImages/Roles/Evil/Male/3.Male_Shaman.png', action: 'Silence a player, or attack if both other Thieves are dead' },
  ThiefSeer: { team: 'Thieves', image: 'GameImages/Roles/Evil/Male/4.Male_Seer.png', action: 'Learn a player’s role or attack if the other Thieves are dead' },
  Werewolf: { team: 'Werewolf', image: 'GameImages/Roles/Independent Evil/Male/1.Male_Werewolf.png', action: 'Attack during the full moon' },
  Jester: { team: 'Neutral', image: 'GameImages/Roles/Independent Evil/Female/2.Female_Jester.png', action: 'Win by being executed during the day' },
  Gamester: { team: 'Independent Evil', image: 'GameImages/Roles/Independent Evil/Male/3.Male_LordSmith.png', action: 'Challenge a player to an anonymous game of rock-paper-scissors' }
};

const genderedImages = {
  Villager: { male: 'GameImages/Roles/Good/Male/1.Male_Villager.png', female: 'GameImages/Roles/Good/Female/1.Female_Villager.png' },
  Healer: { male: 'GameImages/Roles/Good/Male/2.Male_Healer.png', female: 'GameImages/Roles/Good/Female/2.Female_Healer.png' },
  Guard: { male: 'GameImages/Roles/Good/Male/11.Male_Guard.png', female: 'GameImages/Roles/Good/Female/11.Female_Guard.png' },
  Jailor: { male: 'GameImages/Roles/Good/Male/12.Male_Jailor.png', female: 'GameImages/Roles/Good/Female/12.Female_Jailor.png' },
  TavernKeeper: { male: 'GameImages/Roles/Good/Male/3.Male_TavernKeeper.png', female: 'GameImages/Roles/Good/Female/3.Female_TavernKeeper.png' },
  Militia: { male: 'GameImages/Roles/Good/Male/4.Male_Militia.png', female: 'GameImages/Roles/Good/Female/4.Female_Militia.png' },
  Judge: { male: 'GameImages/Roles/Good/Male/10.Male_Judge.png', female: 'GameImages/Roles/Good/Female/10.Female_Judge.png' },
  Hunter: { male: 'GameImages/Roles/Good/Male/5.Male_Hunter.png', female: 'GameImages/Roles/Good/Female/5.Female_Hunter.png' },
  Crossbowman: { male: 'GameImages/Roles/Good/Male/9.Male_Crossbowman.png', female: 'GameImages/Roles/Good/Female/9.Female_Crossbowwoman.png' },
  Trapper: { male: 'GameImages/Roles/Good/Male/13.Male_Trapper.png', female: 'GameImages/Roles/Good/Female/13.Female_Trapper.png' },
  RedHat: { male: 'GameImages/Roles/Good/Male/6.Male_RedHat.png', female: 'GameImages/Roles/Good/Female/6.Female_RedHat.png' },
  Shadow: { male: 'GameImages/Roles/Good/Male/7.Male_Shadow.png', female: 'GameImages/Roles/Good/Female/7.Female_Shadow.png' },
  Watcher: { male: 'GameImages/Roles/Good/Male/8.Male_Watcher.png', female: 'GameImages/Roles/Good/Female/8.Female_Watcher.png' },
  MasterThief: { male: 'GameImages/Roles/Evil/Male/1.Male_MasterThief.png', female: 'GameImages/Roles/Evil/Female/1.Female_MasterThief.png' },
  Thief: { male: 'GameImages/Roles/Evil/Male/2.Male_Thief.png', female: 'GameImages/Roles/Evil/Female/2.Female_Thief.png' },
  ThiefShaman: { male: 'GameImages/Roles/Evil/Male/3.Male_Shaman.png', female: 'GameImages/Roles/Evil/Female/3.Female_Shaman.png' },
  ThiefSeer: { male: 'GameImages/Roles/Evil/Male/4.Male_Seer.png', female: 'GameImages/Roles/Evil/Female/4.Female_Seer.png' },
  Werewolf: { male: 'GameImages/Roles/Independent Evil/Male/1.Male_Werewolf.png', female: 'GameImages/Roles/Independent Evil/Female/1.Female_Werewolf.png' },
  Jester: { male: 'GameImages/Roles/Independent Evil/Male/2.Male_Jester.png', female: 'GameImages/Roles/Independent Evil/Female/2.Female_Jester.png' },
  Gamester: { male: 'GameImages/Roles/Independent Evil/Male/3.Male_LordSmith.png', female: 'GameImages/Roles/Independent Evil/Female/3.Female_LadyMargaret.png' }
};

const tutorialSections = [
  {
    title: 'Townsfolk',
    description: 'Work together to identify and remove the threats to the village.',
    roles: [
      { id: 'Villager', description: 'No special ability. Use discussion and voting to help find the hidden threats.' },
      { id: 'Healer', description: 'Choose a player to protect from a night attack. You may heal yourself once per game.' },
      { id: 'Guard', description: 'Guard another player or pass. If a kill targets the guarded player, they survive while the Guard and credited killer die.' },
      { id: 'TavernKeeper', description: 'Block another player’s night ability. The Werewolf cannot be blocked on a Full Moon.' },
      { id: 'Jailor', description: 'Jail one player or pass. The jailed player cannot act, and night actions aimed at them have no effect.' },
      { id: 'Militia', description: 'Investigate a player to learn their alignment. The Master Thief appears Townsfolk / Good; the Thief appears Thieves / Evil.' },
      { id: 'Judge', description: 'Select two players to learn whether they are teammates or rivals, or pass. Your selections count as visits for night effects.' },
      { id: 'Hunter', description: 'Shoot one player starting on the second night. Shooting a Townsfolk player also kills the Hunter that night.' },
      { id: 'Crossbowman', description: 'Shoot after the first night. You have two arrows for the game; passing or being blocked does not spend one.' },
      { id: 'Trapper', description: 'Set a trap on yourself or pass. You have two traps; visitors to a set trap die. Passing or being blocked does not spend a trap.' },
      { id: 'RedHat', description: 'Cannot be killed by a night attack while the Hunter is alive.' },
      { id: 'Shadow', description: 'Choose a player and learn which players visited them that night. You learn names, not roles or intentions.' },
      { id: 'Watcher', description: 'Choose a player and learn where that player went that night. You learn destination names, not roles or intentions.' }
    ]
  },
  {
    title: 'Thieves',
    description: 'The Thieves are a hidden team who know one another and work toward a shared victory.',
    roles: [
      { id: 'MasterThief', description: 'Choose the team’s attack target. The Thief carries out the attack while both are alive; the Master Thief takes over if the Thief is gone.' },
      { id: 'Thief', description: 'Carries out the attack selected by the Master Thief. If the Master Thief is gone, the Thief chooses and performs the attack.' },
      { id: 'ThiefShaman', description: 'While another Thief lives, silence a player for the day and learn the team’s target. If both Master Thief and Thief are dead, choose the team’s kill target instead.' },
      { id: 'ThiefSeer', description: 'While another Thief lives, learn a player’s exact role and share it with the team. If the other three Thieves are dead, choose the team’s kill target instead.' }
    ]
  },
  {
    title: 'Independent Evil',
    description: 'These roles pursue individual victory conditions rather than joining the Thieves.',
    roles: [
      { id: 'Werewolf', description: 'Acts on even-numbered Full Moon nights, cannot be killed at night, and kills players who visit it during a Full Moon.' },
      { id: 'Jester', description: 'Win by being executed through the daytime vote.' },
      { id: 'Gamester', description: 'At night, challenge a living player to anonymous rock-paper-scissors or pass. If not jailed, the target chooses without learning who challenged them. A winning move kills the target at daybreak; two such kills earn an independent victory.' }
    ]
  }
];

const investigationImages = {
  'Townsfolk / Good': 'GameImages/Investigation_Symbols/1.Investigation_Townsfolk.jpg',
  'Thieves / Evil': 'GameImages/Investigation_Symbols/2.Investigation_Thieves.jpg',
  'Independent Evil / Neutral Evil': 'GameImages/Investigation_Symbols/3.Investigation_IndependentEvil.jpg'
};

const killerImages = {
  Thief: 'GameImages/Actions/Evil/1.Action_Thief.png',
  MasterThief: 'GameImages/Actions/Evil/2.Action_MasterThief.png',
  ThiefShaman: 'GameImages/Actions/Evil/5.Action_ThiefShaman_Kill.png',
  ThiefSeer: 'GameImages/Actions/Evil/7.Action_ThiefSeer_Kill.png',
  Werewolf: 'GameImages/Actions/Evil/3.Action_Werewolf.png',
  Gamester: 'GameImages/Actions/Evil/4.Action_RoyalGame.png',
  Hunter: 'GameImages/Actions/Good/2.Action_Hunter.png',
  Crossbowman: 'GameImages/Actions/Good/8.Action_Crossbowman.png',
  Guard: 'GameImages/Actions/Good/11.Action_Guard.png',
  Trapper: 'GameImages/Actions/Good/13.Action_Trapper.png'
};

const blockedImage = 'GameImages/Actions/Good/1.Action_TavernKeeper.png';
const healedImage = 'GameImages/Actions/Good/3.Action_Healer.png';
const jailedImage = 'GameImages/Actions/Good/12.Action_Jailor.png';
const shamanSilenceImage = 'GameImages/Actions/Evil/6.Action_ThiefShaman_Silence.png';
const gamesterGameImage = 'GameImages/Actions/Common/3.ActionSmithMargaretGame.png';
const thiefSeerVisionImage = 'GameImages/Actions/Evil/8.Action_ThiefSeer_Vision.png';
const judgeImages = { teammates: 'GameImages/Actions/Good/9.Action_Judge_Teammates.png', rivals: 'GameImages/Actions/Good/10.Action_Judge_Rivals.png' };
const visitorImages = {
  Shadow: { found: 'GameImages/Actions/Good/5.Action_Shadow_Found.png', empty: 'GameImages/Actions/Good/4.Action_Shadow_NotFound.png' },
  Watcher: { found: 'GameImages/Actions/Good/7.Action_Watcher_Found.png', empty: 'GameImages/Actions/Good/6.Action_Watcher_NotFound.png' }
};
const gallowsImages = { kill: 'GameImages/Actions/Common/1.Gallows_Kill.png', survive: 'GameImages/Actions/Common/2.Gallows_Survive.png' };

const victoryImages = {
  Townsfolk: 'GameImages/Winners/1.Victory_Townsfolk.png',
  Thieves: 'GameImages/Winners/2.Victory_Thieves.png',
  Werewolf: 'GameImages/Winners/3.Victory_Werewolf.png',
  Jester: 'GameImages/Winners/4.Victory_Jester.png',
  Gamester: 'GameImages/Winners/5.Victory_Gamesters.png'
};

const state = { screen: 'identity', phase: 'lobby', nightNumber: 1, timerRemaining: 0, activeRole: null, activePlayerId: null, activeTurnBlocked: false, activeTurnJailed: false, activeTurnFirstNightUnavailable: false, activeTurnInformational: false, activeTurnInfoTarget: null, activeTurnShamanKilling: false, activeTurnSeerKilling: false, gamesterTarget: null, gamesterPrompt: false, gamesterChoicesOpen: false, gamesterWaitingForResponse: false, selfHealAvailable: false, crossbowArrowsRemaining: 2, trapperTrapsRemaining: 2, silenced: false, shamanSilencePreview: false, thiefSeerPreview: null, judgeTargets: [], judgePass: false, judgePreview: null, jailPreview: false, finalVoteCount: 0, finalVoted: false, nominationVoteCount: 0, nominationVoted: false, dayProceedCount: 0, dayProceeding: false, defenseMessages: [], scenarioId: null, scenarioPlayerCount: null, roleDefinition: null, players: [], selected: null, lastResultNight: null, connectionMessage: '', confirmDeleteLobby: null, confirmLeaveLobby: false, popupMessage: null, avatarPreview: null, rolePreview: null, teammatePreview: null, investigationPreview: null, visitorPreview: null, killPreview: null, blockedPreview: false, healedPreview: false, victoryDismissed: false, revealedRoles: {}, log: [{ author: 'System', text: 'The village is waiting for its players.' }] };
let forceChatScrollBottom = false;
let connectionMessageTimeout = null;
state.gallowsPreview = null;
state.tutorialOpen = false;
state.tutorialImagePreview = null;

function showConnectionMessage(message) {
  state.connectionMessage = message;
  if (connectionMessageTimeout !== null) clearTimeout(connectionMessageTimeout);
  const displayedMessage = message;
  connectionMessageTimeout = setTimeout(() => {
    if (state.connectionMessage !== displayedMessage) return;
    state.connectionMessage = '';
    connectionMessageTimeout = null;
    render();
  }, 60_000);
}

function clearConnectionMessage() {
  if (connectionMessageTimeout !== null) clearTimeout(connectionMessageTimeout);
  connectionMessageTimeout = null;
  state.connectionMessage = '';
}

function roleLabel(role) { return role === 'MasterThief' ? 'Master Thief' : role === 'TavernKeeper' ? 'Tavern Keeper' : role === 'ThiefShaman' ? 'Thief Shaman' : role === 'ThiefSeer' ? 'Thief Seer' : role; }
function roleColorClass(role) { const team = roles[role]?.team; return team === 'Townsfolk' ? 'role-color-good' : team === 'Thieves' ? 'role-color-thief' : 'role-color-independent'; }
function coloredRoleLabel(role) { return `<strong class="${roleColorClass(role)}">${roleLabel(role)}</strong>`; }
function alivePlayers() { return state.players.filter(player => player.alive); }
function currentPlayer() { return state.players.find(player => player.id === network.playerId) || state.players[0] || { role: 'Villager', gender: network.gender, alive: true }; }
function imageFor(player) { return genderedImages[player.role]?.[player.gender] || (roles[player.role] || roles.Villager).image; }
function victoryImageFor(winner) { return victoryImages[winner] || null; }
function investigationImageFor(alignment) { return investigationImages[alignment] || null; }
function currentRoleDefinition() { return state.roleDefinition || { team: roles[currentPlayer().role]?.team || 'Townsfolk', description: roles[currentPlayer().role]?.action || 'No active ability' }; }
function acceptRoleDefinition(definition) { if (!definition) return; state.roleDefinition = definition; roles[definition.id] = { ...roles[definition.id], team: definition.team, action: definition.description }; }
function avatarFor(gender) { return gender === 'female' ? 'GameImages/Profile_Avatar/Female/Female_Avatar.png' : 'GameImages/Profile_Avatar/Male/Male_Avatar.png'; }
function renderImageOnlyDialog(action, src, alt, label) {
  return `<div class="modal-overlay image-only-overlay" data-action="${action}"><div class="image-only-dialog" data-modal-content role="dialog" aria-modal="true" aria-label="${label}"><img src="${src}" alt="${alt}"></div></div>`;
}
function phaseLabel() { return state.phase === 'preparation' ? 'Preparation' : state.phase === 'night' ? 'Night phase' : state.phase === 'night-resolution' ? 'Night resolution' : state.phase === 'night-results' ? 'Night results' : state.phase === 'day' ? 'Day discussion' : state.phase === 'vote' ? 'Daytime vote' : state.phase === 'defense' ? 'Defense' : state.phase === 'final' ? 'Final vote' : state.phase === 'game-over' ? 'Game over' : 'Lobby'; }
function timerLabel() { const minutes = Math.floor(state.timerRemaining / 60); const seconds = String(state.timerRemaining % 60).padStart(2, '0'); return state.timerRemaining ? `${minutes}:${seconds}` : '—'; }
function addLog(author, text, variant) { state.log.push({ author, text, variant: variant || null }); if (state.log.length > 60) state.log.splice(0, state.log.length - 60); }
function syncPublicPlayers(players) { state.players = players.map(player => { const previous = state.players.find(existing => existing.id === player.id); return { id: player.id, name: player.name, gender: player.gender, role: player.role || state.revealedRoles[player.id] || (player.id === network.playerId ? previous?.role : null) || 'Villager', alive: player.alive !== false, self: player.id === network.playerId }; }); }
function lobbyScreen() { return network.isLobby ? 'lobby' : 'lobby-browser'; }

function connectToRoom() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
  network.socket = socket;
  socket.addEventListener('open', () => {
    network.connected = true;
    clearConnectionMessage();
    render();
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.type === 'welcome') {
      network.playerId = message.playerId;
      if (message.reconnectToken) { network.reconnectToken = message.reconnectToken; localStorage.setItem('village-reconnect-token', message.reconnectToken); }
      network.roomCode = message.room.code;
      network.isLobby = Boolean(message.room.isLobby);
      network.playerCount = message.room.players.length;
      network.hostId = message.room.hostId;
      network.minimumPlayers = message.room.minimumPlayers;
      network.maximumPlayers = message.room.maximumPlayers || network.maximumPlayers;
      network.lobbies = message.lobbies || network.lobbies;
      network.identityReady = !message.identityRequired || Boolean(message.game.gender);
      network.gender = message.game.gender;
      network.name = message.game.name || network.name;
      if (network.identityReady) syncPublicPlayers(message.room.players);
      if (message.game.role) currentPlayer().role = message.game.role;
      acceptRoleDefinition(message.game.roleDefinition);
      currentPlayer().alive = message.game.alive;
      if (network.identityReady && message.game.phase !== 'lobby') {
        state.screen = 'game';
        state.phase = message.game.phase;
        state.nightNumber = message.game.nightNumber;
        state.selected = message.game.nominated;
        state.timerRemaining = message.game.remainingSeconds;
        state.activeRole = message.game.activeRole;
        state.activePlayerId = message.game.activePlayerId;
        state.activeTurnBlocked = message.game.activeTurnBlocked;
        state.activeTurnJailed = message.game.activeTurnJailed === true;
        state.activeTurnFirstNightUnavailable = message.game.activeTurnFirstNightUnavailable === true;
        state.activeTurnInformational = message.game.activeTurnInformational;
        state.activeTurnInfoTarget = message.game.activeTurnInfoTarget;
        state.activeTurnShamanKilling = message.game.activeTurnShamanKilling === true;
        state.activeTurnSeerKilling = message.game.activeTurnSeerKilling === true;
        state.gamesterPrompt = message.game.gamesterChallengePending === true;
        state.gamesterWaitingForResponse = message.game.gamesterWaitingForResponse === true;
        state.gamesterChoicesOpen = state.gamesterPrompt;
        state.silenced = message.game.silenced === true;
        state.selfHealAvailable = message.game.selfHealAvailable;
        state.crossbowArrowsRemaining = message.game.crossbowArrowsRemaining ?? 2;
        state.trapperTrapsRemaining = message.game.trapperTrapsRemaining ?? 2;
        state.finalVoted = Boolean(message.game.finalVoted);
        state.nominationVoted = Boolean(message.game.nominationVoted);
        state.dayProceedCount = message.game.dayProceedCount || 0;
        state.dayProceeding = Boolean(message.game.dayProceeding);
      }
      if (network.identityReady) state.screen = message.game.phase === 'lobby' ? lobbyScreen() : 'game';
      render();
    }
    if (message.type === 'room-state') {
      network.roomCode = message.room.code;
      network.isLobby = Boolean(message.room.isLobby);
      network.playerCount = message.room.players.length;
      network.hostId = message.room.hostId;
      network.minimumPlayers = message.room.minimumPlayers;
      network.maximumPlayers = message.room.maximumPlayers || network.maximumPlayers;
      if (network.identityReady) syncPublicPlayers(message.room.players);
      state.winner = message.room.winner || null;
      if (state.screen === 'lobby' || state.screen === 'lobby-browser') render();
    }
    if (message.type === 'lobby-list') {
      network.lobbies = message.lobbies || [];
      if (state.screen === 'lobby' || state.screen === 'lobby-browser') render();
    }
    if (message.type === 'lobby-deleted') {
      network.lobbies = network.lobbies.filter(lobby => lobby.code !== message.code);
      const roomData = message.roomState || message.room;
      if (roomData) {
        network.roomCode = roomData.code;
        network.isLobby = Boolean(roomData.isLobby);
        network.playerCount = roomData.players?.length || roomData.playerCount || 0;
        network.hostId = roomData.hostId || network.hostId;
        network.minimumPlayers = roomData.minimumPlayers || network.minimumPlayers;
        network.maximumPlayers = roomData.maximumPlayers || network.maximumPlayers;
        if (roomData.players) syncPublicPlayers(roomData.players);
        state.screen = lobbyScreen();
        state.confirmDeleteLobby = null;
        state.confirmLeaveLobby = false;
        state.popupMessage = message.message || 'The host deleted the lobby.';
      }
      render();
    }
    if (message.type === 'lobby-joined') {
      const room = message.roomState || message.room;
      network.roomCode = room.code;
      network.isLobby = Boolean(room.isLobby);
      network.playerCount = room.players?.length || room.playerCount || 0;
      network.hostId = room.hostId || network.playerId;
      network.minimumPlayers = room.minimumPlayers || network.minimumPlayers;
      network.maximumPlayers = room.maximumPlayers || network.maximumPlayers;
      if (room.players) syncPublicPlayers(room.players);
      network.lobbies = network.lobbies.filter(lobby => lobby.code !== room.code);
      state.screen = lobbyScreen();
      render();
    }
    if (message.type === 'phase-changed' && state.screen === 'lobby') {
      state.screen = 'game';
      state.phase = message.phase;
      addLog('System', `${message.by} started the game.`);
      render();
    }
    if (message.type === 'identity-accepted') {
      network.identityReady = true;
      network.gender = message.gender;
      network.name = message.name;
      if (message.reconnectToken) { network.reconnectToken = message.reconnectToken; localStorage.setItem('village-reconnect-token', message.reconnectToken); }
      network.roomCode = message.room.code;
      network.isLobby = Boolean(message.room.isLobby);
      network.playerCount = message.room.players.length;
      network.hostId = message.room.hostId;
      network.minimumPlayers = message.room.minimumPlayers;
      network.maximumPlayers = message.room.maximumPlayers || network.maximumPlayers;
      syncPublicPlayers(message.room.players);
      state.screen = lobbyScreen();
      render();
    }
    if (message.type === 'game-state') {
      state.screen = message.game.phase === 'lobby' ? lobbyScreen() : 'game';
      state.phase = message.game.phase;
      state.nightNumber = message.game.nightNumber;
      state.selected = message.game.nominated;
      state.timerRemaining = message.game.remainingSeconds;
      state.activeRole = message.game.activeRole;
      state.activePlayerId = message.game.activePlayerId;
      state.activeTurnBlocked = message.game.activeTurnBlocked;
      state.activeTurnJailed = message.game.activeTurnJailed === true;
      state.activeTurnFirstNightUnavailable = message.game.activeTurnFirstNightUnavailable === true;
      state.activeTurnInformational = message.game.activeTurnInformational;
      state.activeTurnInfoTarget = message.game.activeTurnInfoTarget;
      state.activeTurnShamanKilling = message.game.activeTurnShamanKilling === true;
      state.activeTurnSeerKilling = message.game.activeTurnSeerKilling === true;
      const hadGamesterPrompt = state.gamesterPrompt;
      state.gamesterPrompt = message.game.gamesterChallengePending === true;
      state.gamesterWaitingForResponse = message.game.gamesterWaitingForResponse === true;
      if (!state.gamesterPrompt) state.gamesterChoicesOpen = false;
      else if (!hadGamesterPrompt) state.gamesterChoicesOpen = true;
      state.silenced = message.game.silenced === true;
      state.selfHealAvailable = message.game.selfHealAvailable;
      state.crossbowArrowsRemaining = message.game.crossbowArrowsRemaining ?? 2;
      state.trapperTrapsRemaining = message.game.trapperTrapsRemaining ?? 2;
      state.defenseMessages = message.game.defenseMessages || [];
      state.finalVoteCount = message.game.finalVoteCount;
      state.nominationVoteCount = message.game.nominationVoteCount;
      state.finalVoted = Boolean(message.game.finalVoted);
      state.nominationVoted = Boolean(message.game.nominationVoted);
      state.dayProceedCount = message.game.dayProceedCount || 0;
      state.dayProceeding = Boolean(message.game.dayProceeding);
      state.scenarioId = message.game.scenarioId;
      state.scenarioPlayerCount = message.game.scenarioPlayerCount;
      state.finalVoteCount = message.game.finalVoteCount;
      state.nominationVoteCount = message.game.nominationVoteCount;
      state.scenarioId = message.game.scenarioId;
      state.scenarioPlayerCount = message.game.scenarioPlayerCount;
      state.winner = message.game.winner || null;
      if (message.game.nightResult && state.lastResultNight !== message.game.nightResult.nightNumber) {
        const deaths = message.game.nightResult.deaths;
        addLog('System', `${deaths.length ? `Night result: ${deaths.map(death => `${death.name} was found dead (${coloredRoleLabel(death.role)}).`).join(' ')}` : 'Night result: everyone survived the night.'}${message.game.nightResult.healed ? ' Someone was healed during the night.' : ''}`);
        state.lastResultNight = message.game.nightResult.nightNumber;
      }
      if (message.game.role) currentPlayer().role = message.game.role;
      acceptRoleDefinition(message.game.roleDefinition);
      currentPlayer().alive = message.game.alive;
      render();
    }
    if (message.type === 'action-accepted') {
      addLog('System', message.target === 'none' ? 'Your night action was passed.' : 'Your night action was submitted.');
      if (state.screen === 'game') render();
    }
    if (message.type === 'gamester-challenge') {
      state.gamesterPrompt = true;
      state.gamesterChoicesOpen = true;
      if (state.screen === 'game') render();
    }
    if (message.type === 'gamester-day-result') {
      addLog('System', `${message.name} died during the day after a secret game.`);
      if (state.screen === 'game') render();
    }
    if (message.type === 'investigation-result') {
      addLog('Private result', `${message.target} is ${message.alignment}.`);
      const symbol = investigationImageFor(message.alignment);
      if (symbol) state.investigationPreview = { src: symbol, alignment: message.alignment, target: message.target };
      if (state.screen === 'game') render();
    }
    if (message.type === 'judge-result') {
      const relation = message.teammates ? 'teammates' : 'rivals';
      addLog('Private result', `${message.players.join(' and ')} are ${relation}.`);
      state.judgePreview = { src: judgeImages[relation], relation, players: message.players };
      if (state.screen === 'game') render();
    }
    if (message.type === 'thief-seer-result') {
      addLog('Private result', `${message.target} is ${roleLabel(message.role)}.`);
      state.thiefSeerPreview = { target: message.target, role: message.role };
      if (state.screen === 'game') render();
    }
    if (message.type === 'blocked-notice') {
      state.blockedPreview = true;
      if (state.screen === 'game') render();
    }
    if (message.type === 'jail-notice') {
      state.jailPreview = true;
      if (state.screen === 'game') render();
    }
    if (message.type === 'shaman-silence-notice') {
      state.shamanSilencePreview = true;
      if (state.screen === 'game') render();
    }
    if (message.type === 'heal-notice') {
      state.healedPreview = true;
      if (state.screen === 'game') render();
    }
    if (message.type === 'killed-by') {
      const src = killerImages[message.killerRole];
      if (src) state.killPreview = { src, killerRole: message.killerRole };
      if (state.screen === 'game') render();
    }
    if (message.type === 'shadow-result') {
      const role = 'Shadow';
      addLog('Private result', message.visitors.length ? `${message.visitors.join(', ')} visited ${message.target}.` : `Nobody visited ${message.target}.`);
      state.visitorPreview = { role, src: message.visitors.length ? visitorImages[role].found : visitorImages[role].empty, visitors: message.visitors, target: message.target };
      if (state.screen === 'game') render();
    }
    if (message.type === 'watcher-result') {
      const role = 'Watcher';
      addLog('Private result', message.destinations.length ? `${message.target} went to ${message.destinations.join(', ')}.` : `${message.target} did not visit anyone.`);
      state.visitorPreview = { role, src: message.destinations.length ? visitorImages[role].found : visitorImages[role].empty, destinations: message.destinations, target: message.target };
      if (state.screen === 'game') render();
    }
    if (message.type === 'healing-result') {
      addLog('Private result', 'Your healing protected a player from a night attack.');
      if (state.screen === 'game') render();
    }
    if (message.type === 'team-info') {
      for (const member of message.members) {
        state.revealedRoles[member.id] = member.role;
        const known = state.players.find(candidate => candidate.id === member.id);
        if (known) known.role = member.role;
      }
      state.teammatePreview = { members: message.members };
      if (state.screen === 'game') render();
    }
    if (message.type === 'vote-result') {
      addLog('System', message.result.executed ? `${message.result.nominee} was executed (${message.result.yes} YES, ${message.result.no} NO).` : `${message.result.nominee || 'The nominee'} was saved (${message.result.yes} YES, ${message.result.no} NO).`);
      if (state.screen === 'game') render();
    }
    if (message.type === 'gallows-result') {
      state.gallowsPreview = message.executed ? 'kill' : 'survive';
      if (state.screen === 'game') render();
    }
    if (message.type === 'nomination-result') {
      addLog('System', message.result.noGallows ? 'Nomination result: no gallows. The village moves into the next Night.' : `Nomination result: ${message.result.nominee} must defend themselves.`);
      if (state.screen === 'game') render();
    }
    if (message.type === 'defense-message') {
      state.defenseMessages.push(message.message);
      if (state.screen === 'game') render();
    }
    if (message.type === 'error') {
      showConnectionMessage(message.message || 'The server rejected that request.');
      addLog('System', message.message);
      render();
    }
    if (message.type === 'chat') {
      addLog(message.author, message.text, message.variant);
      if (state.screen === 'game' || state.screen === 'lobby') {
        forceChatScrollBottom = !message.variant && message.author === network.name;
        render();
      }
    }
  });
  socket.addEventListener('close', () => {
    network.connected = false;
    if (network.loggingOut) {
      network.loggingOut = false;
      clearConnectionMessage();
      connectToRoom();
    } else {
      showConnectionMessage('Connection lost. Reconnect to continue the session.');
    }
    render();
  });
}

function logout() {
  network.loggingOut = true;
  state.gallowsPreview = null;
  localStorage.removeItem('village-reconnect-token');
  network.reconnectToken = null;
  network.identityReady = false;
  network.gender = null;
  network.name = null;
  network.isLobby = false;
  network.hostId = null;
  network.playerId = null;
  network.lobbies = [];
  state.screen = 'identity';
  state.players = [];
  state.revealedRoles = {};
  state.log = [{ author: 'System', text: 'The village is waiting for its players.' }];
  network.socket?.close();
  render();
}

function sendNetwork(message) {
  if (network.connected && network.socket.readyState === WebSocket.OPEN) network.socket.send(JSON.stringify(message));
}

function renderProfileBar() {
  if (!network.identityReady) return '';
  return `<div class="profile-bar"><span class="profile-name">${network.name || ''}</span><button class="secondary tutorial-trigger" data-action="open-tutorial">Tutorial</button><button class="avatar-trigger profile-avatar-trigger" data-action="show-avatar" data-player-id="self" aria-label="View ${network.name || 'your'} avatar"><img class="profile-avatar" src="${avatarFor(network.gender)}" alt=""></button><button class="secondary" data-action="logout">Log out</button></div>`;
}

function renderTutorial() {
  const sections = tutorialSections.map(section => `
    <section class="tutorial-section" aria-labelledby="tutorial-${section.title.toLowerCase().replaceAll(' ', '-')}">
      <div class="tutorial-section-heading"><h3 id="tutorial-${section.title.toLowerCase().replaceAll(' ', '-')}">${section.title}</h3><p>${section.description}</p></div>
      <div class="tutorial-role-grid">${section.roles.map(role => {
        const art = genderedImages[role.id];
        return `<article class="tutorial-role-card"><div class="tutorial-role-art"><button class="tutorial-image-button" data-tutorial-image="${art.male}" data-tutorial-image-label="${roleLabel(role.id)} male" aria-label="Enlarge ${roleLabel(role.id)} male image"><img src="${art.male}" alt="${roleLabel(role.id)} male"></button><button class="tutorial-image-button" data-tutorial-image="${art.female}" data-tutorial-image-label="${roleLabel(role.id)} female" aria-label="Enlarge ${roleLabel(role.id)} female image"><img src="${art.female}" alt="${roleLabel(role.id)} female"></button></div><div class="tutorial-role-copy"><h4>${roleLabel(role.id)}</h4><p>${role.description}</p></div></article>`;
      }).join('')}</div>
    </section>`).join('');
  return `<div class="modal-overlay tutorial-overlay" data-action="close-tutorial"><section class="tutorial-dialog" data-tutorial-content role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><header class="tutorial-header"><div><div class="eyebrow">Village After Dark</div><h2 id="tutorial-title">Game tutorial</h2><p>Learn the phases, teams, and role abilities.</p></div><button class="avatar-modal-close tutorial-close" data-action="close-tutorial" aria-label="Close tutorial">&times;</button></header><div class="tutorial-intro"><h3>How to play</h3><p>Roles act secretly at night in priority order. Some actions protect, investigate, block, or attack. During the day, living players discuss and vote. If nominated, a player may defend themselves; they are executed only when YES votes outnumber NO votes. Each role has its own team or individual victory condition.</p></div>${sections}</section></div>`;
}

function renderLobbyBrowser() {
  const connectionLabel = network.connected ? 'Connected' : 'Offline demo mode';
  const lobbyItems = network.lobbies.map(lobby => {
    const isOwn = lobby.code === network.roomCode;
    const blockedByOwnLobby = network.isLobby && !isOwn;
    const disabled = isOwn || blockedByOwnLobby || lobby.status !== 'waiting' || lobby.playerCount >= lobby.maximumPlayers;
    const title = blockedByOwnLobby ? 'title="Leave your current lobby to join another"' : '';
    const label = `${lobby.code} · Host: ${lobby.hostName || 'Unknown'} · ${lobby.playerCount}/${lobby.maximumPlayers} · ${lobby.status}${isOwn ? ' (your lobby)' : ''}`;
    return `<div class="lobby-row"><button class="secondary lobby-choice" data-lobby-code="${lobby.code}" ${disabled ? 'disabled' : ''} ${title}>${label}</button>${lobby.hostId === network.playerId ? `<button class="lobby-delete" data-delete-lobby="${lobby.code}" aria-label="Delete lobby ${lobby.code}" title="Delete lobby">✕</button>` : ''}</div>`;
  }).join('');
  const confirmModal = state.confirmDeleteLobby ? `<div class="modal-overlay"><div class="modal"><p>Do you confirm deleting the lobby "${state.confirmDeleteLobby}"?</p><div class="modal-actions"><button class="cta" data-action="confirm-delete-lobby">Yes</button><button class="secondary" data-action="cancel-delete-lobby">No</button></div></div></div>` : '';
  const backToLobby = network.isLobby ? '<button class="secondary" data-action="back-to-lobby">Back to my lobby</button>' : '';
  const createLobbyDisabled = network.isLobby ? 'disabled title="Leave your current lobby to create another"' : '';
  app.innerHTML = `<header class="topbar"><div class="brand"><span class="brand-mark">✦</span> Village After Dark</div><div class="topbar-right">${renderProfileBar()}</div></header><section class="landing"><div class="landing-card"><div class="landing-copy"><div><div class="eyebrow">${connectionLabel}</div><h1>Village<br>After Dark</h1><p>Create a new lobby or join an existing one to gather your village.</p></div><div><div class="lobby-tools">${backToLobby}<button class="secondary" data-action="list-lobbies">Refresh lobbies</button><label>Name of the lobby<input data-lobby-name maxlength="30" placeholder="e.g. Midnight Circle" required></label><button class="secondary" data-action="create-lobby" ${createLobbyDisabled}>Create lobby</button>${lobbyItems}</div></div></div><div class="landing-art"><div class="art-note"><h2>The moon is rising.</h2><p>Keep your role secret. Watch who moves in the dark. Trust nobody too quickly.</p></div></div></div></section>${confirmModal}`;
}

function renderLobby() {
  const isHost = network.playerId === network.hostId;
  const canStart = isHost && network.playerCount >= network.minimumPlayers;
  const lobbyMessage = !isHost ? 'The host controls when the village begins.' : !canStart ? `Waiting for ${network.minimumPlayers - network.playerCount} more player${network.minimumPlayers - network.playerCount === 1 ? '' : 's'}.` : 'The village is ready.';
  const playerItems = state.players.map(player => `<div class="player"><button class="avatar-trigger" data-action="show-avatar" data-player-id="${player.id}" aria-label="View ${player.name}'s avatar"><img class="avatar" src="${avatarFor(player.gender)}" alt=""></button><div class="player-name">${player.name}${player.id === network.playerId ? ' <span style="color:var(--red)">(you)</span>' : ''}${player.id === network.hostId ? ' <span class="status"></span> Host' : ''}</div></div>`).join('');
  const confirmModal = state.confirmDeleteLobby ? `<div class="modal-overlay"><div class="modal"><p>Do you confirm deleting the lobby "${state.confirmDeleteLobby}"?</p><div class="modal-actions"><button class="cta" data-action="confirm-delete-lobby">Yes</button><button class="secondary" data-action="cancel-delete-lobby">No</button></div></div></div>` : state.confirmLeaveLobby ? `<div class="modal-overlay"><div class="modal"><p>Do you confirm leaving the lobby "${network.roomCode}"?</p><div class="modal-actions"><button class="cta" data-action="confirm-leave-lobby">Yes</button><button class="secondary" data-action="cancel-leave-lobby">No</button></div></div></div>` : '';
  const membershipControl = isHost ? `<button class="secondary" data-delete-lobby="${network.roomCode}">Delete lobby</button>` : `<button class="secondary" data-action="leave-lobby">Leave lobby</button>`;
  app.innerHTML = `<section class="game"><header class="topbar"><div class="brand"><span class="brand-mark">✦</span> Village After Dark</div><div class="topbar-right"><div class="phase-pill"><span class="phase-dot"></span>Lobby · ${network.roomCode}</div>${renderProfileBar()}</div></header><div class="board"><div class="board-grid"><section class="scene"><div class="scene-heading"><div><div class="scene-kicker">Waiting for players</div><h1>${network.roomCode}</h1></div></div><p class="phase-message">${network.playerCount}/${network.maximumPlayers} players · ${lobbyMessage}</p><div class="action-panel"><h3>Players</h3><div class="player-list">${playerItems}</div><div class="action-row">${isHost ? `<button class="primary" data-action="start" ${canStart ? '' : 'disabled'}>Start game</button>` : ''}<button class="secondary" data-action="browse-lobbies">Browse lobbies</button>${membershipControl}</div></div></section><aside class="sidebar">${renderChat()}</aside></div></div></section>${confirmModal}`;
}


function renderIdentity() {
  app.innerHTML = `<section class="landing"><div class="landing-card"><div class="landing-copy"><div><div class="eyebrow">Before the village gathers</div><h1>Choose your<br>identity.</h1><p>Your name is public. Your gender selects the character artwork and profile avatar used when your secret role is revealed.</p></div><form class="identity-form" data-identity><label>Display name<input name="name" maxlength="24" required placeholder="Enter your village name" autocomplete="nickname"></label><fieldset><legend>Character artwork</legend><label class="choice"><input type="radio" name="gender" value="male" required> Male</label><label class="choice"><input type="radio" name="gender" value="female" required> Female</label></fieldset><button class="cta" type="submit">Enter the lobby <span>→</span></button></form></div><div class="landing-art"><div class="art-note"><h2>Bring a name into the dark.</h2><p>Your chosen identity stays with you throughout the session.</p></div></div></div></section>`;
}

function renderPlayerList() {
  return `<div class="player-list">${state.players.map(player => { const teammate = Boolean(state.revealedRoles[player.id]); const showRole = player.self || player.revealed || !player.alive || teammate; const roleText = !player.alive ? `Role revealed · ${roleLabel(player.role)}` : showRole ? roleLabel(player.role) : 'Role hidden'; const showRoleImage = player.revealed || !player.alive; const avatarSrc = showRoleImage ? imageFor(player) : avatarFor(player.gender); return `<div class="player"><button class="avatar-trigger" data-action="show-avatar" data-player-id="${player.id}" aria-label="View ${player.name}'s ${showRoleImage ? 'role' : 'avatar'}"><img class="avatar ${showRoleImage ? 'role-thumbnail' : ''}" src="${avatarSrc}" alt=""></button><div class="player-name">${player.name}${player.self ? ' <span style="color:var(--red)">(you)</span>' : ''}<span class="player-role">${roleText}</span></div><span class="status ${player.alive ? '' : 'dead'}"></span></div>`; }).join('')}</div>`;
}

function renderDefensePanel() {
  const isNominee = currentPlayer().name === state.selected;
  const messages = state.defenseMessages.map(message => `<div class="chat-line"><strong>${message.author}</strong> ${message.text}</div>`).join('');
  const input = isNominee && state.silenced
    ? '<div class="locked">◼ You have been silenced for today. I can\'t write in the chat.</div>'
    : isNominee ? '<form class="chat-input" data-defense><input name="message" maxlength="500" placeholder="Make your case..." autocomplete="off"><button aria-label="Send defense">↑</button></form>' : '<div class="locked">The nominee has one minute to speak.</div>';
  return `<div class="action-panel"><h3>${state.selected} has the floor</h3><p>One minute to defend themselves. The village listens, then makes the final decision.</p><div class="chat-log">${messages || '<div class="locked">No defense submitted yet.</div>'}</div>${input}</div>`;
}

function renderActionPanel() {
  const me = currentPlayer();
  if (!me.alive) return `<div class="action-panel"><h3>Spectator mode</h3><p>Your role is revealed. You can watch the game, but you cannot vote, perform role actions, or influence the living chat.</p><div class="locked">◼ Read-only spectator</div></div>`;
  if (state.phase === 'preparation') return `<div class="action-panel"><h3>Roles assigned</h3><p>The village is preparing. Your first Night begins when the preparation timer reaches zero.</p><div class="locked">◼ First Night starts automatically</div></div>`;
  if (state.phase === 'night') {
    if (state.activeTurnJailed) return `<div class="action-panel"><h3>You are jailed</h3><p>You cannot perform a night action this turn. Click Proceed to continue.</p><div class="action-row"><button class="primary" data-action="night-skip">Proceed</button></div></div>`;
    if (state.gamesterPrompt) return `<div class="action-panel"><h3>A secret game awaits</h3><p>Choose rock, paper, or scissors in the image prompt. Your opponent's identity is hidden.</p><div class="locked">◼ Your response is required before Night continues</div></div>`;
    if (me.role === 'Hunter' && state.nightNumber === 1) return `<div class="action-panel"><h3>Hunter action unavailable</h3><p>The Hunter cannot shoot during the first night. Your turn will pass automatically.</p><div class="locked">◼ First-night restriction</div></div>`;
    if (me.role === 'Trapper' && state.trapperTrapsRemaining <= 0) return `<div class="action-panel"><h3>No traps remaining</h3><p>You have used both Trapper traps for this game.</p><div class="locked">◼ Traps exhausted</div></div>`;
    if (me.role !== state.activeRole) return `<div class="action-panel"><h3>Waiting for another player</h3><p>Night actions resolve in order. Please wait for your turn.</p><div class="locked">◼ Another player is acting</div></div>`;
    if (state.activeTurnBlocked) return `<div class="action-panel"><h3>Night ability blocked</h3><p>Your role cannot act during this Night. Continue when ready.</p><div class="action-row"><button class="primary" data-action="night-skip">Continue</button><span class="locked">Blocked for this Night only</span></div></div>`;
    if (state.activeTurnFirstNightUnavailable) return `<div class="action-panel"><h3>Crossbowman action unavailable</h3><p>You cannot shoot during the first night. You have ${state.crossbowArrowsRemaining} arrows remaining.</p><div class="action-row"><button class="primary" data-action="night-skip">Proceed</button><span class="locked">First-night restriction</span></div></div>`;
    if (me.role === 'Crossbowman' && state.crossbowArrowsRemaining <= 0) return `<div class="action-panel"><h3>No arrows remaining</h3><p>You have used both Crossbowman arrows for this game.</p><div class="locked">◼ Ammunition exhausted</div></div>`;
    if (state.activeTurnInformational) return `<div class="action-panel"><h3>Master Thief's choice</h3><p>${state.activeTurnInfoTarget ? `The Master Thief has chosen <strong>${state.activeTurnInfoTarget}</strong> as tonight's target.` : 'The Master Thief did not choose a target tonight.'}</p><div class="action-row"><button class="primary" data-action="night-skip">Continue</button><span class="locked">The Master Thief leads the attack</span></div></div>`;
    if (me.role === 'Gamester') {
      if (state.gamesterWaitingForResponse) return `<div class="action-panel"><h3>Game in progress</h3><p>Your choice is locked. The other player is making an anonymous choice.</p><div class="locked">◼ Night continues after their response</div></div>`;
      return `<div class="action-panel"><h3>Gamester action</h3><p>Choose one living player to challenge, or pass this turn.</p><div class="target-grid">${alivePlayers().filter(player => !player.self).map(player => `<button class="target" data-target="${player.name}">${player.name}</button>`).join('')}<button class="target" data-action="gamester-pass">Play with no one</button></div></div>`;
    }
    const excludeThiefTeammates = roles[me.role]?.team === 'Thieves'
      && (me.role !== 'ThiefShaman' || state.activeTurnShamanKilling);
    const targets = alivePlayers().filter(player => !player.self
      && !(excludeThiefTeammates && roles[player.role]?.team === 'Thieves'));
    if (me.role === 'ThiefShaman') {
      const targetInfo = state.activeTurnInfoTarget ? `The Thieves have chosen <strong>${state.activeTurnInfoTarget}</strong> as their kill target tonight.` : 'The Thieves have not selected a kill target yet.';
      const prompt = state.activeTurnShamanKilling
        ? 'Both the Master Thief and Thief are dead. Choose a player to kill, or pass.'
        : 'Choose one player to silence during the day, or pass.';
      return `<div class="action-panel"><h3>Thief Shaman action</h3><p>${targetInfo}</p><p>${prompt}</p><div class="target-grid">${targets.map(player => `<button class="target ${state.selected === player.name ? 'selected' : ''}" data-target="${player.name}">${player.name}</button>`).join('')}<button class="target ${state.selected === 'none' ? 'selected' : ''}" data-target="none">Do not select anyone</button></div><div class="action-row"><button class="primary" data-action="confirm">${!state.selected || state.selected === 'none' ? 'Pass night action' : state.activeTurnShamanKilling ? 'Choose kill target' : 'Silence selected player'}</button><span class="locked">${state.activeTurnShamanKilling ? 'Your selection is the Thieves attack' : 'Silence lasts through the day'}</span></div></div>`;
    }
    if (me.role === 'ThiefSeer') {
      const prompt = state.activeTurnSeerKilling
        ? 'The Master Thief, Thief, and Thief Shaman are dead. Choose a player for the Thieves to kill, or pass.'
        : 'Choose one player to learn their role with the Thieves team, or pass.';
      return `<div class="action-panel"><h3>Thief Seer action</h3><p>${prompt}</p><div class="target-grid">${targets.map(player => `<button class="target ${state.selected === player.name ? 'selected' : ''}" data-target="${player.name}">${player.name}</button>`).join('')}<button class="target ${state.selected === 'none' ? 'selected' : ''}" data-target="none">Do not select anyone</button></div><div class="action-row"><button class="primary" data-action="confirm">${!state.selected || state.selected === 'none' ? 'Pass night action' : state.activeTurnSeerKilling ? 'Choose kill target' : 'Check role'}</button><span class="locked">${state.activeTurnSeerKilling ? 'Your selection is the Thieves attack' : 'Role result is shared privately with the team'}</span></div></div>`;
    }
    if (me.role === 'Judge') return `<div class="action-panel"><h3>Judge action</h3><p>Select two different living players to learn whether they are teammates or rivals. You may also pass without choosing anyone.</p><div class="target-grid">${alivePlayers().filter(player => !player.self).map(player => `<button class="target ${state.judgeTargets.includes(player.name) ? 'selected' : ''}" data-judge-target="${player.name}">${player.name}</button>`).join('')}<button class="target ${state.judgePass ? 'selected' : ''}" data-judge-pass>Do not select anyone</button></div><div class="action-row"><button class="primary" data-action="confirm" ${state.judgeTargets.length !== 2 && !state.judgePass ? 'disabled' : ''}>${state.judgePass ? 'Pass night action' : 'Compare selected players'}</button><span class="locked">${state.judgePass ? 'Action passed' : `${state.judgeTargets.length}/2 selected`}</span></div></div>`;
    if (me.role === 'Trapper') return `<div class="action-panel"><h3>Trapper action</h3><p>Choose whether to set a trap on yourself tonight. Every visitor will die. You have ${state.trapperTrapsRemaining} traps remaining.</p><div class="target-grid"><button class="target ${state.selected === me.name ? 'selected' : ''}" data-target="${me.name}">Set a trap on yourself</button><button class="target ${state.selected === 'none' ? 'selected' : ''}" data-target="none">Do not place a trap</button></div><div class="action-row"><button class="primary" data-action="confirm">${state.selected === me.name ? 'Set trap' : 'Pass night action'}</button><span class="locked">Traps are spent only when placed</span></div></div>`;
      const action = currentRoleDefinition().description;
    return `<div class="action-panel"><h3>${roleLabel(me.role)} action</h3><p>${action}${me.role === 'Crossbowman' ? ` (${state.crossbowArrowsRemaining} arrows remaining)` : ''}. Choose a player or pass your turn. Your choice will resolve when the night timer ends.</p><div class="target-grid">${targets.map(player => `<button class="target ${state.selected === player.name ? 'selected' : ''}" data-target="${player.name}">${player.name}</button>`).join('')}<button class="target ${state.selected === 'none' ? 'selected' : ''}" data-target="none">Do not select</button></div><div class="action-row"><button class="primary" data-action="confirm">Confirm action</button><span class="locked">Night resolves automatically</span></div></div>`;
  }
  if (state.phase === 'day') return `<div class="action-panel"><h3>Speak before the vote</h3><p>The village has four minutes to compare stories. The chat is open again.</p><div class="action-row"><span class="locked">Waiting for the phase timer</span><button class="secondary" data-action="proceed-to-voting" ${state.dayProceeding ? 'disabled' : ''}>${state.dayProceeding ? 'Waiting for everyone' : 'Proceed to voting'}</button></div><small>${state.dayProceedCount || 0}/${alivePlayers().length} ready</small></div>`;
  if (state.phase === 'vote') return `<div class="action-panel"><h3>Who goes to the gallows?</h3><p>Vote for one living player or choose no gallows. A unique plurality opens Defense.</p><div class="target-grid">${alivePlayers().filter(player => !player.self).map(player => `<button class="target ${state.selected === player.name ? 'selected' : ''}" data-target="${player.name}" ${state.nominationVoted ? 'disabled' : ''}>${player.name}</button>`).join('')}<button class="target ${state.selected === 'none' ? 'selected' : ''}" data-target="none" ${state.nominationVoted ? 'disabled' : ''}>No gallows</button></div><div class="action-row"><button class="primary" data-action="nomination-vote" ${state.nominationVoted ? 'disabled' : ''}>${state.nominationVoted ? 'Vote submitted' : 'Cast nomination vote'}</button></div><small>${state.nominationVoteCount || 0} votes received</small></div>`;
  if (state.phase === 'defense') return renderDefensePanel();
  if (state.phase === 'final') {
    if (me.name === state.selected) return `<div class="action-panel"><h3>Final decision</h3><p>You are on the gallows and cannot vote on your own fate.</p><div class="locked">The village is deciding.</div><small>${state.finalVoteCount || 0} votes received</small></div>`;
    return `<div class="action-panel"><h3>Final decision</h3><p>Cast your vote. The majority decides whether ${state.selected} is executed.</p><div class="action-row"><button class="primary" data-action="final-vote" data-choice="no" ${state.finalVoted ? 'disabled' : ''}>${state.finalVoted ? 'Vote submitted' : 'Save'}</button><button class="danger" data-action="final-vote" data-choice="yes" ${state.finalVoted ? 'disabled' : ''}>${state.finalVoted ? 'Vote submitted' : 'Execute'}</button></div><small>${state.finalVoteCount || 0} votes received</small></div>`;
  }
  if (state.phase === 'game-over') return `<div class="action-panel"><h3>${state.winner} victory</h3><p>The game has ended. The surviving roles and final result are now revealed.</p></div>`;
  return `<div class="action-panel"><h3>The village is ready.</h3><p>Start the demo to assign roles and begin the first night.</p></div>`;
}

function renderChat() {
  const locked = ['night', 'night-resolution', 'night-results', 'preparation'].includes(state.phase);
  const spectator = state.phase !== 'lobby' && !currentPlayer().alive;
  const silenced = state.silenced && !locked && !spectator;
  const lines = state.log.slice(-60).map(line => {
    const isSelf = !line.variant && line.author === network.name;
    const cssClass = line.variant ? `chat-line-${line.variant}` : isSelf ? 'chat-line-self' : '';
    const body = line.text;
    return `<div class="chat-line ${cssClass}"><strong>${line.author}:</strong> ${body}</div>`;
  }).join('');
  return `<div class="panel"><div class="panel-title"><h2>Village chat</h2><span>${locked || spectator || silenced ? 'locked' : 'live'}</span></div>${locked ? '<div class="locked">◼ Night chat is sealed</div>' : spectator ? '<div class="locked">◼ Spectators cannot chat with the living</div>' : `<div class="chat"><div class="chat-log">${lines}</div>${silenced ? '<div class="locked">◼ You have been silenced for today. You can still read chat.</div>' : '<form class="chat-input" data-chat><input name="message" placeholder="Say something careful..." autocomplete="off"><button aria-label="Send message">↑</button></form>'}</div>`}</div>`;
}

function renderGame() {
  const day = ['day', 'vote', 'defense', 'final'].includes(state.phase);
  const fullMoon = state.phase === 'night' && state.nightNumber % 2 === 0;
  const me = currentPlayer();
  app.innerHTML = `<section class="game"><header class="topbar"><div class="brand"><span class="brand-mark">✦</span> Village After Dark</div><div class="topbar-right"><div class="phase-pill"><span class="phase-dot"></span>${phaseLabel()} · ${alivePlayers().length} alive · ${network.connected ? `Room ${network.roomCode}` : 'offline'}</div>${renderProfileBar()}</div></header><div class="board"><div class="board-grid"><section class="scene ${day ? 'day' : ''} ${fullMoon ? 'full-moon' : ''}"><div class="scene-heading"><div><div class="scene-kicker">${state.phase === 'preparation' ? 'The village takes its places' : state.phase === 'night' ? (fullMoon ? 'A full moon over the rooftops' : 'The village sleeps') : 'The village gathers'}</div><h1>${state.phase === 'preparation' ? 'Prepare yourselves.' : state.phase === 'night' ? 'Night falls.' : state.phase === 'day' ? 'Morning reckons.' : state.phase === 'vote' ? 'Name the guilty.' : state.phase === 'defense' ? 'Make your case.' : state.phase === 'final' ? 'The last word.' : 'Waiting.'}</h1></div><div class="timer">${timerLabel()}</div></div><p class="phase-message">${state.phase === 'preparation' ? 'Roles are private. The first Night begins automatically when preparation ends.' : state.phase === 'night' ? 'The common chat is closed. Only roles with a night action may move, and every visit leaves a trace.' : 'Listen for contradictions. A confident accusation can be a shield, and silence can be an alibi.'}</p>${renderActionPanel()}</section><aside class="sidebar"><div class="panel"><div class="panel-title"><h2>Your role</h2><span>${roles[me.role].team}</span></div><div class="role-card"><img src="${imageFor(me)}" alt="${roleLabel(me.role)}" data-action="show-role" class="role-card-image"><div><h3>${roleLabel(me.role)}</h3><small>${roles[me.role].action}</small></div></div></div><div class="panel"><div class="panel-title"><h2>Players</h2><span>${alivePlayers().length}/8 standing</span></div>${renderPlayerList()}</div>${renderChat()}<div class="utility-row"><button class="secondary" data-action="reset">Reset demo</button><button class="secondary" data-action="reveal">Reveal roles</button></div></aside></div></div></section>`;
}

function addSelfHealTarget() {
  if (state.phase !== 'night' || currentPlayer().role !== 'Healer' || !state.selfHealAvailable) return;
  const grid = document.querySelector('.target-grid');
  if (!grid) return;
  const button = document.createElement('button');
  button.className = `target ${state.selected === currentPlayer().name ? 'selected' : ''}`;
  button.dataset.target = currentPlayer().name;
  button.textContent = 'Heal yourself';
  grid.prepend(button);
}

function normalizeProductionView() {
  document.querySelectorAll('[data-action="reset"], [data-action="reveal"]').forEach(control => control.remove());
  document.querySelectorAll('[data-action="to-vote"], [data-action="to-final"]').forEach(control => {
    control.removeAttribute('data-action');
    control.disabled = true;
    control.className = 'locked';
    control.textContent = 'Waiting for the phase timer';
  });
  const playerLabels = document.querySelectorAll('.panel-title span');
  const scenarioSize = state.scenarioPlayerCount || network.playerCount;
  if (playerLabels[1] && scenarioSize) playerLabels[1].textContent = `${alivePlayers().length}/${scenarioSize} standing`;
  const phaseCopy = {
    preparation: ['The village takes its places', 'Prepare yourselves.'],
    'night-resolution': ['The night settles its debts', 'The dark remembers.'],
    'night-results': ['Morning gathers the evidence', 'Here is what happened.'],
    day: ['The village gathers', 'Morning reckons.'],
    vote: ['The village names a suspect', 'Name the guilty.'],
    defense: ['The accused has the floor', 'Make your case.'],
    final: ['The village decides', 'The last word.'],
    'game-over': ['The village has its answer', 'The game is over.']
  }[state.phase];
  if (phaseCopy) {
    const kicker = app.querySelector('.scene-kicker');
    const heading = app.querySelector('.scene h1');
    if (kicker) kicker.textContent = phaseCopy[0];
    if (heading) heading.textContent = phaseCopy[1];
  }
  if (state.connectionMessage) {
    const notice = document.createElement('div');
    notice.className = 'connection-notice';
    notice.textContent = state.connectionMessage;
    app.prepend(notice);
  }
}

function render() {
  const priorChatLog = app.querySelector('.chat-log');
  const priorChatScrollTop = priorChatLog ? priorChatLog.scrollTop : null;
  const priorTutorial = app.querySelector('.tutorial-dialog');
  const priorTutorialScrollTop = priorTutorial ? priorTutorial.scrollTop : null;
  const focusedInput = document.activeElement?.matches('[data-chat] input[name="message"], [data-defense] input[name="message"]') ? document.activeElement : null;
  const focusedSelector = focusedInput ? (focusedInput.closest('[data-chat]') ? '[data-chat] input[name="message"]' : '[data-defense] input[name="message"]') : null;
  const focusedValue = focusedInput ? focusedInput.value : null;
  const focusedSelectionStart = focusedInput ? focusedInput.selectionStart : null;
  const focusedSelectionEnd = focusedInput ? focusedInput.selectionEnd : null;
  if (state.screen === 'identity') renderIdentity();
  else if (state.screen === 'lobby-browser') renderLobbyBrowser();
  else if (state.screen === 'lobby') renderLobby();
  else { renderGame(); addSelfHealTarget(); }
  normalizeProductionView();
  if (state.popupMessage) {
    app.insertAdjacentHTML('beforeend', `<div class="modal-overlay"><div class="modal"><p>${state.popupMessage}</p><div class="modal-actions"><button class="cta" data-action="dismiss-popup">OK</button></div></div></div>`);
  }
  if (state.avatarPreview) {
    app.insertAdjacentHTML('beforeend', `<div class="modal-overlay avatar-preview-overlay" data-action="close-avatar"><div class="avatar-preview" data-modal-content role="dialog" aria-modal="true" aria-label="${state.avatarPreview.name}'s avatar"><button class="avatar-modal-close" data-action="close-avatar" aria-label="Close avatar preview">&times;</button><img src="${state.avatarPreview.src}" alt="${state.avatarPreview.name}'s avatar"><p>${state.avatarPreview.name}</p></div></div>`);
    app.querySelector('.avatar-modal-close')?.focus();
  }
  if (state.rolePreview) {
    app.insertAdjacentHTML('beforeend', `<div class="modal-overlay avatar-preview-overlay" data-action="close-role"><div class="avatar-preview role-preview" data-modal-content role="dialog" aria-modal="true" aria-label="${state.rolePreview.name} role"><button class="avatar-modal-close" data-action="close-role" aria-label="Close role preview">&times;</button><img src="${state.rolePreview.src}" alt="${state.rolePreview.name}"></div></div>`);
    app.querySelector('.avatar-modal-close')?.focus();
  }
  if (state.teammatePreview) {
    const roster = state.teammatePreview.members.map(member => {
      const name = member.name.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
      return `<li>${name}: ${roleLabel(member.role)}</li>`;
    }).join('');
    app.insertAdjacentHTML('beforeend', `<div class="modal-overlay thieves-team-overlay" data-action="close-teammate"><div class="thieves-team-dialog" data-modal-content role="dialog" aria-modal="true" aria-label="Thieves team" tabindex="-1"><img src="GameImages/Roles/Evil/Team/1.ThievesTeam.png" alt="Thieves team"><ul class="thieves-team-roster" aria-label="Team members">${roster}</ul></div></div>`);
    app.querySelector('.thieves-team-dialog')?.focus();
  }
  if (state.investigationPreview) {
    app.insertAdjacentHTML('beforeend', `<div class="modal-overlay victory-overlay" data-action="close-investigation"><div class="victory-dialog" data-modal-content role="dialog" aria-modal="true" aria-label="Investigation result"><button class="avatar-modal-close victory-close" data-action="close-investigation" aria-label="Close investigation result">&times;</button><img class="victory-image" src="${state.investigationPreview.src}" alt="Investigation result"><p class="investigation-name">${state.investigationPreview.target}</p></div></div>`);
    app.querySelector('.victory-close')?.focus();
  }
  if (state.judgePreview) {
    app.insertAdjacentHTML('beforeend', renderImageOnlyDialog('close-judge', state.judgePreview.src, `Judge result: ${state.judgePreview.relation}`, `Judge result: ${state.judgePreview.relation}`));
  }
  if (state.killPreview) {
    app.insertAdjacentHTML('beforeend', renderImageOnlyDialog('close-kill', state.killPreview.src, `Killed by ${roleLabel(state.killPreview.killerRole)}`, 'You were killed'));
  }
  if (state.shamanSilencePreview) {
    app.insertAdjacentHTML('beforeend', renderImageOnlyDialog('close-shaman-silence', shamanSilenceImage, 'Thief Shaman silence', 'You have been silenced'));
  }
  if (state.thiefSeerPreview) {
    app.insertAdjacentHTML('beforeend', `<div class="modal-overlay victory-overlay" data-action="close-thief-seer"><div class="victory-dialog" data-modal-content role="dialog" aria-modal="true" aria-label="Thief Seer role result"><button class="avatar-modal-close victory-close" data-action="close-thief-seer" aria-label="Close Thief Seer result">&times;</button><img class="victory-image" src="${thiefSeerVisionImage}" alt="Thief Seer vision"><p class="investigation-name">${state.thiefSeerPreview.target} · ${roleLabel(state.thiefSeerPreview.role)}</p></div></div>`);
    app.querySelector('.victory-close')?.focus();
  }
  if (state.visitorPreview) {
    const names = state.visitorPreview.visitors?.join(', ') || '';
    const role = state.visitorPreview.role;
    const resultNames = role === 'Watcher' ? state.visitorPreview.destinations.join(', ') : names;
    const resultText = role === 'Watcher'
      ? resultNames ? `${state.visitorPreview.target} went to: ${resultNames}` : `${state.visitorPreview.target} did not visit anyone.`
      : resultNames ? `${state.visitorPreview.target} was visited by: ${resultNames}` : '';
    app.insertAdjacentHTML('beforeend', `<div class="modal-overlay victory-overlay" data-action="close-visitor"><div class="victory-dialog full-height-result-dialog" data-modal-content role="dialog" aria-modal="true" aria-label="${role} result"><button class="avatar-modal-close victory-close" data-action="close-visitor" aria-label="Close ${role} result">&times;</button><img class="victory-image visitor-result-image" src="${state.visitorPreview.src}" alt="${role} result">${resultText ? `<p class="investigation-name">${resultText}</p>` : ''}</div></div>`);
    app.querySelector('.victory-close')?.focus();
  }
  if (state.gamesterPrompt || state.gamesterTarget) {
    const title = state.gamesterPrompt ? 'An anonymous opponent challenged you' : 'Choose your move';
    app.insertAdjacentHTML('beforeend', `<div class="modal-overlay victory-overlay gamester-overlay"><div class="victory-dialog gamester-dialog" role="dialog" aria-modal="true" aria-label="${title}"><div class="gamester-image-choices" role="group" aria-label="Choose rock, scissors, or paper"><img class="victory-image" src="${gamesterGameImage}" alt="Choose a move by clicking its panel"><button class="gamester-image-option gamester-rock" data-gamester-choice="rock" aria-label="Choose rock"></button><button class="gamester-image-option gamester-scissors" data-gamester-choice="scissors" aria-label="Choose scissors"></button><button class="gamester-image-option gamester-paper" data-gamester-choice="paper" aria-label="Choose paper"></button></div></div></div>`);
  }
  if (state.blockedPreview) {
    app.insertAdjacentHTML('beforeend', renderImageOnlyDialog('close-blocked', blockedImage, 'Blocked by the Tavern Keeper', 'You were blocked'));
  }
  if (state.jailPreview) {
    app.insertAdjacentHTML('beforeend', renderImageOnlyDialog('close-jail', jailedImage, 'The Jailor has jailed you', 'You have been jailed'));
  }
  if (state.healedPreview) {
    app.insertAdjacentHTML('beforeend', renderImageOnlyDialog('close-healed', healedImage, 'A player was healed', 'Healing result'));
  }
  if (state.phase !== 'game-over') state.victoryDismissed = false;
  const victorySrc = state.phase === 'game-over' && !state.victoryDismissed ? victoryImageFor(state.winner) : null;
  if (victorySrc && !state.gallowsPreview && !state.killPreview) {
    app.insertAdjacentHTML('beforeend', renderImageOnlyDialog('close-victory', victorySrc, `${state.winner} victory`, `${state.winner} victory`));
  }
  if (state.gallowsPreview && state.screen === 'game') {
    const description = state.gallowsPreview === 'kill' ? 'You were executed at the gallows' : 'You survived the gallows';
    app.insertAdjacentHTML('beforeend', renderImageOnlyDialog('close-gallows', gallowsImages[state.gallowsPreview], description, 'Gallows result'));
  }
  if (state.tutorialOpen) app.insertAdjacentHTML('beforeend', renderTutorial());
  if (state.tutorialImagePreview) {
    app.insertAdjacentHTML('beforeend', `<div class="modal-overlay tutorial-image-overlay" data-action="close-tutorial-image"><div class="tutorial-image-dialog" data-tutorial-image-dialog role="dialog" aria-modal="true" aria-label="${state.tutorialImagePreview.label}"><img src="${state.tutorialImagePreview.src}" alt="${state.tutorialImagePreview.label}"></div></div>`);
  }
  if (priorTutorialScrollTop !== null) {
    const tutorial = app.querySelector('.tutorial-dialog');
    if (tutorial) tutorial.scrollTop = priorTutorialScrollTop;
  }
  const chatLog = app.querySelector('.chat-log');
  if (chatLog) {
    if (forceChatScrollBottom) chatLog.scrollTop = chatLog.scrollHeight;
    else if (priorChatScrollTop !== null) chatLog.scrollTop = priorChatScrollTop;
  }
  forceChatScrollBottom = false;
  if (focusedSelector && !state.gallowsPreview) {
    const restoredInput = app.querySelector(focusedSelector);
    if (restoredInput) {
      restoredInput.value = focusedValue;
      restoredInput.focus();
      restoredInput.setSelectionRange(focusedSelectionStart, focusedSelectionEnd);
    }
  }
}

app.addEventListener('click', event => {
  const actionControl = event.target.closest('[data-action]');
  const action = actionControl?.dataset.action;
  const target = event.target.closest('[data-target]')?.dataset.target;
  const judgeTarget = event.target.closest('[data-judge-target]')?.dataset.judgeTarget;
  const judgePass = event.target.closest('[data-judge-pass]');
  const lobbyCode = event.target.closest('[data-lobby-code]')?.dataset.lobbyCode;
  const deleteLobbyCode = event.target.closest('[data-delete-lobby]')?.dataset.deleteLobby;
  const choice = event.target.closest('[data-choice]')?.dataset.choice;
  const gamesterChoice = event.target.closest('[data-gamester-choice]')?.dataset.gamesterChoice;
  const tutorialImage = event.target.closest('[data-tutorial-image]');
  if (tutorialImage) {
    state.tutorialImagePreview = { src: tutorialImage.dataset.tutorialImage, label: tutorialImage.dataset.tutorialImageLabel };
    render();
    return;
  }
  if (action === 'close-tutorial-image') {
    if (event.target.closest('[data-tutorial-image-dialog]') && !event.target.closest('.tutorial-image-close')) return;
    state.tutorialImagePreview = null;
    render();
    return;
  }
  if (action === 'open-tutorial') { state.tutorialOpen = true; render(); return; }
  if (action === 'close-tutorial') {
    if (event.target.closest('[data-tutorial-content]') && !event.target.closest('.tutorial-close')) return;
    state.tutorialOpen = false;
    render();
    return;
  }
  if (deleteLobbyCode) { state.confirmDeleteLobby = deleteLobbyCode; render(); return; }
  if (judgeTarget) {
    state.judgePass = false;
    state.judgeTargets = state.judgeTargets.includes(judgeTarget)
      ? state.judgeTargets.filter(name => name !== judgeTarget)
      : state.judgeTargets.length < 2 ? [...state.judgeTargets, judgeTarget] : [state.judgeTargets[1], judgeTarget];
    render();
    return;
  }
  if (judgePass) {
    state.judgeTargets = [];
    state.judgePass = !state.judgePass;
    render();
    return;
  }
  if (gamesterChoice) {
    if (state.gamesterPrompt) sendNetwork({ type: 'game-action', action: 'gamester-response', choice: gamesterChoice });
    else if (state.gamesterTarget) sendNetwork({ type: 'game-action', action: 'night-action', target: state.gamesterTarget, choice: gamesterChoice });
    state.gamesterPrompt = false;
    state.gamesterTarget = null;
    state.gamesterChoicesOpen = false;
    state.gamesterWaitingForResponse = !state.gamesterPrompt && state.activeRole === 'Gamester';
    render();
    return;
  }
  if (target) {
    if (state.phase === 'night' && currentPlayer().role === 'Gamester' && state.activeRole === 'Gamester') {
      state.gamesterTarget = target;
      state.gamesterChoicesOpen = true;
    } else state.selected = target;
    render();
    return;
  }
  if (lobbyCode) { sendNetwork({ type: 'join-lobby', code: lobbyCode }); return; }
  if (!action) return;
  if (action === 'gamester-pass') {
    sendNetwork({ type: 'game-action', action: 'night-action', target: 'none' });
    state.gamesterTarget = null;
    state.gamesterChoicesOpen = false;
    render();
    return;
  }
  if (action === 'show-avatar') {
    const playerId = actionControl.dataset.playerId;
    const player = playerId === 'self' ? { name: network.name, gender: network.gender } : state.players.find(candidate => candidate.id === playerId);
    if (player) {
      const showRole = state.screen === 'game' && (player.revealed || player.alive === false);
      if (showRole && player.role) state.rolePreview = { name: roleLabel(player.role), src: imageFor(player) };
      else state.avatarPreview = { name: player.name || 'Your', src: avatarFor(player.gender) };
    }
    render();
    return;
  }
  if (action === 'close-avatar') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.avatar-modal-close')) return;
    state.avatarPreview = null;
    render();
    return;
  }
  if (action === 'show-role') {
    const me = currentPlayer();
    state.rolePreview = { name: roleLabel(me.role), src: imageFor(me) };
    render();
    return;
  }
  if (action === 'close-role') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.avatar-modal-close')) return;
    state.rolePreview = null;
    render();
    return;
  }
  if (action === 'close-teammate') {
    if (event.target.closest('[data-modal-content]')) return;
    state.teammatePreview = null;
    render();
    return;
  }
  if (action === 'confirm-delete-lobby') { sendNetwork({ type: 'delete-lobby', code: state.confirmDeleteLobby }); state.confirmDeleteLobby = null; render(); return; }
  if (action === 'cancel-delete-lobby') { state.confirmDeleteLobby = null; render(); return; }
  if (action === 'leave-lobby') { state.confirmLeaveLobby = true; render(); return; }
  if (action === 'confirm-leave-lobby') { sendNetwork({ type: 'leave-lobby' }); state.confirmLeaveLobby = false; render(); return; }
  if (action === 'cancel-leave-lobby') { state.confirmLeaveLobby = false; render(); return; }
  if (action === 'close-visitor') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.visitorPreview = null;
    render();
    return;
  }
  if (action === 'close-blocked') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.blockedPreview = false;
    render();
    return;
  }
  if (action === 'close-jail') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.jailPreview = false;
    render();
    return;
  }
  if (action === 'close-shaman-silence') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.shamanSilencePreview = false;
    render();
    return;
  }
  if (action === 'close-thief-seer') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.thiefSeerPreview = null;
    render();
    return;
  }
  if (action === 'close-healed') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.healedPreview = false;
    render();
    return;
  }
  if (action === 'close-kill') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.killPreview = null;
    render();
    return;
  }
  if (action === 'close-gallows') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.gallowsPreview = null;
    render();
    return;
  }
  if (action === 'close-investigation') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.investigationPreview = null;
    render();
    return;
  }
  if (action === 'close-judge') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.judgePreview = null;
    render();
    return;
  }
  if (action === 'close-victory') {
    if (event.target.closest('[data-modal-content]') && !event.target.closest('.victory-close')) return;
    state.victoryDismissed = true;
    render();
    return;
  }
  if (action === 'dismiss-popup') { state.popupMessage = null; render(); return; }
  if (action === 'browse-lobbies') { state.screen = 'lobby-browser'; sendNetwork({ type: 'list-lobbies' }); render(); return; }
  if (action === 'back-to-lobby') { state.screen = 'lobby'; render(); return; }
  if (action === 'logout') { logout(); return; }
  if (action === 'list-lobbies') { sendNetwork({ type: 'list-lobbies' }); return; }
  if (action === 'create-lobby') {
    const input = document.querySelector('[data-lobby-name]');
    const name = input ? input.value.trim() : '';
    if (!name) { showConnectionMessage('Enter a name for your lobby.'); render(); return; }
    sendNetwork({ type: 'create-lobby', name });
    return;
  }
  if (action === 'final-vote' && choice) { sendNetwork({ type: 'game-action', action, choice }); return; }
  if (action === 'proceed-to-voting') { sendNetwork({ type: 'game-action', action }); return; }
  if (action === 'nomination-vote' && state.selected) { sendNetwork({ type: 'game-action', action, target: state.selected }); return; }
  if (action === 'start' && network.playerId === network.hostId && network.playerCount >= network.minimumPlayers) { state.screen = 'game'; state.phase = 'night'; addLog('System', 'Roles assigned. The first night begins.'); sendNetwork({ type: 'start-game' }); }
  if (action === 'confirm' && currentPlayer().role === 'Judge') {
    if (state.judgeTargets.length !== 2 && !state.judgePass) return;
    addLog('System', state.judgePass ? 'You passed your Judge action.' : 'Your Judge comparison is locked in.');
    sendNetwork(state.judgePass
      ? { type: 'game-action', action: 'night-action', target: 'none' }
      : { type: 'game-action', action: 'night-action', target: 'judge', targets: [...state.judgeTargets] });
    state.judgeTargets = [];
    state.judgePass = false;
  } else if (action === 'confirm') { addLog('System', state.selected === 'none' ? 'You passed your action.' : `Your ${roleLabel(state.players[0].role)} action is locked in.`); sendNetwork({ type: 'game-action', action: 'night-action', target: state.selected || 'none' }); state.selected = null; }
  if (action === 'to-vote') return;
  if (action === 'nominate' && state.selected) { state.phase = 'defense'; addLog('System', `${state.selected} has been nominated for the gallows.`); sendNetwork({ type: 'game-action', action, target: state.selected }); }
  if (action === 'to-final') return;
  if (action === 'night-skip') { sendNetwork({ type: 'game-action', action }); return; }
  if (action === 'execute' && state.selected) { sendNetwork({ type: 'game-action', action }); }
  render();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && (state.gallowsPreview || state.killPreview || state.judgePreview || state.blockedPreview || state.jailPreview || state.shamanSilencePreview || state.healedPreview || state.phase === 'game-over' && !state.victoryDismissed)) {
    state.gallowsPreview = null;
    state.killPreview = null;
    state.judgePreview = null;
    state.blockedPreview = false;
    state.jailPreview = false;
    state.shamanSilencePreview = false;
    state.healedPreview = false;
    if (state.phase === 'game-over') state.victoryDismissed = true;
    render();
    return;
  }
  if (event.key === 'Escape' && state.tutorialImagePreview) {
    state.tutorialImagePreview = null;
    render();
    return;
  }
  if (event.key === 'Escape' && state.tutorialOpen) {
    state.tutorialOpen = false;
    render();
    return;
  }
  if (event.key === 'Escape' && state.gallowsPreview) {
    state.gallowsPreview = null;
    render();
    return;
  }
  if (event.key === 'Escape' && state.avatarPreview) {
    state.avatarPreview = null;
    render();
  }
  if (event.key === 'Escape' && state.rolePreview) {
    state.rolePreview = null;
    render();
  }
  if (event.key === 'Escape' && state.teammatePreview) {
    state.teammatePreview = null;
    render();
  }
});

app.addEventListener('submit', event => {
  if (event.target.matches('[data-identity]')) {
    event.preventDefault();
    const form = event.target;
    const name = form.elements.name.value.trim();
    const gender = form.elements.gender.value;
    if (name && gender) sendNetwork({ type: 'join', name, gender, reconnectToken: network.reconnectToken });
    return;
  }
  if (event.target.matches('[data-defense]')) {
    event.preventDefault();
    const text = event.target.elements.message.value.trim();
    if (text) sendNetwork({ type: 'game-action', action: 'defense-message', text });
    event.target.reset();
    return;
  }
  if (!event.target.matches('[data-chat]')) return;
  event.preventDefault();
  const input = event.target.elements.message;
  const text = input.value.trim();
  if (text) sendNetwork({ type: 'chat', text });
  input.value = '';
  render();
});

app.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.matches('[data-lobby-name]')) {
    event.preventDefault();
  }
});

render();
connectToRoom();
setInterval(() => {
  if (state.timerRemaining > 0) {
    state.timerRemaining -= 1;
    if (state.screen === 'game') render();
  }
}, 1000);
