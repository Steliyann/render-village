const ROLE_DEFINITIONS = {
  Villager: {
    id: 'Villager',
    name: 'Villager',
    subgroup: 'Townsfolk Neutral',
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
    subgroup: 'Townsfolk Support',
    description: 'Protects one player from a night attack.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 10,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: true, selfLimit: 1 },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Protects the selected player from a same-night attack.', 'Can heal self once per game.'],
    victoryCondition: 'Townsfolk victory'
  },
  Guard: {
    id: 'Guard',
    name: 'Guard',
    subgroup: 'Townsfolk Support',
    description: 'Guards one player from a night kill, sacrificing themselves alongside the killer.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 11,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['May pass without guarding anyone.', 'If the guarded player is attacked for a kill, the player survives while the Guard and credited killer die.'],
    victoryCondition: 'Townsfolk victory'
  },
  Jailor: {
    id: 'Jailor',
    name: 'Jailor',
    subgroup: 'Townsfolk Blocking',
    description: 'Jails one player, preventing their night action and all effects from reaching them.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 1,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['May pass without jailing anyone.', 'The jailed player cannot act; visitors still submit actions, but those actions have no effect and visitors are not notified.'],
    victoryCondition: 'Townsfolk victory'
  },
  TavernKeeper: {
    id: 'TavernKeeper',
    name: 'Tavern Keeper',
    subgroup: 'Townsfolk Blocking',
    description: 'Blocks one player from using their night ability.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 2,
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
    subgroup: 'Townsfolk Investigate',
    description: 'Investigates one player alignment.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 8,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Master Thief appears as Townsfolk / Good.', 'Thief appears as Thieves / Evil.'],
    victoryCondition: 'Townsfolk victory'
  },
  Judge: {
    id: 'Judge',
    name: 'Judge',
    subgroup: 'Townsfolk Investigate',
    description: 'Compares two players and learns whether they are teammates or rivals.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 9,
    actionTimer: 40,
    targeting: { type: 'two-living-players', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Selecting two players counts as visiting both for night visit effects.', 'Players on the same Townsfolk or Thieves team are teammates.', 'Independent Evil players are always rivals, including two Independent Evil players.'],
    victoryCondition: 'Townsfolk victory'
  },
  Hunter: {
    id: 'Hunter',
    name: 'Hunter',
    subgroup: 'Townsfolk Killing',
    description: 'Shoots one player after the first night.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 12,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Cannot shoot on the first night.', 'Commits suicide after shooting a Townsfolk player.', 'Protects RedHat from night attacks while alive.'],
    victoryCondition: 'Townsfolk victory'
  },
  Crossbowman: {
    id: 'Crossbowman',
    name: 'Crossbowman',
    subgroup: 'Townsfolk Killing',
    description: 'Shoots one player at night, with two arrows for the game.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 13,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Cannot shoot on the first night.', 'Has two arrows for the entire game.'],
    victoryCondition: 'Townsfolk victory'
  },
  Trapper: {
    id: 'Trapper',
    name: 'Trapper',
    subgroup: 'Townsfolk Killing',
    description: 'May place a trap on themselves at night; visitors die. Has two traps for the game.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 14,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: true },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['May pass or place a trap on themselves.', 'Has two traps for the entire game.', 'Every visitor to the Trapper while a trap is set dies and privately receives the Trapper action image.'],
    victoryCondition: 'Townsfolk victory'
  },
  RedHat: {
    id: 'RedHat',
    name: 'RedHat',
    subgroup: 'Townsfolk Neutral',
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
    subgroup: 'Townsfolk Investigate',
    description: 'Investigates which players visited a selected target.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 16,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Townsfolk / Good',
    specialInteractions: ['Receives visitor facts without roles, abilities, actions, or intentions.'],
    victoryCondition: 'Townsfolk victory'
  },
  Watcher: {
    id: 'Watcher',
    name: 'Watcher',
    subgroup: 'Townsfolk Investigate',
    description: 'Investigates which players visited a selected target.',
    alignment: 'Townsfolk',
    team: 'Townsfolk',
    actsAtNight: true,
    nightPriority: 15,
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
    subgroup: 'Thieves Killing',
    description: 'Selects the Thieves target and takes over the attack if the Thief is unavailable.',
    alignment: 'Thieves',
    team: 'Thieves',
    actsAtNight: true,
    nightPriority: 3,
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
    subgroup: 'Thieves Killing',
    description: 'Performs the Thieves visit and attack.',
    alignment: 'Thieves',
    team: 'Thieves',
    actsAtNight: true,
    nightPriority: 4,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Thieves / Evil',
    specialInteractions: ['Knows the Master Thief.', 'Performs the physical attack selected by the Master Thief.'],
    victoryCondition: 'Thieves victory'
  },
  ThiefShaman: {
    id: 'ThiefShaman',
    name: 'Thief Shaman',
    subgroup: 'Thieves Support',
    description: 'Silences one player during the day; if both other Thieves are dead, chooses a player to kill.',
    alignment: 'Thieves',
    team: 'Thieves',
    actsAtNight: true,
    nightPriority: 5,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Thieves / Evil',
    specialInteractions: ['Knows the Master Thief and Thief, who also know the Shaman.', 'While either other Thief lives, may silence one player for the day and learns the Thieves kill target.', 'If both the Master Thief and Thief are dead, can no longer silence and instead selects the Thieves kill target.'],
    victoryCondition: 'Thieves victory'
  },
  ThiefSeer: {
    id: 'ThiefSeer',
    name: 'Thief Seer',
    subgroup: 'Thieves Support',
    description: 'Learns a selected player’s role and shares it with the Thieves; becomes the killer if the other Thieves are dead.',
    alignment: 'Thieves',
    team: 'Thieves',
    actsAtNight: true,
    nightPriority: 6,
    actionTimer: 40,
    targeting: { type: 'living-player', allowNone: true, allowSelf: false },
    canBeBlocked: true,
    canBeKilled: true,
    investigationResult: 'Thieves / Evil',
    specialInteractions: ['Knows the Master Thief, Thief, and Thief Shaman, who also know the Seer.', 'While another Thief lives, learns the selected player’s role and privately shares it with the living Thieves.', 'If the Master Thief, Thief, and Thief Shaman are dead, selects the Thieves kill target instead.'],
    victoryCondition: 'Thieves victory'
  },
  Werewolf: {
    id: 'Werewolf',
    name: 'Werewolf',
    subgroup: 'Independent Evil',
    description: 'Acts alone during Full Moon nights and kills players who visit it.',
    alignment: 'Independent Evil',
    team: 'Independent Evil',
    actsAtNight: true,
    nightPriority: 7,
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
    subgroup: 'Independent Evil',
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
    subgroup: definition.subgroup,
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
    if (definition.subgroup !== null && (typeof definition.subgroup !== 'string' || !definition.subgroup.trim())) throw new Error(`Invalid role subgroup: ${definition.id}`);
    if (!definition.targeting || typeof definition.canBeBlocked !== 'boolean' || typeof definition.canBeKilled !== 'boolean') throw new Error(`Incomplete role definition: ${definition.id}`);
    if (definition.actsAtNight && (!Number.isInteger(definition.nightPriority) || definition.actionTimer <= 0)) throw new Error(`Invalid night role definition: ${definition.id}`);
    if (!definition.actsAtNight && definition.nightPriority !== null) throw new Error(`Inactive role has a night priority: ${definition.id}`);
  }
  return true;
}

validateRoleDefinitions();

module.exports = { ROLE_DEFINITIONS, NIGHT_ROLE_ORDER, roleDefinition, publicRoleDefinition, validateRoleDefinitions };
