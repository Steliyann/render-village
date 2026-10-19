const { NIGHT_ROLE_ORDER, ROLE_DEFINITIONS, roleDefinition, validateRoleDefinitions } = require('./game/roles');

const nightRoleOrder = [...NIGHT_ROLE_ORDER];
const roleTeams = Object.fromEntries(Object.values(ROLE_DEFINITIONS).map(role => [role.id, role.team]));

const scenarios = {
  4: ['Villager', 'Villager', 'Thief', 'Healer'],
  5: ['Villager', 'Villager', 'Thief', 'Healer', 'Jester'],
  6: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief'],
  7: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf'],
  8: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf', 'TavernKeeper'],
  9: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf', 'TavernKeeper', 'Jester'],
  10: ['Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf', 'Shadow', 'Jester', 'TavernKeeper'],
  11: ['Villager', 'Villager', 'Villager', 'Healer', 'Militia', 'MasterThief', 'Thief', 'Werewolf', 'Shadow', 'Jester', 'TavernKeeper']
};

function scenarioForPlayerCount(playerCount) {
  const roles = scenarios[playerCount];
  if (!roles) return null;
  validateRoleDefinitions();
  const roleQuantities = roles.reduce((quantities, role) => {
    quantities[role] = (quantities[role] || 0) + 1;
    return quantities;
  }, {});
  const roleDefinitions = Object.fromEntries(Object.keys(roleQuantities).map(role => [role, roleDefinition(role)]));
  return {
    id: `scenario-${playerCount}`,
    playerCount,
    roles: [...roles],
    roleTeams: { ...roleTeams },
    roleQuantities,
    roleDefinitions,
    nightRoleOrder: [...nightRoleOrder],
    timers: { preparation: 30, nightAction: 40, dayDiscussion: 240, defense: 60, finalVote: 40 },
    specialRules: ['Full Moon occurs on even-numbered nights.', 'Jester victory occurs on daytime execution.'],
    victoryConditions: ['Townsfolk', 'Thieves', 'Werewolf', 'Jester']
  };
}

function validateScenario(scenario) {
  if (!scenario || !Number.isInteger(scenario.playerCount) || scenario.roles.length !== scenario.playerCount) return false;
  if (Object.values(scenario.roleQuantities).reduce((total, quantity) => total + quantity, 0) !== scenario.playerCount) return false;
  if (scenario.roles.some(role => !ROLE_DEFINITIONS[role])) return false;
  if (scenario.nightRoleOrder.some(role => !ROLE_DEFINITIONS[role]?.actsAtNight)) return false;
  return true;
}

module.exports = { nightRoleOrder, roleTeams, roleDefinition, scenarioForPlayerCount, validateScenario };
