const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveNight } = require('./nightResolver');

function player(name, role, action = 'none') {
  return { id: name, name, role, action, alive: true };
}

test('Tavern Keeper blocks Militia investigation', () => {
  const players = [
    player('Keeper', 'TavernKeeper', 'Militia'),
    player('Militia', 'Militia', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.deepEqual(result.privateMessages, []);
});

test('Healer protection prevents a Thief attack', () => {
  const players = [
    player('Thief', 'Thief', 'Target'),
    player('Healer', 'Healer', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.deepEqual(result.deaths, []);
  assert.equal(result.protected, 'Target');
});

test('Hunter cannot shoot on the first Night', () => {
  const players = [player('Hunter', 'Hunter', 'Target'), player('Target', 'Villager')];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Hunter').alive, true);
  assert.deepEqual(result.deaths, []);
});

test('Hunter shoots on later Nights and suicides against Townsfolk', () => {
  const players = [player('Hunter', 'Hunter', 'Target'), player('Target', 'Villager')];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Target').alive, false);
  assert.equal(players.find(current => current.name === 'Hunter').alive, false);
  assert.equal(result.deaths.some(death => death.cause === 'hunter-suicide'), true);
});

test('RedHat is protected while Hunter is alive', () => {
  const players = [
    player('Thief', 'Thief', 'Red'),
    player('Hunter', 'Hunter'),
    player('Red', 'RedHat')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Red').alive, true);
  assert.deepEqual(result.deaths, []);
});

test('Healer self-protection is available once per game', () => {
  const healer = player('Healer', 'Healer', 'Healer');
  const players = [player('Thief', 'Thief', 'Healer'), healer];
  const firstNight = resolveNight({ players, nightNumber: 1 });
  assert.deepEqual(firstNight.deaths, []);
  assert.equal(healer.selfHealUsed, true);

  healer.action = 'Healer';
  players[0].action = 'Healer';
  const secondNight = resolveNight({ players, nightNumber: 2 });
  assert.equal(secondNight.deaths.some(death => death.name === 'Healer'), true);
});

test('Tavern Keeper cannot block the Werewolf on a Full Moon', () => {
  const players = [
    player('Keeper', 'TavernKeeper', 'Wolf'),
    player('Wolf', 'Werewolf', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Target').alive, false);
  assert.deepEqual(result.deaths.map(death => death.name), ['Target', 'Keeper']);
});

test('Werewolf cannot be killed during any night', () => {
  const players = [player('Thief', 'Thief', 'Wolf'), player('Wolf', 'Werewolf')];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Wolf').alive, true);
  assert.deepEqual(result.deaths.map(death => death.name), ['Thief']);
});

test('Master Thief takes over visiting after the Thief is gone', () => {
  const players = [
    player('Master', 'MasterThief', 'Target'),
    player('Shadow', 'Shadow', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, false);
  assert.deepEqual(result.privateMessages.find(message => message.type === 'shadow-result').visitors, ['Master']);
});

test('Blocked Master Thief still picks the target while the Thief is alive', () => {
  const players = [
    player('Keeper', 'TavernKeeper', 'Master'),
    player('Master', 'MasterThief', 'Target'),
    player('Thief', 'Thief'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, false);
  assert.deepEqual(result.deaths.map(death => death.killerRole), ['Thief']);
});

test('Blocked Master Thief cannot attack alone', () => {
  const players = [
    player('Keeper', 'TavernKeeper', 'Master'),
    player('Master', 'MasterThief', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, true);
  assert.deepEqual(result.deaths, []);
});

test('Full moon kills visitors even when the Werewolf does not attack', () => {
  const players = [
    player('Wolf', 'Werewolf'),
    player('Healer', 'Healer', 'Wolf'),
    player('Villager', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Healer').alive, false);
  assert.deepEqual(result.deaths.map(death => death.name), ['Healer']);
});

test('Only the visiting thief dies at the Werewolf on a Full Moon', () => {
  const players = [
    player('Master', 'MasterThief', 'Wolf'),
    player('Thief', 'Thief'),
    player('Wolf', 'Werewolf', 'Master')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Thief').alive, false);
  assert.equal(players.find(current => current.name === 'Master').alive, false);
  assert.deepEqual(result.deaths.map(death => death.name).sort(), ['Master', 'Thief']);
});

test('Master Thief visits the Werewolf alone once the Thief is dead', () => {
  const players = [
    player('Master', 'MasterThief', 'Wolf'),
    player('Wolf', 'Werewolf')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Master').alive, false);
  assert.deepEqual(result.deaths.map(death => death.name), ['Master']);
});

test('Healing a night-immune target reports no healing', () => {
  const players = [
    player('Thief', 'Thief', 'Red'),
    player('Healer', 'Healer', 'Red'),
    player('Hunter', 'Hunter'),
    player('Red', 'RedHat')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(result.healed, false);
  assert.equal(result.privateMessages.some(message => message.type === 'healing-result'), false);
});

test('healing result is private while public result stays anonymous', () => {
  const players = [player('Thief', 'Thief', 'Target'), player('Healer', 'Healer', 'Target'), player('Target', 'Villager')];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(result.healed, true);
  assert.deepEqual(result.privateMessages.find(message => message.type === 'healing-result'), { recipientId: 'Healer', type: 'healing-result', success: true });
  assert.equal(result.protected, 'Target');
});
