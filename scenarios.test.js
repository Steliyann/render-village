const test = require('node:test');
const assert = require('node:assert/strict');
const { nightRoleOrder, roleTeams, scenarioForPlayerCount, validateScenario } = require('./scenarios');
const { ROLE_DEFINITIONS, publicRoleDefinition, validateRoleDefinitions } = require('./game/roles');

const expectedRoles = {
  4: ['Villager', 'Villager', 'Thief', 'Healer'],
  5: ['Villager', 'Villager', 'Thief', 'Healer', 'Jester'],
  6: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief'],
  7: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf'],
  8: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf', 'TavernKeeper'],
  9: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf', 'TavernKeeper', 'Jester'],
  10: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf', 'Shadow', 'Jester', 'TavernKeeper'],
  11: ['Villager', 'Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf', 'Shadow', 'Jester', 'TavernKeeper']
};

test('defines every documented player scenario', () => {
  for (const [playerCount, roles] of Object.entries(expectedRoles)) {
    const scenario = scenarioForPlayerCount(Number(playerCount));
    assert.equal(scenario.id, `scenario-${playerCount}`);
    assert.equal(scenario.playerCount, Number(playerCount));
    assert.deepEqual(scenario.roles, roles);
  }
});

test('rejects unsupported player counts', () => {
  assert.equal(scenarioForPlayerCount(3), null);
  assert.equal(scenarioForPlayerCount(12), null);
});

test('keeps role-team metadata for every configured role', () => {
  for (const roles of Object.values(expectedRoles)) {
    for (const role of roles) assert.ok(roleTeams[role], `Missing team for ${role}`);
  }
});

test('keeps the required night action order', () => {
  assert.deepEqual(nightRoleOrder, ['TavernKeeper', 'MasterThief', 'Thief', 'Werewolf', 'Militia', 'Healer', 'Hunter', 'Shadow']);
});

test('returns defensive copies of scenario arrays', () => {
  const first = scenarioForPlayerCount(8);
  first.roles[0] = 'CorruptedRole';
  first.nightRoleOrder.pop();
  const second = scenarioForPlayerCount(8);
  assert.equal(second.roles[0], 'Villager');
  assert.equal(second.nightRoleOrder.length, 8);
});

test('defines structured metadata for every role', () => {
  assert.equal(validateRoleDefinitions(), true);
  for (const definition of Object.values(ROLE_DEFINITIONS)) {
    assert.ok(definition.id);
    assert.ok(definition.name);
    assert.ok(definition.alignment);
    assert.ok(definition.team);
    assert.ok(definition.targeting);
    assert.equal(typeof definition.canBeBlocked, 'boolean');
    assert.equal(typeof definition.canBeKilled, 'boolean');
  }
  assert.equal(ROLE_DEFINITIONS.Werewolf.alignment, 'Independent Evil');
  assert.equal(ROLE_DEFINITIONS.Jester.alignment, 'Independent Evil');
});

test('scenario metadata is complete and validates', () => {
  const scenario = scenarioForPlayerCount(11);
  assert.equal(validateScenario(scenario), true);
  assert.deepEqual(scenario.roleQuantities, {
    Villager: 3,
    Healer: 1,
    Militia: 1,
    MasterThief: 1,
    Thief: 1,
    Werewolf: 1,
    Shadow: 1,
    Jester: 1,
    TavernKeeper: 1
  });
  assert.equal(scenario.roleDefinitions.Werewolf.alignment, 'Independent Evil');
  assert.equal(scenario.timers.nightAction, 40);
});

test('scenario validation rejects unknown roles and invalid action order', () => {
  const scenario = scenarioForPlayerCount(4);
  scenario.roles[0] = 'UnknownRole';
  assert.equal(validateScenario(scenario), false);

  const invalidOrder = scenarioForPlayerCount(4);
  invalidOrder.nightRoleOrder.push('Villager');
  assert.equal(validateScenario(invalidOrder), false);
});

test('public role definitions exclude server-only blocking and killability rules', () => {
  const definition = publicRoleDefinition('Healer');
  assert.equal(definition.id, 'Healer');
  assert.equal(definition.team, 'Townsfolk');
  assert.equal('canBeBlocked' in definition, false);
  assert.equal('canBeKilled' in definition, false);
});
