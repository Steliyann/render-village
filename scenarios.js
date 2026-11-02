const crypto = require('node:crypto');
const { NIGHT_ROLE_ORDER, ROLE_DEFINITIONS, roleDefinition, validateRoleDefinitions } = require('./game/roles');

const nightRoleOrder = [...NIGHT_ROLE_ORDER];
const roleTeams = Object.fromEntries(Object.values(ROLE_DEFINITIONS).map(role => [role.id, role.team]));
const roleSubgroups = Object.fromEntries(Object.values(ROLE_DEFINITIONS).map(role => [role.id, role.subgroup]));

const scenarios = {
  4: [
    { subgroup: 'Thieves Killing', count: 1 },
    { subgroup: 'Townsfolk Neutral', count: 2 },
    { subgroup: 'Townsfolk Support', count: 1 }
  ],
  5: [
    { subgroup: 'Thieves Killing', count: 1 },
    { subgroup: 'Townsfolk Neutral', count: 2 },
    { subgroup: 'Independent Evil', count: 1 },
    { subgroup: 'Townsfolk Support', count: 1 }
  ],
  6: [
    { subgroup: 'Townsfolk Neutral', count: 2 },
    { subgroup: 'Townsfolk Support', count: 1 },
    { subgroup: 'Townsfolk Investigate', count: 1 },
    { subgroup: 'Thieves Killing', count: 2 }
  ],
  7: [
    { subgroup: 'Townsfolk Neutral', count: 2 },
    { subgroup: 'Townsfolk Support', count: 1 },
    { subgroup: 'Townsfolk Investigate', count: 1 },
    { subgroup: 'Thieves Killing', count: 2 },
    { subgroup: 'Independent Evil', count: 1 }
  ],
  8: [
    { subgroup: 'Townsfolk Neutral', count: 2 },
    { subgroup: 'Townsfolk Support', count: 1 },
    { subgroup: 'Townsfolk Investigate', count: 1 },
    { subgroup: 'Townsfolk Blocking', count: 1 },
    { subgroup: 'Thieves Killing', count: 2 },
    { subgroup: 'Independent Evil', count: 1 }
  ],
  9: [
    { subgroup: 'Townsfolk Neutral', count: 2 },
    { subgroup: 'Townsfolk Support', count: 1 },
    { subgroup: 'Townsfolk Investigate', count: 1 },
    { subgroup: 'Townsfolk Blocking', count: 1 },
    { subgroup: 'Thieves Killing', count: 2 },
    { subgroup: 'Independent Evil', count: 2 }
  ],
  10: [
    { subgroup: 'Townsfolk Neutral', count: 2 },
    { subgroup: 'Townsfolk Support', count: 1 },
    { subgroup: 'Townsfolk Investigate', count: 2 },
    { subgroup: 'Townsfolk Blocking', count: 1 },
    { subgroup: 'Thieves Killing', count: 2 },
    { subgroup: 'Independent Evil', count: 2 }
  ],
  11: [
    { subgroup: 'Townsfolk Neutral', count: 2 },
    { subgroup: 'Townsfolk Support', count: 1 },
    { subgroup: 'Townsfolk Investigate', count: 2 },
    { subgroup: 'Townsfolk Blocking', count: 1 },
    { subgroup: 'Townsfolk Killing', count: 1 },
    { subgroup: 'Thieves Killing', count: 2 },
    { subgroup: 'Independent Evil', count: 2 }
  ]
};

function resolveRoleSlots(roleSlots, randomInt = crypto.randomInt) {
  const roles = [];
  for (const { subgroup, count } of roleSlots) {
    const candidates = Object.values(ROLE_DEFINITIONS)
      .filter(role => role.subgroup === subgroup && (role.id === 'Villager' || !roles.includes(role.id)))
      .map(role => role.id);
    for (let index = 0; index < count; index += 1) {
      if (candidates.length === 0) throw new Error(`No unique roles remain in subgroup ${subgroup}.`);
      const selectedIndex = randomInt(candidates.length);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= candidates.length) {
        throw new Error('Random source returned an invalid index.');
      }
      const [role] = candidates.splice(selectedIndex, 1);
      roles.push(role);
      if (role === 'Villager') candidates.push(role);
    }
  }
  return roles;
}

function scenarioForPlayerCount(playerCount, randomInt = crypto.randomInt) {
  const roleSlots = scenarios[playerCount];
  if (!roleSlots) return null;
  validateRoleDefinitions();
  const roles = resolveRoleSlots(roleSlots, randomInt);
  const roleQuantities = roles.reduce((quantities, role) => {
    quantities[role] = (quantities[role] || 0) + 1;
    return quantities;
  }, {});
  const roleDefinitions = Object.fromEntries(Object.keys(roleQuantities).map(role => [role, roleDefinition(role)]));
  return {
    id: `scenario-${playerCount}`,
    playerCount,
    roleSlots: roleSlots.map(slot => ({ ...slot })),
    roles,
    roleTeams: { ...roleTeams },
    roleSubgroups: { ...roleSubgroups },
    roleQuantities,
    roleDefinitions,
    nightRoleOrder: [...nightRoleOrder],
    timers: { preparation: 30, nightAction: 40, dayDiscussion: 240, defense: 60, finalVote: 40 },
    specialRules: ['Full Moon occurs on even-numbered nights.', 'Jester victory occurs on daytime execution.'],
    victoryConditions: ['Townsfolk', 'Thieves', 'Werewolf', 'Jester']
  };
}

function validateScenario(scenario) {
  if (!scenario || !Number.isInteger(scenario.playerCount) || !Array.isArray(scenario.roles) || scenario.roles.length !== scenario.playerCount) return false;
  if (!Array.isArray(scenario.roleSlots) || scenario.roleSlots.some(slot => {
    if (!slot || typeof slot.subgroup !== 'string' || !Number.isInteger(slot.count) || slot.count < 1) return true;
    const eligibleRoles = Object.values(ROLE_DEFINITIONS).filter(role => role.subgroup === slot.subgroup);
    const allowsVillagerDuplicates = eligibleRoles.some(role => role.id === 'Villager');
    return eligibleRoles.length === 0 || (!allowsVillagerDuplicates && slot.count > eligibleRoles.length);
  })) return false;
  if (scenario.roleSlots.reduce((total, slot) => total + slot.count, 0) !== scenario.playerCount) return false;
  if (scenario.roles.some(role => !ROLE_DEFINITIONS[role])) return false;
  const roleCounts = scenario.roles.reduce((counts, role) => {
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, {});
  if (Object.entries(roleCounts).some(([role, count]) => count > 1 && role !== 'Villager')) return false;
  const expectedSubgroupCounts = scenario.roleSlots.reduce((counts, slot) => {
    counts[slot.subgroup] = (counts[slot.subgroup] || 0) + slot.count;
    return counts;
  }, {});
  const actualSubgroupCounts = scenario.roles.reduce((counts, role) => {
    const subgroup = ROLE_DEFINITIONS[role].subgroup;
    counts[subgroup] = (counts[subgroup] || 0) + 1;
    return counts;
  }, {});
  if (Object.keys(expectedSubgroupCounts).length !== Object.keys(actualSubgroupCounts).length) return false;
  if (Object.entries(expectedSubgroupCounts).some(([subgroup, count]) => actualSubgroupCounts[subgroup] !== count)) return false;
  if (!scenario.roleQuantities || typeof scenario.roleQuantities !== 'object') return false;
  if (Object.values(scenario.roleQuantities).reduce((total, quantity) => total + quantity, 0) !== scenario.playerCount) return false;
  if (Object.keys(roleCounts).length !== Object.keys(scenario.roleQuantities).length) return false;
  if (Object.entries(roleCounts).some(([role, count]) => scenario.roleQuantities[role] !== count)) return false;
  if (!Array.isArray(scenario.nightRoleOrder) || scenario.nightRoleOrder.some(role => !ROLE_DEFINITIONS[role]?.actsAtNight)) return false;
  return true;
}

module.exports = { nightRoleOrder, roleTeams, roleSubgroups, resolveRoleSlots, scenarioForPlayerCount, validateScenario };
