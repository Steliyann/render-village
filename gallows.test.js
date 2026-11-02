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
    process: { env: {}, once() {} },
    setInterval: () => ({ unref() {} }),
    console
  });
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context);
  return context;
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

function clientHarness() {
  const handlers = {};
  const keyHandlers = {};
  let html = '';
  const app = {
    querySelector: () => null,
    querySelectorAll: () => [],
    insertAdjacentHTML: (_, markup) => { html += markup; },
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
    WebSocket: Socket
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
    }
  };
}

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
    assert.ok(client.html().includes('victory-dialog full-height-result-dialog'));
    assert.ok(client.html().includes('victory-image judge-result-image'));
    assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Good', image)));
  }
  assert.ok(fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8').includes('.victory-image.judge-result-image'));
});

test('Watcher result popup uses a full-height dialog and keeps its visitor text', () => {
  const client = clientHarness();
  client.receive({ type: 'watcher-result', target: 'Target', visitors: ['Visitor'] });

  assert.ok(client.html().includes('victory-dialog full-height-result-dialog'));
  assert.ok(client.html().includes('victory-image visitor-result-image'));
  assert.ok(client.html().includes('Target was visited by: Visitor'));
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
  assert.ok(fs.existsSync(path.join(__dirname, 'GameImages/Actions/Evil/6.Action_ThiefShaman_Silence.png')));
});

test('silenced players can read but cannot submit village chat', () => {
  const client = clientHarness();
  vm.runInContext("state.phase = 'day'; state.silenced = true; state.players = [{ id: 'p1', name: 'Player', role: 'Villager', gender: 'male', alive: true, self: true }]; network.playerId = 'p1'; network.name = 'Player'", client.context);
  const chat = vm.runInContext('renderChat()', client.context);
  assert.ok(chat.includes('You have been silenced for today. You can still read chat.'));
  assert.equal(chat.includes('data-chat'), false);
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