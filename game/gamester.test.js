const test = require('node:test');
const assert = require('node:assert/strict');
const { gamesterWins, resolveGamesterChallenge } = require('./gamester');

function player(id, role) {
  return { id, name: id, role, alive: true, gamesterKills: 0 };
}

test('rock-paper-scissors has the standard three winning combinations', () => {
  assert.equal(gamesterWins('rock', 'scissors'), true);
  assert.equal(gamesterWins('scissors', 'paper'), true);
  assert.equal(gamesterWins('paper', 'rock'), true);
  assert.equal(gamesterWins('rock', 'paper'), false);
  assert.equal(gamesterWins('rock', 'rock'), false);
});

test('a winning Gamester challenge kills the opponent and increments the count', () => {
  const gamester = player('g', 'Gamester');
  const opponent = player('o', 'Villager');
  const death = resolveGamesterChallenge([gamester, opponent], {
    gamesterId: 'g', opponentId: 'o', gamesterChoice: 'rock', opponentChoice: 'scissors'
  });
  assert.deepEqual(death, { name: 'o', role: 'Villager', cause: 'gamester-game' });
  assert.equal(opponent.alive, false);
  assert.equal(gamester.gamesterKills, 1);
});

test('a healed opponent survives a winning Gamester challenge without increasing its kill count', () => {
  const gamester = player('g', 'Gamester');
  const opponent = player('o', 'Villager');
  const death = resolveGamesterChallenge([gamester, opponent], {
    gamesterId: 'g', opponentId: 'o', gamesterChoice: 'rock', opponentChoice: 'scissors'
  }, null, 'o');
  assert.equal(death, null);
  assert.equal(opponent.alive, true);
  assert.equal(gamester.gamesterKills, 0);
});

test('a loss, draw, jailed opponent, dead opponent, or dead Gamester causes no kill', () => {
  const challenge = { gamesterId: 'g', opponentId: 'o', gamesterChoice: 'rock', opponentChoice: 'paper' };
  for (const [gamesterAlive, opponentAlive, jailedId] of [[true, true, 'o'], [true, false, null], [false, true, null]]) {
    const gamester = player('g', 'Gamester');
    const opponent = player('o', 'Villager');
    gamester.alive = gamesterAlive;
    opponent.alive = opponentAlive;
    assert.equal(resolveGamesterChallenge([gamester, opponent], challenge, jailedId), null);
  }
  const draw = { ...challenge, opponentChoice: 'rock' };
  assert.equal(resolveGamesterChallenge([player('g', 'Gamester'), player('o', 'Villager')], draw), null);
});