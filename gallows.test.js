const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');

function serverHarness() {
  const filename = path.join(__dirname, 'server.js');
  const realRequire = createRequire(filename);
  const context = vm.createContext({
    require(name) {
      if (name === 'http') return { createServer: () => ({ listen() {}, close() {} }) };
      if (name === 'ws') return { WebSocketServer: EventEmitter };
      return realRequire(name);
    },
    __dirname,
    Buffer,
    process: { env: {}, once() {} },
    setInterval: () => ({ unref() {} }),
    console
  });
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context);
  return context;
}

for (const playerCount of [4, 6, 12]) {
  test(`game start privately sends each Thief the entire ${playerCount}-player team roster once`, () => {
    const context = serverHarness();
    const sockets = Array.from({ length: playerCount }, () => ({
      OPEN: 1, readyState: 1, handlers: {}, messages: [],
      on(type, handler) { this.handlers[type] = handler; },
      send(payload) { this.messages.push(JSON.parse(payload)); },
      close() {}
    }));
    context.testSockets = sockets;
    vm.runInContext(`
      for (const socket of testSockets) webSocketServer.emit('connection', socket);
      for (const [index, player] of [...room.players.values()].entries()) {
        player.name = 'Player ' + index;
        player.gender = 'male';
        player.identityReady = true;
      }
    `, context);
    sockets[0].handlers.message(JSON.stringify({ type: 'start-game' }));
    const players = vm.runInContext('[...room.players.values()]', context);
    const members = JSON.parse(JSON.stringify(players
      .filter(player => ['MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer'].includes(player.role))
      .map(({ id, name, role }) => ({ id, name, role }))));
    assert.equal(members.length, playerCount === 4 ? 1 : playerCount === 6 ? 2 : 4);
    for (const [index, player] of players.entries()) {
      const messages = sockets[index].messages.filter(message => message.type === 'team-info');
      assert.deepEqual(messages, members.some(member => member.id === player.id)
        ? [{ type: 'team-info', team: 'Thieves', members }]
        : []);
    }
  });
}

for (const [role, killing] of [
  ['MasterThief', true], ['Thief', true], ['ThiefSeer', false],
  ['ThiefSeer', true], ['ThiefShaman', false], ['ThiefShaman', true]
]) {
  test(`server restricts ${role} teammate targets in ${killing ? 'killing' : 'support'} mode`, () => {
    const context = serverHarness();
    context.actorRole = role;
    context.killing = killing;
    vm.runInContext(`
      const teamRoles = ['MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer'];
      const players = [...teamRoles, 'Villager', 'Jester'].map(role => ({ id: role, name: role, role, alive: true }));
      if (killing && ['ThiefShaman', 'ThiefSeer'].includes(actorRole)) {
        for (const player of players) {
          if (['MasterThief', 'Thief'].includes(player.role) || actorRole === 'ThiefSeer' && player.role === 'ThiefShaman') player.alive = false;
        }
      }
      room.players = new Map(players.map(player => [player.id, player]));
      const actor = room.players.get(actorRole);
    `, context);
    for (const target of ['MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer']) {
      context.targetName = target;
      const allowed = role === 'ThiefShaman' && !killing && target !== role;
      assert.equal(vm.runInContext('validNightTarget(actor, targetName)', context), allowed, target);
    }
    for (const target of ['Villager', 'Jester', 'none']) {
      context.targetName = target;
      assert.equal(vm.runInContext('validNightTarget(actor, targetName)', context), true, target);
    }
  });
}

for (const [label, votes, role, executed, gameOver] of [
  ['save majority', ['no', 'no', 'yes'], 'Villager', false, false],
  ['tied vote', ['yes', 'no'], 'Villager', false, false],
  ['kill majority', ['yes', 'yes', 'no'], 'Villager', true, false],
  ['game-ending execution', ['yes', 'yes', 'no'], 'Jester', true, true]
]) {
  test(`gallows outcome is private after ${label}`, () => {
    const context = serverHarness();
    const messages = [[], [], [], []];
    context.testPlayers = ['Accused', 'Thief', 'Healer', 'Villager'].map((name, index) => ({
      id: String(index), name, role: index === 0 ? role : name, alive: true,
      socket: { OPEN: 1, readyState: 1, send: payload => messages[index].push(JSON.parse(payload)) }
    }));
    context.testVotes = votes;
    vm.runInContext(`
      room.players = new Map(testPlayers.map(player => [player.id, player]));
      room.scenario = scenarioForPlayerCount(testPlayers.length);
      room.phase = 'final';
      room.nominated = 'Accused';
      room.finalVotes = new Map(testVotes.map((vote, index) => [String(index + 1), vote]));
      resolveFinalVote();
    `, context);
    assert.deepEqual(messages[0].filter(message => message.type === 'gallows-result'), [
      { type: 'gallows-result', executed }
    ]);
    for (const otherMessages of messages.slice(1)) {
      assert.equal(otherMessages.some(message => message.type === 'gallows-result'), false);
    }
    assert.equal(context.testPlayers[0].alive, !executed);
    assert.equal(vm.runInContext("room.phase === 'game-over'", context), gameOver);
    assert.equal(messages[0].find(message => message.type === 'vote-result').result.executed, executed);
  });
}

test('Gamester night turn pauses for the anonymous response and resumes afterward', () => {
  const context = serverHarness();
  const createSocket = () => {
    const handlers = {};
    return {
      OPEN: 1,
      readyState: 1,
      handlers,
      messages: [],
      addEventListener(type, handler) { handlers[type] = handler; },
      on(type, handler) { handlers[type] = handler; },
      send(payload) { this.messages.push(JSON.parse(payload)); },
      close() {}
    };
  };
  const gamesterSocket = createSocket();
  const opponentSocket = createSocket();
  context.gamesterSocket = gamesterSocket;
  context.opponentSocket = opponentSocket;
  vm.runInContext('webSocketServer.emit("connection", gamesterSocket); webSocketServer.emit("connection", opponentSocket)', context);
  vm.runInContext(`
    const gamester = room.players.get('1');
    const opponent = room.players.get('2');
    gamester.name = 'SecretGamester'; gamester.role = 'Gamester'; gamester.alive = true; gamester.identityReady = true;
    opponent.name = 'Opponent'; opponent.role = 'Healer'; opponent.alive = true; opponent.identityReady = true;
    room.phase = 'night';
    room.nightTurns = [{ id: '1', role: 'Gamester' }, { id: '2', role: 'Healer' }];
    room.nightTurnIndex = 0;
    room.nightTurnStartedAt = Date.now();
  `, context);

  gamesterSocket.handlers.message(JSON.stringify({ type: 'game-action', action: 'night-action', target: 'Opponent', choice: 'rock' }));
  assert.equal(vm.runInContext('room.nightTurnIndex', context), 0);
  assert.ok(opponentSocket.messages.some(message => message.type === 'gamester-challenge'));
  const challenge = opponentSocket.messages.find(message => message.type === 'gamester-challenge');
  assert.equal('gamesterId' in challenge, false);

  opponentSocket.handlers.message(JSON.stringify({ type: 'game-action', action: 'gamester-response', choice: 'scissors' }));
  assert.equal(vm.runInContext('room.nightTurnIndex', context), 1);
  assert.equal(vm.runInContext("room.gamesterGame.opponentChoice === 'scissors'", context), true);
});

test('Gamester pass advances the turn without creating a game', () => {
  const context = serverHarness();
  const handlers = {};
  const socket = {
    OPEN: 1,
    readyState: 1,
    messages: [],
    on(type, handler) { handlers[type] = handler; },
    send(payload) { this.messages.push(JSON.parse(payload)); },
    close() {}
  };
  context.testSocket = socket;
  vm.runInContext('webSocketServer.emit("connection", testSocket)', context);
  vm.runInContext(`
    const gamester = room.players.get('1');
    gamester.name = 'Gamester'; gamester.role = 'Gamester'; gamester.alive = true; gamester.identityReady = true;
    room.phase = 'night';
    room.nightTurns = [{ id: '1', role: 'Gamester' }, { id: 'next', role: 'Healer' }];
    room.nightTurnIndex = 0;
    room.nightTurnStartedAt = Date.now();
  `, context);

  handlers.message(JSON.stringify({ type: 'game-action', action: 'night-action', target: 'none' }));
  assert.equal(vm.runInContext('room.nightTurnIndex', context), 1);
  assert.equal(vm.runInContext('room.gamesterGame', context), null);
  assert.equal(socket.messages.some(message => message.type === 'error'), false);
});

test('Thief Seer shares vision with teammates immediately at night, without a duplicate at resolution', () => {
  const context = serverHarness();
  const sockets = Array.from({ length: 4 }, () => ({
    OPEN: 1, readyState: 1, handlers: {}, messages: [],
    on(type, handler) { this.handlers[type] = handler; },
    send(payload) { this.messages.push(JSON.parse(payload)); },
    close() {}
  }));
  context.testSockets = sockets;
  vm.runInContext('for (const socket of testSockets) webSocketServer.emit("connection", socket)', context);
  vm.runInContext(`
    const players = [...room.players.values()];
    Object.assign(players[0], { name: 'Seer', role: 'ThiefSeer', alive: true });
    Object.assign(players[1], { name: 'Master', role: 'MasterThief', alive: true });
    Object.assign(players[2], { name: 'Thief', role: 'Thief', alive: true });
    Object.assign(players[3], { name: 'Guarded', role: 'Guard', alive: true });
    room.phase = 'night';
    room.nightNumber = 1;
    room.nightTurns = [{ id: players[0].id, role: 'ThiefSeer', seerKilling: false }, { id: players[1].id, role: 'MasterThief' }];
    room.nightTurnIndex = 0;
    room.nightTurnStartedAt = Date.now();
  `, context);

  sockets[0].handlers.message(JSON.stringify({ type: 'game-action', action: 'night-action', target: 'Guarded' }));
  for (const socket of sockets.slice(0, 3)) {
    assert.deepEqual(socket.messages.filter(message => message.type === 'thief-seer-result'), [
      { type: 'thief-seer-result', target: 'Guarded', role: 'Guard' }
    ]);
  }
  assert.equal(sockets[3].messages.some(message => message.type === 'thief-seer-result'), false);

  vm.runInContext('resolveNight()', context);
  for (const socket of sockets.slice(0, 3)) {
    assert.equal(socket.messages.filter(message => message.type === 'thief-seer-result').length, 1);
  }
});

test('Gamester challenge resolves anonymously at daybreak and counts a successful kill', () => {
  const context = serverHarness();
  const messages = [[], []];
  context.testPlayers = [
    { id: 'g', name: 'Gamester', role: 'Gamester', alive: true, gamesterKills: 0, socket: { OPEN: 1, readyState: 1, send: payload => messages[0].push(JSON.parse(payload)) } },
    { id: 'o', name: 'Opponent', role: 'Villager', alive: true, socket: { OPEN: 1, readyState: 1, send: payload => messages[1].push(JSON.parse(payload)) } }
  ];
  vm.runInContext(`
    room.players = new Map(testPlayers.map(player => [player.id, player]));
    room.phase = 'night-results';
    room.nightNumber = 2;
    room.lastNightResult = { deaths: [], healed: false, nightNumber: 2 };
    room.gamesterGame = { gamesterId: 'g', opponentId: 'o', gamesterChoice: 'rock', opponentChoice: 'scissors' };
    beginDay();
  `, context);

  assert.equal(context.testPlayers[1].alive, false);
  assert.equal(context.testPlayers[0].gamesterKills, 1);
  assert.equal(vm.runInContext("room.phase === 'day'", context), true);
  assert.deepEqual(messages[0].filter(message => message.type === 'gamester-day-result'), [{ type: 'gamester-day-result', name: 'Opponent' }]);
  assert.deepEqual(messages[1].filter(message => message.type === 'gamester-day-result'), [{ type: 'gamester-day-result', name: 'Opponent' }]);
  assert.equal(messages[0].some(message => message.type === 'killed-by'), false);
  assert.deepEqual(messages[1].filter(message => message.type === 'killed-by'), [{ type: 'killed-by', killerRole: 'Gamester' }]);
});

test('Healer protection saves the Gamester target at daybreak and prevents a kill count', () => {
  const context = serverHarness();
  const messages = [[], [], []];
  context.testPlayers = [
    { id: 'g', name: 'Gamester', role: 'Gamester', alive: true, gamesterKills: 0, socket: { OPEN: 1, readyState: 1, send: payload => messages[0].push(JSON.parse(payload)) } },
    { id: 'h', name: 'Healer', role: 'Healer', alive: true, action: 'Opponent', socket: { OPEN: 1, readyState: 1, send: payload => messages[1].push(JSON.parse(payload)) } },
    { id: 'o', name: 'Opponent', role: 'Villager', alive: true, socket: { OPEN: 1, readyState: 1, send: payload => messages[2].push(JSON.parse(payload)) } }
  ];
  vm.runInContext(`
    room.players = new Map(testPlayers.map(player => [player.id, player]));
    room.phase = 'night-results';
    room.nightNumber = 2;
    room.gamesterGame = { gamesterId: 'g', opponentId: 'o', gamesterChoice: 'rock', opponentChoice: 'scissors' };
    resolveNight();
    beginDay();
    deliverKillNotices();
  `, context);

  assert.equal(context.testPlayers[2].alive, true);
  assert.equal(context.testPlayers[0].gamesterKills, 0);
  assert.equal(vm.runInContext("room.phase === 'day'", context), true);
  assert.equal(vm.runInContext('room.healerProtectedPlayerId', context), null);
  assert.equal(vm.runInContext('room.pendingHealNotice', context), false);
  for (const playerMessages of messages) {
    assert.ok(playerMessages.some(message => message.type === 'heal-notice'));
  }
});

test('heal notice displays the Healer image on receiving clients', () => {
  const client = clientHarness();
  client.receive({ type: 'heal-notice' });
  assert.ok(client.html().includes('GameImages/Actions/Good/3.Action_Healer.png'));
});

test('Gamester reaches independent victory on the second kill and cannot kill a jailed target', () => {
  const context = serverHarness();
  context.testPlayers = [
    { id: 'g', name: 'Gamester', role: 'Gamester', alive: true, gamesterKills: 1 },
    { id: 'o', name: 'Opponent', role: 'Villager', alive: true }
  ];
  vm.runInContext(`
    room.players = new Map(testPlayers.map(player => [player.id, player]));
    room.phase = 'night-results';
    room.nightNumber = 3;
    room.lastNightResult = { deaths: [], healed: false, nightNumber: 3 };
    room.gamesterGame = { gamesterId: 'g', opponentId: 'o', gamesterChoice: 'paper', opponentChoice: 'rock' };
    beginDay();
  `, context);
  assert.equal(context.testPlayers[1].alive, false);
  assert.equal(vm.runInContext("room.phase === 'game-over' && room.winner === 'Gamester'", context), true);

  const jailedContext = serverHarness();
  jailedContext.testPlayers = [
    { id: 'g', name: 'Gamester', role: 'Gamester', alive: true, gamesterKills: 0 },
    { id: 'o', name: 'Opponent', role: 'Villager', alive: true }
  ];
  vm.runInContext(`
    room.players = new Map(testPlayers.map(player => [player.id, player]));
    room.phase = 'night-results';
    room.nightNumber = 1;
    room.jailedPlayerId = 'o';
    room.lastNightResult = { deaths: [], healed: false, nightNumber: 1 };
    room.gamesterGame = { gamesterId: 'g', opponentId: 'o', gamesterChoice: 'rock', opponentChoice: 'scissors' };
    beginDay();
  `, jailedContext);
  assert.equal(jailedContext.testPlayers[1].alive, true);
  assert.equal(jailedContext.testPlayers[0].gamesterKills, 0);
});

function clientHarness() {
  const handlers = {};
  const keyHandlers = {};
  const timers = new Map();
  let nextTimerId = 1;
  let html = '';
  let tutorialScrollTop = 0;
  let tutorialRendered = false;
  const app = {
    querySelector: selector => selector === '.tutorial-dialog' && tutorialRendered ? {
      get scrollTop() { return tutorialScrollTop; },
      set scrollTop(value) { tutorialScrollTop = value; }
    } : null,
    querySelectorAll: () => [],
    insertAdjacentHTML: (_, markup) => { html += markup; tutorialRendered ||= markup.includes('class="tutorial-dialog"'); },
    prepend: () => {},
    addEventListener: (type, handler) => { handlers[type] = handler; }
  };
  class Socket {
    addEventListener(type, handler) { this[type] = handler; }
  }
  const context = vm.createContext({
    document: {
      querySelector: () => app,
      querySelectorAll: () => [],
      addEventListener: (type, handler) => { keyHandlers[type] = handler; }
    },
    localStorage: { getItem: () => null },
    window: { location: { protocol: 'http:', host: 'localhost' } },
    WebSocket: Socket,
    setTimeout(handler, delay) { const id = nextTimerId++; timers.set(id, { handler, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  const source = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  vm.runInContext(source.slice(0, source.lastIndexOf('\nrender();')), context);
  vm.runInContext(`
    renderGame = () => {};
    addSelfHealTarget = () => {};
    normalizeProductionView = () => {};
    state.screen = 'game';
    state.phase = 'final';
    connectToRoom();
  `, context);
  return {
    context,
    handlers,
    keyHandlers,
    html: () => html,
    render() { html = ''; vm.runInContext('render()', context); },
    receive(message) {
      html = '';
      context.message = message;
      vm.runInContext('network.socket.message({ data: JSON.stringify(message) })', context);
    },
    timers,
    setTutorialScrollTop(value) { tutorialScrollTop = value; },
    getTutorialScrollTop() { return tutorialScrollTop; },
    fireTimer(id) { const timer = timers.get(id); timers.delete(id); timer?.handler(); }
  };
}

test('top error notice automatically clears after one minute', () => {
  const client = clientHarness();
  client.receive({ type: 'error', message: 'A temporary error.' });
  assert.equal(vm.runInContext('state.connectionMessage', client.context), 'A temporary error.');
  const [timerId, timer] = [...client.timers.entries()][0];
  assert.equal(timer.delay, 60_000);

  client.fireTimer(timerId);
  assert.equal(vm.runInContext('state.connectionMessage', client.context), '');
});

test('lobby occupancy shows player count out of maximum capacity', () => {
  const client = clientHarness();
  const markup = vm.runInContext(`
    network.playerCount = 2;
    network.minimumPlayers = 4;
    network.maximumPlayers = 11;
    network.playerId = 'host';
    network.hostId = 'host';
    state.players = [];
    renderLobby();
    app.innerHTML;
  `, client.context);
  assert.ok(markup.includes('2/11 players'));
  assert.ok(markup.includes('Waiting for 2 more players.'));
});

test('role card and revealed role portraits fit without cropping', () => {
  const client = clientHarness();
  const markup = vm.runInContext(`
    state.players = [
      { id: 'revealed', name: 'Revealed', role: 'Gamester', gender: 'male', alive: false },
      { id: 'hidden', name: 'Hidden', role: 'Villager', gender: 'female', alive: true }
    ];
    renderPlayerList();
  `, client.context);
  assert.ok(markup.includes('class="avatar role-thumbnail"'));
  assert.ok(markup.includes('GameImages/Roles/Independent Evil/Male/3.Male_LordSmith.png'));
  assert.ok(markup.includes('class="avatar "'));
  const styles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  assert.ok(styles.includes('.avatar.role-thumbnail { object-fit: contain; }'));
  assert.ok(styles.includes('.role-card img { width: 64px; height: 64px; object-fit: contain; }'));
});

test('profile bar opens a tutorial with descriptions and both role images', () => {
  const client = clientHarness();
  vm.runInContext("network.identityReady = true; network.name = 'Player';", client.context);
  const profile = vm.runInContext('renderProfileBar()', client.context);
  assert.ok(profile.includes('class="profile-name">Player</span><button class="secondary tutorial-trigger" data-action="open-tutorial">Tutorial</button>'));

  client.handlers.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'open-tutorial' } } : null } });
  assert.equal(vm.runInContext('state.tutorialOpen', client.context), true);
  client.render();
  assert.ok(client.html().includes('Game tutorial'));
  assert.ok(client.html().includes('which players visited them'));
  assert.ok(client.html().includes('where that player went'));
  assert.ok(client.html().includes('anonymous rock-paper-scissors'));

  const tutorialHtml = vm.runInContext('renderTutorial()', client.context);
  const images = [...tutorialHtml.matchAll(/src="([^"]+)"/g)].map(([, src]) => src);
  assert.ok(images.length >= 38, 'tutorial includes male and female images for each role');
  for (const image of images) assert.ok(fs.existsSync(path.join(__dirname, image)), `Missing tutorial art: ${image}`);

  client.setTutorialScrollTop(420);
  client.handlers.click({ target: { closest: selector => selector === '[data-tutorial-image]' ? { dataset: { tutorialImage: images[0], tutorialImageLabel: 'Villager male' } } : null } });
  assert.equal(vm.runInContext('state.tutorialImagePreview.label', client.context), 'Villager male');
  assert.equal(client.getTutorialScrollTop(), 420);
  client.render();
  assert.ok(client.html().includes('class="tutorial-image-dialog"'));
  assert.ok(client.html().includes(`src="${images[0]}" alt="Villager male"`));
  const imageDialogStart = client.html().lastIndexOf('<div class="tutorial-image-dialog"');
  const imageDialogEnd = client.html().indexOf('</div></div>', imageDialogStart);
  assert.ok(imageDialogEnd > imageDialogStart);
  assert.equal(client.html().slice(imageDialogStart, imageDialogEnd).includes('<p>'), false, 'enlarged image has no caption text');
  const styles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  assert.ok(styles.includes('.tutorial-image-dialog { position: relative; display: grid; place-items: center; width: fit-content; max-width: 100vw; max-height: 100vh; padding: 0; background: transparent; box-shadow: none; }'));
  assert.ok(styles.includes('.tutorial-image-dialog img { display: block; width: auto; height: auto; max-width: 100vw; max-height: 100vh; object-fit: contain; }'));
  assert.equal(client.html().includes('tutorial-image-close'), false, 'image-only dialog has no close X');
  assert.equal(vm.runInContext('state.tutorialOpen', client.context), true);
  assert.equal(client.getTutorialScrollTop(), 420);

  client.keyHandlers.keydown({ key: 'Escape' });
  assert.equal(vm.runInContext('state.tutorialImagePreview', client.context), null);
  assert.equal(vm.runInContext('state.tutorialOpen', client.context), true);
  client.keyHandlers.keydown({ key: 'Escape' });
  assert.equal(vm.runInContext('state.tutorialOpen', client.context), false);
});

test('Gamester uses the supplied role art and makes each image panel a choice', () => {
  const client = clientHarness();
  assert.equal(vm.runInContext("imageFor({ role: 'Gamester', gender: 'male' })", client.context), 'GameImages/Roles/Independent Evil/Male/3.Male_LordSmith.png');
  assert.equal(vm.runInContext("imageFor({ role: 'Gamester', gender: 'female' })", client.context), 'GameImages/Roles/Independent Evil/Female/3.Female_LadyMargaret.png');

  client.receive({ type: 'gamester-challenge' });
  assert.ok(client.html().includes('GameImages/Actions/Common/3.ActionSmithMargaretGame.png'));
  for (const choice of ['rock', 'scissors', 'paper']) {
    assert.ok(client.html().includes(`data-gamester-choice="${choice}"`));
  }
  assert.ok(client.html().includes('aria-label="Choose rock"'));
  assert.ok(client.html().includes('aria-label="Choose scissors"'));
  assert.ok(client.html().includes('aria-label="Choose paper"'));
  assert.equal((client.html().match(/data-gamester-choice=/g) || []).length, 3);
  assert.equal(client.html().includes('>Choose Rock<'), false);
  assert.equal(client.html().includes('>Choose Scissors<'), false);
  assert.equal(client.html().includes('>Choose Paper<'), false);
  assert.equal(client.html().includes('class="gamester-choices"'), false);
  const styles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  assert.match(styles, /\.gamester-dialog\s*\{\s*width:\s*min\(900px, calc\(100vw - 40px\)\);/);
  assert.match(styles, /\.gamester-image-option\s*\{[^}]*top:\s*0;[^}]*height:\s*100%;/);
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Common/3.ActionSmithMargaretGame.png')));
});

test('Gamester and challenged player submit choices through private actions', () => {
  const client = clientHarness();
  const sentMessages = [];
  client.context.sentMessages = sentMessages;
  vm.runInContext(`
    sendNetwork = message => sentMessages.push(message);
    state.phase = 'night';
    state.players = [
      { id: 'g', name: 'Gamester', role: 'Gamester', gender: 'male', alive: true, self: true },
      { id: 'o', name: 'Opponent', role: 'Villager', gender: 'female', alive: true, self: false }
    ];
    network.playerId = 'g';
    state.activeRole = 'Gamester';
  `, client.context);
  client.handlers.click({ target: { closest: selector => selector === '[data-target]' ? { dataset: { target: 'Opponent' } } : null } });
  client.handlers.click({ target: { closest: selector => selector === '[data-gamester-choice]' ? { dataset: { gamesterChoice: 'scissors' } } : null } });
  assert.deepEqual(JSON.parse(JSON.stringify(sentMessages[0])), { type: 'game-action', action: 'night-action', target: 'Opponent', choice: 'scissors' });

  vm.runInContext("state.players[0].role = 'Villager'; state.gamesterPrompt = true; state.activeRole = null", client.context);
  client.handlers.click({ target: { closest: selector => selector === '[data-gamester-choice]' ? { dataset: { gamesterChoice: 'paper' } } : null } });
  assert.deepEqual(JSON.parse(JSON.stringify(sentMessages[1])), { type: 'game-action', action: 'gamester-response', choice: 'paper' });
});

test('Gamester can pass without starting a challenge', () => {
  const client = clientHarness();
  const sentMessages = [];
  client.context.sentMessages = sentMessages;
  vm.runInContext(`
    sendNetwork = message => sentMessages.push(message);
    state.phase = 'night';
    state.activeRole = 'Gamester';
    state.players = [{ id: 'g', name: 'Gamester', role: 'Gamester', alive: true, self: true }];
    network.playerId = 'g';
  `, client.context);
  const panel = vm.runInContext('renderActionPanel()', client.context);
  assert.ok(panel.includes('Play with no one'));

  client.handlers.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'gamester-pass' } } : null } });
  assert.deepEqual(JSON.parse(JSON.stringify(sentMessages[0])), {
    type: 'game-action', action: 'night-action', target: 'none'
  });
});

for (const executed of [false, true]) {
  test(`private gallows dialog displays the ${executed ? 'kill' : 'survive'} image`, () => {
    const client = clientHarness();
    client.receive({ type: 'vote-result', result: { nominee: 'Someone', executed, yes: 2, no: 1 } });
    assert.equal(client.html().includes('close-gallows'), false, 'public results must not show the dialog');
    client.receive({ type: 'gallows-result', executed });
    const image = executed ? '1.Gallows_Kill.png' : '2.Gallows_Survive.png';
    assert.ok(client.html().includes(`GameImages/Actions/Common/${image}`));
    assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Common', image)));
    assert.ok(client.html().includes('role="dialog" aria-modal="true"'));
    assert.ok(client.html().includes('class="image-only-dialog"'));
    assert.equal(client.html().includes('victory-close'), false);
    assert.equal(client.html().includes('<p>'), false);
    client.render();
    assert.ok(client.html().includes(image), 'rerenders must retain the dialog');
    client.keyHandlers.keydown({ key: 'Escape' });
    client.render();
    assert.equal(client.html().includes('close-gallows'), false);
  });
}

test('gallows dialog takes priority over victory and dismisses independently', () => {
  const client = clientHarness();
  vm.runInContext("state.phase = 'game-over'; state.winner = 'Jester'", client.context);
  client.receive({ type: 'gallows-result', executed: true });
  assert.ok(client.html().includes('1.Gallows_Kill.png'));
  assert.equal(client.html().includes('close-victory'), false);
  client.handlers.click({
    target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'close-gallows' } } : null }
  });
  client.render();
  assert.equal(client.html().includes('close-gallows'), false);
  assert.ok(client.html().includes('close-victory'));
});

test('a Trapper victim privately sees the Trapper action image', () => {
  const client = clientHarness();
  client.receive({ type: 'killed-by', killerRole: 'Trapper' });
  assert.ok(client.html().includes('GameImages/Actions/Good/13.Action_Trapper.png'));
  assert.ok(client.html().includes('aria-label="You were killed"'));
  assert.ok(client.html().includes('class="image-only-dialog"'));
  assert.equal(client.html().includes('victory-close'), false);
  assert.equal(client.html().includes('<p>'), false);
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Good/13.Action_Trapper.png')));
});

test('jailed player gets a jailed message and only a Proceed action', () => {
  const client = clientHarness();
  vm.runInContext(`
    state.phase = 'night';
    state.players = [{ id: 'jailed', role: 'Healer', alive: true }];
    network.playerId = 'jailed';
    state.activeTurnJailed = true;
  `, client.context);
  const panel = vm.runInContext('renderActionPanel()', client.context);

  assert.ok(panel.includes('You are jailed'));
  assert.ok(panel.includes('Click Proceed to continue.'));
  assert.ok(panel.includes('data-action="night-skip">Proceed</button>'));
  assert.equal((panel.match(/<button\b/g) || []).length, 1);
});

test('jailed player receives the Jailor image popup', () => {
  const client = clientHarness();
  client.receive({ type: 'jail-notice' });

  assert.ok(client.html().includes('GameImages/Actions/Good/12.Action_Jailor.png'));
  assert.ok(client.html().includes('aria-label="You have been jailed"'));
  assert.ok(client.html().includes('class="image-only-dialog"'));
  assert.equal(client.html().includes('victory-close'), false);
  assert.equal(client.html().includes('<p>'), false);
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Good/12.Action_Jailor.png')));
});

test('Crossbowman first-night turn has a Proceed action', () => {
  const client = clientHarness();
  vm.runInContext(`
    state.phase = 'night';
    state.players = [{ id: 'crossbowman', role: 'Crossbowman', alive: true }];
    network.playerId = 'crossbowman';
    state.activeRole = 'Crossbowman';
    state.activeTurnFirstNightUnavailable = true;
  `, client.context);
  const panel = vm.runInContext('renderActionPanel()', client.context);

  assert.ok(panel.includes('You cannot shoot during the first night.'));
  assert.ok(panel.includes('data-action="night-skip">Proceed</button>'));
  assert.equal((panel.match(/<button\b/g) || []).length, 1);
});

test('Judge submits both selected players and renders the full comparison image', () => {
  const client = clientHarness();
  const sentMessages = [];
  client.context.sentMessages = sentMessages;
  vm.runInContext(`
    sendNetwork = message => sentMessages.push(message);
    state.players = [{ id: 'judge-id', name: 'Judge', role: 'Judge', alive: true, self: true }];
    network.playerId = 'judge-id';
    state.judgeTargets = ['First', 'Second'];
    state.judgePass = false;
  `, client.context);
  client.handlers.click({
    target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'confirm' } } : null }
  });

  assert.deepEqual(JSON.parse(JSON.stringify(sentMessages[0])), {
    type: 'game-action', action: 'night-action', target: 'judge', targets: ['First', 'Second']
  });

  for (const [teammates, relation, image] of [
    [true, 'teammates', '9.Action_Judge_Teammates.png'],
    [false, 'rivals', '10.Action_Judge_Rivals.png']
  ]) {
    vm.runInContext("state.phase = 'night'", client.context);
    client.receive({ type: 'judge-result', teammates, players: ['First', 'Second'] });
    assert.ok(client.html().includes(`GameImages/Actions/Good/${image}`));
    assert.ok(client.html().includes(`aria-label="Judge result: ${relation}"`));
    assert.ok(client.html().includes('class="image-only-dialog"'));
    assert.equal(client.html().includes('victory-close'), false);
    assert.equal(client.html().includes('<p>'), false);
    assert.equal(client.html().includes('First and Second'), false);
    assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Good', image)));
  }
  assert.ok(fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8').includes('.image-only-dialog img'));
});

test('Thieves introduction shows the full team image and every member below it without an X', () => {
  const client = clientHarness();
  const members = [
    { id: 'john', name: 'John', role: 'MasterThief' },
    { id: 'martin', name: 'Martin', role: 'Thief' },
    { id: 'sona', name: 'Sona', role: 'ThiefSeer' },
    { id: 'shaman', name: 'Alex <&>', role: 'ThiefShaman' }
  ];
  vm.runInContext("network.playerId = 'john'; state.players = [{ id: 'john', name: 'John', role: 'Villager' }, { id: 'martin', name: 'Martin', role: 'Villager' }];", client.context);
  client.receive({ type: 'team-info', team: 'Thieves', members });
  const markup = client.html();
  const image = 'GameImages/Roles/Evil/Team/1.ThievesTeam.png';
  assert.ok(markup.includes(`src="${image}"`));
  assert.ok(fs.existsSync(path.join(__dirname, image)));
  for (const label of ['John: Master Thief', 'Martin: Thief', 'Sona: Thief Seer', 'Alex &lt;&amp;&gt;: Thief Shaman']) {
    assert.ok(markup.includes(`<li>${label}</li>`));
    assert.ok(markup.indexOf(label) > markup.indexOf('<img'));
  }
  assert.equal(markup.includes('<button'), false);
  assert.equal(markup.includes('&times;'), false);
  assert.equal(vm.runInContext("state.players[0].role", client.context), 'MasterThief');
  assert.equal(vm.runInContext("state.players[1].role", client.context), 'Thief');
  assert.equal(vm.runInContext("state.revealedRoles.sona", client.context), 'ThiefSeer');
  const styles = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  assert.match(styles, /\.thieves-team-dialog img \{[^}]*object-fit: contain;/);

  client.handlers.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'close-teammate' } } : selector === '[data-modal-content]' ? {} : null } });
  assert.notEqual(vm.runInContext('state.teammatePreview', client.context), null, 'clicking the image or roster keeps the dialog open');
  client.handlers.click({ target: { closest: selector => selector === '[data-action]' ? { dataset: { action: 'close-teammate' } } : null } });
  assert.equal(vm.runInContext('state.teammatePreview', client.context), null);
  client.receive({ type: 'team-info', team: 'Thieves', members });
  client.keyHandlers.keydown({ key: 'Escape' });
  assert.equal(vm.runInContext('state.teammatePreview', client.context), null);
});

test('Watcher result popup displays the selected player’s destinations', () => {
  const client = clientHarness();
  client.receive({ type: 'watcher-result', target: 'Player', destinations: ['Bakery', 'Town Square'] });

  assert.ok(client.html().includes('victory-dialog full-height-result-dialog'));
  assert.ok(client.html().includes('victory-image visitor-result-image'));
  assert.ok(client.html().includes('Player went to: Bakery, Town Square'));
  assert.ok(fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8').includes('.full-height-result-dialog'));
});

test('a Thief Shaman victim privately sees the Shaman kill image', () => {
  const client = clientHarness();
  client.receive({ type: 'killed-by', killerRole: 'ThiefShaman' });
  assert.ok(client.html().includes('GameImages/Actions/Evil/5.Action_ThiefShaman_Kill.png'));
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Evil/5.Action_ThiefShaman_Kill.png')));
});

test('a silenced player privately sees the Shaman silence image', () => {
  const client = clientHarness();
  client.receive({ type: 'shaman-silence-notice' });
  assert.ok(client.html().includes('GameImages/Actions/Evil/6.Action_ThiefShaman_Silence.png'));
  assert.ok(client.html().includes('class="image-only-dialog"'));
  assert.equal(client.html().includes('victory-close'), false);
  assert.equal(client.html().includes('<p>'), false);
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Evil/6.Action_ThiefShaman_Silence.png')));
});

test('silenced players can read but cannot submit village chat', () => {
  const client = clientHarness();
  vm.runInContext("state.phase = 'day'; state.silenced = true; state.players = [{ id: 'p1', name: 'Player', role: 'Villager', gender: 'male', alive: true, self: true }]; network.playerId = 'p1'; network.name = 'Player'", client.context);
  const chat = vm.runInContext('renderChat()', client.context);
  assert.ok(chat.includes('You have been silenced for today. You can still read chat.'));
  assert.equal(chat.includes('data-chat'), false);
});

test('a silenced nominee cannot submit gallows chat', () => {
  const client = clientHarness();
  vm.runInContext("state.phase = 'defense'; state.silenced = true; state.selected = 'Player'; state.players = [{ id: 'p1', name: 'Player', role: 'Villager', gender: 'male', alive: true, self: true }]; network.playerId = 'p1'; network.name = 'Player'", client.context);
  const defense = vm.runInContext('renderDefensePanel()', client.context);
  assert.ok(defense.includes("You have been silenced for today. I can't write in the chat."));
  assert.equal(defense.includes('data-defense'), false);
});

test('final vote offers green Save and red Execute actions', () => {
  const client = clientHarness();
  vm.runInContext("state.phase = 'final'; state.selected = 'Nominee'; state.players = [{ id: 'p1', name: 'Voter', role: 'Villager', gender: 'male', alive: true, self: true }]; network.playerId = 'p1'; network.name = 'Voter'", client.context);
  const panel = vm.runInContext('renderActionPanel()', client.context);
  assert.match(panel, /class="primary" data-action="final-vote" data-choice="no"[^>]*>Save<\/button>/);
  assert.match(panel, /class="danger" data-action="final-vote" data-choice="yes"[^>]*>Execute<\/button>/);
});

test('the server rejects silenced messages in village and gallows chat', () => {
  const context = serverHarness();
  const sockets = Array.from({ length: 2 }, () => ({
    OPEN: 1, readyState: 1, handlers: {}, messages: [],
    on(type, handler) { this.handlers[type] = handler; },
    send(payload) { this.messages.push(JSON.parse(payload)); },
    close() {}
  }));
  context.testSockets = sockets;
  vm.runInContext('for (const socket of testSockets) webSocketServer.emit("connection", socket)', context);
  vm.runInContext(`
    const nominee = room.players.get('1');
    nominee.name = 'Player'; nominee.alive = true; nominee.silenced = true;
    room.players.get('2').name = 'Other'; room.players.get('2').alive = true;
    room.phase = 'defense';
    room.nominated = 'Player';
  `, context);

  sockets[0].handlers.message(JSON.stringify({ type: 'game-action', action: 'defense-message', text: 'I cannot speak.' }));
  assert.equal(sockets.every(socket => socket.messages.every(message => message.type !== 'defense-message')), true);
  assert.equal(vm.runInContext('room.defenseMessages.length', context), 0);

  sockets[0].handlers.message(JSON.stringify({ type: 'chat', text: 'I cannot write.' }));
  assert.equal(sockets.every(socket => socket.messages.every(message => message.type !== 'chat')), true);
  assert.ok(sockets[0].messages.some(message => message.type === 'error' && message.code === 'PLAYER_SILENCED'));
});

test('Thief Shaman sees the team target and switches to killing when teammates are dead', () => {
  const client = clientHarness();
  vm.runInContext("state.phase = 'night'; state.activeRole = 'ThiefShaman'; state.activePlayerId = 's'; state.activeTurnInfoTarget = 'Target'; state.activeTurnShamanKilling = false; state.players = [{ id: 's', name: 'Shaman', role: 'ThiefShaman', gender: 'male', alive: true, self: true }, { id: 'v', name: 'Villager', role: 'Villager', gender: 'female', alive: true, self: false }]; network.playerId = 's'; network.name = 'Shaman'", client.context);
  const silenceAction = vm.runInContext('renderActionPanel()', client.context);
  assert.ok(silenceAction.includes('The Thieves have chosen <strong>Target</strong> as their kill target tonight.'));
  assert.ok(silenceAction.includes('Choose one player to silence during the day, or pass.'));
  vm.runInContext('state.activeTurnShamanKilling = true', client.context);
  const killAction = vm.runInContext('renderActionPanel()', client.context);
  assert.ok(killAction.includes('Both the Master Thief and Thief are dead.'));
  assert.ok(killAction.includes('Your selection is the Thieves attack'));
});

test('Thief Seer role vision displays the requested image, target, and role', () => {
  const client = clientHarness();
  client.receive({ type: 'thief-seer-result', target: 'Guarded', role: 'Guard' });
  assert.ok(client.html().includes('GameImages/Actions/Evil/8.Action_ThiefSeer_Vision.png'));
  assert.ok(client.html().includes('Guarded · Guard'));
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Evil/8.Action_ThiefSeer_Vision.png')));
});

test('Thief Seer victim privately receives the Seer kill image', () => {
  const client = clientHarness();
  client.receive({ type: 'killed-by', killerRole: 'ThiefSeer' });
  assert.ok(client.html().includes('GameImages/Actions/Evil/7.Action_ThiefSeer_Kill.png'));
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Evil/7.Action_ThiefSeer_Kill.png')));
});

for (const [role, killing] of [
  ['MasterThief', true], ['Thief', true], ['ThiefSeer', false],
  ['ThiefSeer', true], ['ThiefShaman', false], ['ThiefShaman', true]
]) {
  test(`${role} target buttons exclude teammates except for Shaman silence (${killing ? 'killing' : 'support'})`, () => {
    const client = clientHarness();
    client.context.actorRole = role;
    client.context.killing = killing;
    const markup = vm.runInContext(`
      network.playerId = actorRole;
      state.phase = 'night';
      state.activeRole = actorRole;
      state.activeTurnShamanKilling = killing;
      state.activeTurnSeerKilling = killing;
      state.players = ['MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer', 'Villager', 'Jester'].map(role => ({
        id: role, name: role, role, alive: true, self: role === actorRole
      }));
      state.players.push({ id: 'dead', name: 'Dead', role: 'Villager', alive: false });
      renderActionPanel();
    `, client.context);
    const targets = [...markup.matchAll(/data-target="([^"]+)"/g)].map(([, target]) => target);
    const expected = role === 'ThiefShaman' && !killing
      ? ['MasterThief', 'Thief', 'ThiefSeer', 'Villager', 'Jester', 'none']
      : ['Villager', 'Jester', 'none'];
    assert.deepEqual(targets, expected);
  });
}

test('Thief Seer switches between role check and fallback kill actions', () => {
  const client = clientHarness();
  vm.runInContext("state.phase = 'night'; state.activeRole = 'ThiefSeer'; state.activeTurnSeerKilling = false; state.selected = 'Target'; state.players = [{ id: 's', name: 'Seer', role: 'ThiefSeer', gender: 'male', alive: true, self: true }, { id: 'v', name: 'Target', role: 'Villager', gender: 'female', alive: true, self: false }]; network.playerId = 's'; network.name = 'Seer'", client.context);
  const visionPanel = vm.runInContext('renderActionPanel()', client.context);
  assert.ok(visionPanel.includes('Choose one player to learn their role with the Thieves team'));
  assert.ok(visionPanel.includes('Check role'));
  vm.runInContext('state.activeTurnSeerKilling = true', client.context);
  const killPanel = vm.runInContext('renderActionPanel()', client.context);
  assert.ok(killPanel.includes('The Master Thief, Thief, and Thief Shaman are dead.'));
  assert.ok(killPanel.includes('Choose kill target'));
});

test('a Gamester victim privately sees the Royal Game death image', () => {
  const client = clientHarness();
  client.receive({ type: 'killed-by', killerRole: 'Gamester' });
  assert.ok(client.html().includes('GameImages/Actions/Evil/4.Action_RoyalGame.png'));
  assert.ok(client.html().includes('aria-label="You were killed"'));
  assert.ok(client.html().includes('class="image-only-dialog"'));
  assert.equal(client.html().includes('victory-close'), false);
  assert.equal(client.html().includes('<p>'), false);
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Evil/4.Action_RoyalGame.png')));
});

test('Gamester victory shows its winner image to every client', () => {
  const client = clientHarness();
  vm.runInContext("state.phase = 'game-over'; state.winner = 'Gamester';", client.context);
  client.render();
  assert.ok(client.html().includes('GameImages/Winners/5.Victory_Gamesters.png'));
  assert.ok(client.html().includes('aria-label="Gamester victory"'));
  assert.ok(client.html().includes('class="image-only-dialog"'));
  assert.equal(client.html().includes('victory-close'), false);
  assert.equal(client.html().includes('<p>'), false);
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Winners/5.Victory_Gamesters.png')));
});