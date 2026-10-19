const test = require('node:test');
const assert = require('node:assert/strict');
const { canStartGame, canUseNightAction, canSkipNightAction, canSubmitVote, canSubmitDefense, canAdvancePhase, canChat } = require('./permissions');

const alive = { id: 'p1', name: 'p1', alive: true };
const dead = { id: 'p1', name: 'p1', alive: false };

test('only the lobby host can start with enough identified players', () => {
  assert.equal(canStartGame({ player: alive, hostId: 'p1', phase: 'lobby', identifiedCount: 4, minimumPlayers: 4 }), true);
  assert.equal(canStartGame({ player: alive, hostId: 'p2', phase: 'lobby', identifiedCount: 4, minimumPlayers: 4 }), false);
  assert.equal(canStartGame({ player: alive, hostId: 'p1', phase: 'lobby', identifiedCount: 3, minimumPlayers: 4 }), false);
});

test('only the active living role can act at Night', () => {
  assert.equal(canUseNightAction({ player: alive, activeTurn: { id: 'p1' }, phase: 'night' }), true);
  assert.equal(canUseNightAction({ player: alive, activeTurn: { id: 'p1', blocked: true }, phase: 'night' }), false);
  assert.equal(canUseNightAction({ player: alive, activeTurn: { id: 'p2' }, phase: 'night' }), false);
  assert.equal(canUseNightAction({ player: dead, activeTurn: { id: 'p1' }, phase: 'night' }), false);
});

test('only the active blocked role can skip its Night turn', () => {
  assert.equal(canSkipNightAction({ player: alive, activeTurn: { id: 'p1', blocked: true }, phase: 'night' }), true);
  assert.equal(canSkipNightAction({ player: alive, activeTurn: { id: 'p1' }, phase: 'night' }), false);
  assert.equal(canSkipNightAction({ player: dead, activeTurn: { id: 'p1', blocked: true }, phase: 'night' }), false);
});

test('only living players can submit votes in vote phases', () => {
  assert.equal(canSubmitVote({ player: alive, phase: 'vote' }), true);
  assert.equal(canSubmitVote({ player: alive, phase: 'final', nominee: 'p2' }), true);
  assert.equal(canSubmitVote({ player: alive, phase: 'final', nominee: 'p1' }), false);
  assert.equal(canSubmitVote({ player: dead, phase: 'vote' }), false);
  assert.equal(canSubmitVote({ player: alive, phase: 'day' }), false);
});

test('only the living nominee can submit defense messages', () => {
  assert.equal(canSubmitDefense({ player: alive, nominee: 'p1', phase: 'defense' }), true);
  assert.equal(canSubmitDefense({ player: { id: 'p2', name: 'p2', alive: true }, nominee: 'p1', phase: 'defense' }), false);
  assert.equal(canSubmitDefense({ player: dead, nominee: 'p1', phase: 'defense' }), false);
  assert.equal(canSubmitDefense({ player: alive, nominee: 'p1', phase: 'final' }), false);
});

test('living players may advance only discussion and defense', () => {
  assert.equal(canAdvancePhase({ player: alive, phase: 'day' }), true);
  assert.equal(canAdvancePhase({ player: alive, phase: 'defense' }), true);
  assert.equal(canAdvancePhase({ player: alive, phase: 'night' }), false);
  assert.equal(canAdvancePhase({ player: dead, phase: 'day' }), false);
});

test('chat is available only to living players outside preparation and Night', () => {
  assert.equal(canChat({ player: alive, phase: 'day' }), true);
  assert.equal(canChat({ player: alive, phase: 'preparation' }), false);
  assert.equal(canChat({ player: alive, phase: 'night' }), false);
  assert.equal(canChat({ player: alive, phase: 'night-resolution' }), false);
  assert.equal(canChat({ player: alive, phase: 'night-results' }), false);
  assert.equal(canChat({ player: dead, phase: 'day' }), false);
});
