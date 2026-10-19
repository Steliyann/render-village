const { roleDefinition } = require('./roles');

function alignmentFor(role) {
  return roleDefinition(role)?.investigationResult || 'Townsfolk / Good';
}

function resolveNight({ players, nightNumber }) {
  const living = players.filter(player => player.alive !== false);
  const blockedNames = new Set(living
    .filter(player => player.role === 'TavernKeeper' && player.action && player.action !== 'none')
    .map(player => player.action));
  const isBlocked = player => blockedNames.has(player.name) && !(player.role === 'Werewolf' && nightNumber % 2 === 0);
  const healer = living.find(player => player.role === 'Healer' && !isBlocked(player));
  const healerTarget = healer?.action && healer.action !== 'none' ? living.find(player => player.name === healer.action) : null;
  const selfHealing = Boolean(healer && healerTarget && healerTarget.id === healer.id);
  const canSelfHeal = !selfHealing || healer.selfHealUsed !== true;
  const protectedName = canSelfHeal ? healerTarget?.name || null : null;
  if (selfHealing && canSelfHeal) healer.selfHealUsed = true;
  const hunter = living.find(player => player.role === 'Hunter' && !isBlocked(player));
  const hunterTarget = nightNumber > 1 && hunter?.action && hunter.action !== 'none' ? hunter.action : null;
  const thief = living.find(player => player.role === 'Thief');
  const masterThief = living.find(player => player.role === 'MasterThief');
  const thiefCanVisit = thief && !isBlocked(thief);
  // A blocked Master Thief still picks the target while a living Thief can carry out the attack.
  const masterCanVisit = masterThief && (!isBlocked(masterThief) || Boolean(thief));
  let thievesAttacker = null;
  if (thief && masterThief && thiefCanVisit && masterCanVisit && masterThief.action && masterThief.action !== 'none') {
    thief.action = masterThief.action;
    thievesAttacker = thief;
  } else if (!thief && masterCanVisit) {
    thievesAttacker = masterThief;
  } else if (!masterThief && thiefCanVisit) {
    thievesAttacker = thief;
  }
  const attackers = living.filter(player => player.role === 'Werewolf' && !isBlocked(player));
  if (thievesAttacker) attackers.push(thievesAttacker);
  const killerByTarget = new Map();
  for (const attacker of attackers) {
    if (attacker.action && attacker.action !== 'none') killerByTarget.set(attacker.action, attacker.role);
  }
  const victims = new Set(attackers.map(attacker => attacker.action).filter(target => target && target !== 'none'));
  if (hunterTarget) {
    victims.add(hunterTarget);
    if (!killerByTarget.has(hunterTarget)) killerByTarget.set(hunterTarget, 'Hunter');
  }
  const hunterAlive = hunter && hunter.alive !== false;
  const redHatProtected = target => target.role === 'RedHat' && hunterAlive;
  const deaths = [];

  for (const targetName of victims) {
    const target = living.find(player => player.name === targetName);
    if (!target || target.name === protectedName || redHatProtected(target) || target.role === 'Werewolf') continue;
    target.alive = false;
    deaths.push({ name: target.name, role: target.role, killerRole: killerByTarget.get(target.name) || null });
  }

  if (hunterTarget) {
    const target = living.find(player => player.name === hunterTarget);
    if (target?.role && !['MasterThief', 'Thief', 'Werewolf'].includes(target.role) && hunter.alive !== false) {
      hunter.alive = false;
      deaths.push({ name: hunter.name, role: hunter.role, cause: 'hunter-suicide' });
    }
  }

  const werewolf = living.find(player => player.role === 'Werewolf' && player.alive !== false);
  if (werewolf && nightNumber % 2 === 0) {
    // Only the thief who actually carries out the visit dies; the partner stays home.
    const isIdleThiefPartner = player => ['MasterThief', 'Thief'].includes(player.role) && player !== thievesAttacker;
    for (const visitor of living.filter(player => player.name !== werewolf.name && player.action === werewolf.name && !isBlocked(player) && !isIdleThiefPartner(player))) {
      if (visitor.alive !== false) {
        visitor.alive = false;
        deaths.push({ name: visitor.name, role: visitor.role, cause: 'werewolf-visitor', killerRole: 'Werewolf' });
      }
    }
  }

  const privateMessages = [];
  const investigator = living.find(player => player.role === 'Militia');
  if (investigator && !isBlocked(investigator) && investigator.action && investigator.action !== 'none') {
    const target = living.find(player => player.name === investigator.action);
    if (target) privateMessages.push({ recipientId: investigator.id, type: 'investigation-result', target: target.name, alignment: alignmentFor(target.role) });
  }
  const shadow = living.find(player => player.role === 'Shadow' && !isBlocked(player));
  if (shadow && shadow.action && shadow.action !== 'none') {
    const visitors = living
      .filter(visitor => visitor.name !== shadow.name && visitor.action === shadow.action && !isBlocked(visitor))
      .filter(visitor => visitor.role !== 'MasterThief' || !thief || thief.alive === false)
      .map(visitor => visitor.name);
    privateMessages.push({ recipientId: shadow.id, type: 'shadow-result', target: shadow.action, visitors });
  }

  // A player who could not have died anyway produces no healing result.
  const protectedPlayer = protectedName ? living.find(player => player.name === protectedName) : null;
  const protectedWasKillable = Boolean(protectedPlayer) && roleDefinition(protectedPlayer.role)?.canBeKilled !== false && !redHatProtected(protectedPlayer);
  const healed = protectedWasKillable && [...victims].some(target => target === protectedName);
  if (healer && healed) privateMessages.push({ recipientId: healer.id, type: 'healing-result', success: true });
  for (const player of players) player.action = null;
  return { deaths, protected: protectedName, healed, nightNumber, privateMessages };
}

module.exports = { alignmentFor, resolveNight };
