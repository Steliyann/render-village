const ROLE_DEFINITIONS = {
  Villager: {
    id: 'Villager',
    name: 'Villager',
    description: 'Participates in daytime discussions, accusations, voting, and execution decisions.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: false,
    nightPriority: null,
    actionTimer: 0,
    targeting: { type: 'none', allowNone: true, allowSelf: false },
    canBeBlocked: false,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: [],
    victoryCondition: 'Townsfolk victory'
  },
  Healer: {
    id: 'Healer',
    name: 'Healer',
    description: 'Protects one player from a night attack.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 6,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: true, selfLimit: 1 },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Protects the selected player from a same-night attack.', 'Can heal self once per game.'],
    victoryCondition: 'Townsfolk victory'
  },
  TavernKeeper: {
    id: 'TavernKeeper',
    name: 'Tavern Keeper',
    description: 'Blocks one player from using their night ability.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 1,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Cannot block the Werewolf during a Full Moon.'],
    victoryCondition: 'Townsfolk victory'
  },
  Militia: {
    id: 'Militia',
    name: 'Militia',
    description: 'Investigates one player alignment.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 5,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Master Thief appears as Townsfolk / Good.', 'Thief appears as Thieves / Evil.'],
    victoryCondition: 'Townsfolk victory'
  },
  Hunter: {
    id: 'Hunter',
    name: 'Hunter',
    description: 'Shoots one player after the first night.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 7,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Cannot shoot on the first night.', 'Commits suicide after shooting a Townsfolk player.', 'Protects RedHat from night attacks while alive.'],
    victoryCondition: 'Townsfolk victory'
  },
  RedHat: {
    id: 'RedHat',
    name: 'RedHat',
    description: 'Cannot die from a night attack while the Hunter is alive.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: false,
    nightPriority: null,
    actionTimer: 0,
    targeting: { type: 'none', allowNone: true, allowSelf: false },
    canBeBlocked: false,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Night protection depends on a living Hunter.'],
    victoryCondition: 'Townsfolk victory'
  },
  Shadow: {
    id: 'Shadow',
    name: 'Shadow',
    description: 'Investigates which players visited a selected target.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 8,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Receives visitor facts without roles, abilities, actions, or intentions.'],
    victoryCondition: 'Townsfolk victory'
  },
  MasterThief: {
    id: 'MasterThief',
    name: 'Master Thief',
    description: 'Selects the Thieves target and takes over the attack if the Thief is unavailable.',
    alignment: 'Thieves',
    team: 'Thieves',
    actsAtNight: true,
    nightPriority: 2,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Knows the Thief.', 'Thief performs the physical attack while both are alive.', 'Takes over visiting and attacking after Thief death or departure.'],
    victoryCondition: 'Thieves victory'
  },
  Thief: {
    id: 'Thief',
    name: 'Thief',
    description: 'Performs the Thieves visit and attack.',
    alignment: 'Thieves',
    team: 'Thieves',
    actsAtNight: true,
    nightPriority: 3,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Thieves / Evil',
    specialInteractions: ['Knows the Master Thief.', 'Performs the physical attack selected by the Master Thief.'],
    victoryCondition: 'Thieves victory'
  },
  Werewolf: {
    id: 'Werewolf',
    name: 'Werewolf',
    description: 'Acts alone during Full Moon nights and kills players who visit it.',
    alignment: 'Independent Evil',
    team: 'Independent Evil',
    actsAtNight: true,
    nightPriority: 4,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: false,
    canBeKilled: false,
    investigationResult: 'Independent Evil / Neutral Evil',
    specialInteractions: ['Acts only on even-numbered nights.', 'Cannot be killed at night.', 'Kills visitors during a Full Moon.', 'Full Moon action cannot be blocked.'],
    victoryCondition: 'Werewolf victory'
  },
  Jester: {
    id: 'Jester',
    name: 'Jester',
    description: 'Wins by being executed through the daytime voting process.',
    alignment: 'Independent Evil',
    team: 'Independent Evil',
    actsAtNight: false,
    nightPriority: null,
    actionTimer: 0,
    targeting: { type: 'none', allowNone: true, allowSelf: false },
    canBeBlocked: false,
    canBeKilled: true,
    investigationResult: 'Independent Evil / Neutral Evil',
    specialInteractions: ['Jester victory occurs on daytime execution.'],
    victoryCondition: 'Jester victory'
  }
};

const NIGHT_ROLE_ORDER = Object.values(ROLE_DEFINITIONS)
  .filter(role => role.actsAtNight)
  .sort((left, right) => left.nightPriority - right.nightPriority)
  .map(role => role.id);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function roleDefinition(roleId) {
  const definition = ROLE_DEFINITIONS[roleId];
  return definition ? clone(definition) : null;
}

function publicRoleDefinition(roleId) {
  const definition = roleDefinition(roleId);
  if (!definition) return null;
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    alignment: definition.alignment,
    team: definition.team,
    actsAtNight: definition.actsAtNight,
    actionTimer: definition.actionTimer,
    targeting: definition.targeting,
    investigationResult: definition.investigationResult,
    specialInteractions: definition.specialInteractions,
    victoryCondition: definition.victoryCondition
  };
}

function validateRoleDefinitions() {
  for (const definition of Object.values(ROLE_DEFINITIONS)) {
    if (!definition.id || !definition.name || !definition.alignment || !definition.team) throw new Error(`Invalid role definition: ${definition.id}`);
    if (!definition.targeting || typeof definition.canBeBlocked !== 'boolean' || typeof definition.canBeKilled !== 'boolean') throw new Error(`Incomplete role definition: ${definition.id}`);
    if (definition.actsAtNight && (!Number.isInteger(definition.nightPriority) || definition.actionTimer <= 0)) throw new Error(`Invalid night role definition: ${definition.id}`);
    if (!definition.actsAtNight && definition.nightPriority !== null) throw new Error(`Inactive role has a night priority: ${definition.id}`);
  }
  return true;
}

validateRoleDefinitions();

module.exports = { ROLE_DEFINITIONS, NIGHT_ROLE_ORDER, roleDefinition, publicRoleDefinition, validateRoleDefinitions };
