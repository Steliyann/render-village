const test = require('node:test');
const assert = require('node:assert/strict');
const { nightRoleOrder, roleTeams, roleSubgroups, resolveRoleSlots, scenarioForPlayerCount, validateScenario } = require('./scenarios');
const { ROLE_DEFINITIONS, publicRoleDefinition, validateRoleDefinitions } = require('./game/roles');

const expectedSubgroupCounts = {
  4: { 'Thieves Killing': 1, 'Townsfolk Neutral': 2, 'Townsfolk Support': 1 },
  5: { 'Thieves Killing': 1, 'Townsfolk Neutral': 2, 'Independent Evil': 1, 'Townsfolk Support': 1 },
  6: { 'Townsfolk Neutral': 2, 'Townsfolk Support': 1, 'Townsfolk Investigate': 1, 'Thieves Killing': 2 },
  7: { 'Townsfolk Neutral': 2, 'Townsfolk Support': 1, 'Townsfolk Investigate': 1, 'Thieves Killing': 2, 'Independent Evil': 1 },
  8: { 'Townsfolk Neutral': 2, 'Townsfolk Support': 1, 'Townsfolk Investigate': 1, 'Townsfolk Blocking': 1, 'Thieves Killing': 2, 'Independent Evil': 1 },
  9: { 'Townsfolk Neutral': 2, 'Townsfolk Support': 1, 'Townsfolk Investigate': 1, 'Townsfolk Blocking': 1, 'Thieves Killing': 2, 'Independent Evil': 2 },
  10: { 'Townsfolk Neutral': 2, 'Townsfolk Support': 1, 'Townsfolk Investigate': 2, 'Townsfolk Blocking': 1, 'Thieves Killing': 2, 'Independent Evil': 2 },
  11: { 'Townsfolk Neutral': 2, 'Townsfolk Support': 1, 'Townsfolk Investigate': 2, 'Townsfolk Blocking': 1, 'Townsfolk Killing': 1, 'Thieves Killing': 2, 'Independent Evil': 2 },
  12: { 'Townsfolk Support': 1, 'Townsfolk Investigate': 2, 'Townsfolk Blocking': 1, 'Townsfolk Killing': 1, 'Thieves Killing': 2, 'Thieves Support': 2, 'Independent Evil': 3 }
};

test('defines every documented player scenario', () => {
  for (const [playerCount, subgroupCounts] of Object.entries(expectedSubgroupCounts)) {
    const scenario = scenarioForPlayerCount(Number(playerCount), () => 0);
    assert.equal(scenario.id, `scenario-${playerCount}`);
    assert.equal(scenario.playerCount, Number(playerCount));
    assert.equal(scenario.roles.length, Number(playerCount));
    assert.deepEqual(Object.fromEntries(Object.entries(scenario.roles.reduce((counts, role) => {
      const subgroup = roleSubgroups[role];
      counts[subgroup] = (counts[subgroup] || 0) + 1;
      return counts;
    }, {})).sort()), Object.fromEntries(Object.entries(subgroupCounts).sort()));
    assert.equal(new Set(scenario.roles.filter(role => role !== 'Villager')).size, scenario.roles.filter(role => role !== 'Villager').length);
    assert.equal(validateScenario(scenario), true);
  }
});

test('rejects unsupported player counts', () => {
  assert.equal(scenarioForPlayerCount(3), null);
  assert.equal(scenarioForPlayerCount(13), null);
});

test('keeps role-team metadata for every configured role', () => {
  for (const playerCount of Object.keys(expectedSubgroupCounts)) {
    for (const role of scenarioForPlayerCount(Number(playerCount)).roles) assert.ok(roleTeams[role], `Missing team for ${role}`);
  }
});

test('assigns the requested role subgroups', () => {
  assert.deepEqual(roleSubgroups, {
    Villager: 'Townsfolk Neutral',
    Healer: 'Townsfolk Support',
    Guard: 'Townsfolk Support',
    Jailor: 'Townsfolk Blocking',
    TavernKeeper: 'Townsfolk Blocking',
    Militia: 'Townsfolk Investigate',
    Judge: 'Townsfolk Investigate',
    Hunter: 'Townsfolk Killing',
    Crossbowman: 'Townsfolk Killing',
    Trapper: 'Townsfolk Killing',
    RedHat: 'Townsfolk Neutral',
    Shadow: 'Townsfolk Investigate',
    Watcher: 'Townsfolk Investigate',
    MasterThief: 'Thieves Killing',
    Thief: 'Thieves Killing',
    ThiefShaman: 'Thieves Support',
    ThiefSeer: 'Thieves Support',
    Werewolf: 'Independent Evil',
    Jester: 'Independent Evil',
    Gamester: 'Independent Evil'
  });
});

test('resolves subgroup slots to eligible random roles and only permits duplicate Villagers', () => {
  const slots = [{ subgroup: 'Townsfolk Neutral', count: 2 }];
  const distinct = resolveRoleSlots(slots, () => 0);
  let draw = 0;
  const duplicatedVillager = resolveRoleSlots(slots, max => draw++ === 0 ? 0 : max - 1);
  assert.ok(distinct.every(role => roleSubgroups[role] === 'Townsfolk Neutral'));
  assert.equal(new Set(distinct).size, 2);
  assert.deepEqual(duplicatedVillager, ['Villager', 'Villager']);
  assert.ok(resolveRoleSlots([{ subgroup: 'Independent Evil', count: 2 }], () => 0).every(role => roleSubgroups[role] === 'Independent Evil'));
});

test('keeps the required night action order', () => {
  assert.deepEqual(nightRoleOrder, ['Jailor', 'TavernKeeper', 'MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer', 'Gamester', 'Werewolf', 'Militia', 'Judge', 'Healer', 'Guard', 'Hunter', 'Crossbowman', 'Trapper', 'Watcher', 'Shadow']);
});

test('raises priorities from 7 onward while keeping Gamester at 7', () => {
  const expectedPriorities = {
    Gamester: 7,
    Werewolf: 8,
    Militia: 9,
    Judge: 10,
    Healer: 11,
    Guard: 12,
    Hunter: 13,
    Crossbowman: 14,
    Trapper: 15,
    Watcher: 16,
    Shadow: 17
  };
  for (const [role, priority] of Object.entries(expectedPriorities)) {
    assert.equal(ROLE_DEFINITIONS[role].nightPriority, priority, `${role} priority`);
  }
});

test('returns defensive copies of scenario arrays', () => {
  const first = scenarioForPlayerCount(8);
  first.roles[0] = 'CorruptedRole';
  first.roleSlots[0].subgroup = 'CorruptedSubgroup';
  first.nightRoleOrder.pop();
  const second = scenarioForPlayerCount(8);
  assert.equal(validateScenario(second), true);
  assert.equal(second.roleSlots[0].subgroup, 'Townsfolk Neutral');
  assert.deepEqual(second.nightRoleOrder, nightRoleOrder);
});

test('defines structured metadata for every role', () => {
  assert.equal(validateRoleDefinitions(), true);
  for (const definition of Object.values(ROLE_DEFINITIONS)) {
    assert.ok(definition.id);
    assert.ok(definition.name);
    assert.ok(definition.alignment);
    assert.ok(definition.team);
    assert.ok('subgroup' in definition);
    assert.ok(definition.targeting);
    assert.equal(typeof definition.canBeBlocked, 'boolean');
    assert.equal(typeof definition.canBeKilled, 'boolean');
  }
  assert.equal(ROLE_DEFINITIONS.Werewolf.alignment, 'Independent Evil');
  assert.equal(ROLE_DEFINITIONS.Jester.alignment, 'Independent Evil');
  assert.equal(ROLE_DEFINITIONS.Werewolf.subgroup, 'Independent Evil');
  assert.equal(ROLE_DEFINITIONS.Jester.subgroup, 'Independent Evil');
  assert.equal(ROLE_DEFINITIONS.Gamester.alignment, 'Independent Evil');
  assert.equal(ROLE_DEFINITIONS.Gamester.team, 'Independent Evil');
  assert.equal(ROLE_DEFINITIONS.Gamester.subgroup, 'Independent Evil');
  assert.equal(ROLE_DEFINITIONS.Gamester.nightPriority, 7);
  assert.deepEqual(ROLE_DEFINITIONS.Gamester.targeting, { type: 'living-player', allowNone: true, allowSelf: false });
  assert.equal(ROLE_DEFINITIONS.Judge.team, 'Townsfolk');
  assert.equal(ROLE_DEFINITIONS.Judge.subgroup, 'Townsfolk Investigate');
  assert.equal(ROLE_DEFINITIONS.Judge.nightPriority, 10);
  assert.deepEqual(ROLE_DEFINITIONS.Judge.targeting, { type: 'two-living-players', allowNone: true, allowSelf: false });
  assert.equal(ROLE_DEFINITIONS.Jailor.team, 'Townsfolk');
  assert.equal(ROLE_DEFINITIONS.Jailor.subgroup, 'Townsfolk Blocking');
  assert.equal(ROLE_DEFINITIONS.Jailor.nightPriority, 1);
  assert.equal(ROLE_DEFINITIONS.Trapper.nightPriority, 15);
  assert.deepEqual(ROLE_DEFINITIONS.Trapper.targeting, { type: 'living-player', allowNone: true, allowSelf: true });
  assert.equal(ROLE_DEFINITIONS.ThiefShaman.team, 'Thieves');
  assert.equal(ROLE_DEFINITIONS.ThiefShaman.subgroup, 'Thieves Support');
  assert.equal(ROLE_DEFINITIONS.ThiefSeer.team, 'Thieves');
  assert.equal(ROLE_DEFINITIONS.ThiefSeer.subgroup, 'Thieves Support');
  assert.equal(ROLE_DEFINITIONS.ThiefSeer.nightPriority, 6);
});

test('scenario metadata is complete and validates', () => {
  const scenario = scenarioForPlayerCount(11, () => 0);
  assert.equal(validateScenario(scenario), true);
  assert.equal(Object.values(scenario.roleQuantities).reduce((total, quantity) => total + quantity, 0), 11);
  assert.equal(scenario.roleDefinitions.Werewolf.alignment, 'Independent Evil');
  assert.equal(scenario.roleSubgroups.Healer, 'Townsfolk Support');
  assert.equal(scenario.timers.nightAction, 40);

  const twelvePlayerScenario = scenarioForPlayerCount(12, () => 0);
  assert.equal(validateScenario(twelvePlayerScenario), true);
  assert.equal(twelvePlayerScenario.roles.length, 12);
  assert.equal(twelvePlayerScenario.roleQuantities.ThiefShaman + twelvePlayerScenario.roleQuantities.ThiefSeer, 2);
});

test('scenario validation rejects unknown roles and invalid action order', () => {
  const scenario = scenarioForPlayerCount(4);
  scenario.roles[0] = 'UnknownRole';
  assert.equal(validateScenario(scenario), false);

  const invalidOrder = scenarioForPlayerCount(4);
  invalidOrder.nightRoleOrder.push('Villager');
  assert.equal(validateScenario(invalidOrder), false);

  const duplicateRole = scenarioForPlayerCount(6, () => 0);
  duplicateRole.roles[2] = duplicateRole.roles[3];
  assert.equal(validateScenario(duplicateRole), false);
});

test('public role definitions exclude server-only blocking and killability rules', () => {
  const definition = publicRoleDefinition('Healer');
  assert.equal(definition.id, 'Healer');
  assert.equal(definition.team, 'Townsfolk');
  assert.equal(definition.subgroup, 'Townsfolk Support');
  assert.equal('canBeBlocked' in definition, false);
  assert.equal('canBeKilled' in definition, false);
});
