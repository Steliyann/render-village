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