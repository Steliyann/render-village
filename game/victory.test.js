const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateVictory } = require('./victory');

const living = (...roles) => roles.map(role => ({ role, alive: true }));

test('Townsfolk win when no opposing threats remain', () => {
  assert.equal(evaluateVictory(living('Villager', 'Healer', 'Jester')), 'Townsfolk');
  assert.equal(evaluateVictory(living('Jester')), 'Townsfolk');
});

test('Townsfolk victory is blocked by a living threat', () => {
  assert.equal(evaluateVictory(living('Villager', 'Healer', 'Thief')), null);
});

test('Thieves win when they reach parity with every other living player', () => {
  assert.equal(evaluateVictory(living('MasterThief', 'Thief')), 'Thieves');
  assert.equal(evaluateVictory(living('MasterThief', 'Thief', 'Villager', 'Healer')), 'Thieves');
});

test('Werewolf wins when no Townsfolk or Thieves remain', () => {
  assert.equal(evaluateVictory(living('Werewolf', 'Jester')), 'Werewolf');
});

test('Dead threats do not prevent Townsfolk victory', () => {
  assert.equal(evaluateVictory([{ role: 'Thief', alive: false }, { role: 'Healer', alive: true }]), 'Townsfolk');
});

test('Jester wins when executed', () => {
  assert.equal(evaluateVictory(living('Villager', 'Jester'), { type: 'execution', role: 'Jester' }), 'Jester');
});

test('Jester does not win from a non-execution event', () => {
  assert.equal(evaluateVictory(living('Villager', 'Jester'), { type: 'night-resolution' }), 'Townsfolk');
});

test('Jester execution takes precedence over team victory', () => {
  assert.equal(evaluateVictory(living('MasterThief', 'Jester'), { type: 'execution', role: 'Jester' }), 'Jester');
});

test('No living players produce a draw', () => {
  assert.equal(evaluateVictory([{ role: 'Villager', alive: false }]), 'Draw');
});

test('Mixed living teams remain in play', () => {
  assert.equal(evaluateVictory(living('Villager', 'MasterThief', 'Werewolf')), null);
});
