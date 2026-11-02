const { roleDefinition } = require('./roles');

function alignmentFor(role) {
  return roleDefinition(role)?.investigationResult || 'Townsfolk / Good';
}

function resolveNight({ players, nightNumber }) {
  for (const player of players) player.silenced = false;
  const living = players.filter(player => player.alive !== false);
  const jailor = living.find(player => player.role === 'Jailor' && player.action && player.action !== 'none');
  const jailedName = jailor?.action || null;
  const blockedNames = new Set(living
    .filter(player => player.role === 'TavernKeeper' && player.name !== jailedName && player.action && player.action !== 'none' && player.action !== jailedName)
    .map(player => player.action));
  const isBlocked = player => blockedNames.has(player.name) && !(player.role === 'Werewolf' && nightNumber % 2 === 0);
  const visitsTarget = (player, targetName) => player.role === 'Judge'
    ? Array.isArray(player.judgeTargets) && player.judgeTargets.includes(targetName)
    : player.action === targetName;
  const healer = living.find(player => player.role === 'Healer' && !isBlocked(player) && player.name !== jailedName);
  const healerTarget = healer?.action && healer.action !== 'none' && healer.action !== jailedName ? living.find(player => player.name === healer.action) : null;
  const selfHealing = Boolean(healer && healerTarget && healerTarget.id === healer.id);
  const canSelfHeal = !selfHealing || healer.selfHealUsed !== true;
  const protectedName = canSelfHeal ? healerTarget?.name || null : null;
  if (selfHealing && canSelfHeal) healer.selfHealUsed = true;
  const hunter = living.find(player => player.role === 'Hunter' && !isBlocked(player) && player.name !== jailedName);
  const hunterTarget = nightNumber > 1 && hunter?.action && hunter.action !== 'none' && hunter.action !== jailedName ? hunter.action : null;
  const crossbowman = living.find(player => player.role === 'Crossbowman' && !isBlocked(player) && player.name !== jailedName);
  if (crossbowman && !Number.isInteger(crossbowman.crossbowArrowsRemaining)) crossbowman.crossbowArrowsRemaining = 2;
  const crossbowTarget = nightNumber > 1 && crossbowman?.crossbowArrowsRemaining > 0 && crossbowman.action && crossbowman.action !== 'none' && crossbowman.action !== jailedName ? crossbowman.action : null;
  if (crossbowTarget) crossbowman.crossbowArrowsRemaining -= 1;
  const thief = living.find(player => player.role === 'Thief');
  const masterThief = living.find(player => player.role === 'MasterThief');
  const thiefShaman = living.find(player => player.role === 'ThiefShaman');
  const thiefSeer = living.find(player => player.role === 'ThiefSeer');
  const seerHasThiefTeammate = Boolean(thief || masterThief || thiefShaman);
  const seerCanKill = Boolean(thiefSeer && !seerHasThiefTeammate && !isBlocked(thiefSeer) && thiefSeer.name !== jailedName);
  const shamanCanSilence = Boolean(thief || masterThief);
  const shamanCanKill = Boolean(thiefShaman && !thief && !masterThief && !isBlocked(thiefShaman) && thiefShaman.name !== jailedName);
  const thiefCanVisit = thief && !isBlocked(thief) && thief.name !== jailedName;
  // A blocked Master Thief still picks the target while a living Thief can carry out the attack.
  const masterCanVisit = masterThief && masterThief.name !== jailedName && (!isBlocked(masterThief) || Boolean(thief));
  let thievesAttacker = null;
  if (thief && masterThief && thiefCanVisit && masterCanVisit && masterThief.action && masterThief.action !== 'none') {
    thief.action = masterThief.action;
    thievesAttacker = thief;
  } else if (!thief && masterCanVisit) {
    thievesAttacker = masterThief;
  } else if (!masterThief && thiefCanVisit) {
    thievesAttacker = thief;
  }
  if (shamanCanKill && thiefShaman.action && thiefShaman.action !== 'none') thievesAttacker = thiefShaman;
  if (seerCanKill && thiefSeer.action && thiefSeer.action !== 'none') thievesAttacker = thiefSeer;
  const attackers = living.filter(player => player.role === 'Werewolf' && !isBlocked(player) && player.name !== jailedName);
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
  if (crossbowTarget) {
    victims.add(crossbowTarget);
    if (!killerByTarget.has(crossbowTarget)) killerByTarget.set(crossbowTarget, 'Crossbowman');
  }
  if (jailedName) victims.delete(jailedName);
  const hunterAlive = hunter && hunter.alive !== false;
  const redHatProtected = target => target.role === 'RedHat' && hunterAlive;
  const trapper = living.find(player => player.role === 'Trapper');
  if (trapper && !Number.isInteger(trapper.trapperTrapsRemaining)) trapper.trapperTrapsRemaining = 2;
  const trapperHasSetTrap = Boolean(trapper && trapper.alive !== false && !isBlocked(trapper)
    && trapper.name !== jailedName && trapper.trapperTrapsRemaining > 0 && trapper.action === trapper.name);
  const deaths = [];

  const guard = living.find(player => player.role === 'Guard' && !isBlocked(player) && player.name !== jailedName);
  const guardTarget = guard?.action && guard.action !== 'none' ? guard.action : null;
  const guardedPlayer = guardTarget ? living.find(player => player.name === guardTarget) : null;
  const guardCanIntercept = Boolean(guard && guardedPlayer && victims.has(guardTarget)
    && guardTarget !== protectedName && !(trapperHasSetTrap && guardTarget === trapper.name)
    && !redHatProtected(guardedPlayer) && guardedPlayer.role !== 'Werewolf');
  const guardedKillerRole = guardCanIntercept ? killerByTarget.get(guardTarget) : null;
  const guardedKiller = guardedKillerRole ? living.find(player => player.role === guardedKillerRole) : null;
  if (guardCanIntercept && guardedKiller) {
    guard.alive = false;
    guardedKiller.alive = false;
    deaths.push({ name: guard.name, role: guard.role, cause: 'guard-sacrifice', killerRole: guardedKiller.role });
    deaths.push({ name: guardedKiller.name, role: guardedKiller.role, cause: 'guard-intercept', killerRole: 'Guard' });
  }

  for (const targetName of victims) {
    const target = living.find(player => player.name === targetName);
    if (!target || target.alive === false || targetName === guardTarget && guardCanIntercept || target.name === protectedName
      || trapperHasSetTrap && target === trapper || redHatProtected(target) || target.role === 'Werewolf') continue;
    target.alive = false;
    deaths.push({ name: target.name, role: target.role, killerRole: killerByTarget.get(target.name) || null });
  }

  if (hunterTarget) {
    const target = living.find(player => player.name === hunterTarget);
    if (target?.role && !['MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer', 'Werewolf'].includes(target.role) && hunter.alive !== false) {
      hunter.alive = false;
      deaths.push({ name: hunter.name, role: hunter.role, cause: 'hunter-suicide' });
    }
  }

  const werewolf = living.find(player => player.role === 'Werewolf' && player.alive !== false && player.name !== jailedName);
  if (werewolf && nightNumber % 2 === 0) {
    // Only the thief who actually carries out the visit dies; the partner stays home.
    const isIdleThiefPartner = player => ['MasterThief', 'Thief'].includes(player.role) && player !== thievesAttacker;
    for (const visitor of living.filter(player => player.name !== werewolf.name && player.name !== jailedName && visitsTarget(player, werewolf.name) && !isBlocked(player) && !isIdleThiefPartner(player))) {
      if (visitor.alive !== false) {
        visitor.alive = false;
        deaths.push({ name: visitor.name, role: visitor.role, cause: 'werewolf-visitor', killerRole: 'Werewolf' });
      }
    }
  }

  if (trapperHasSetTrap) {
    trapper.trapperTrapsRemaining -= 1;
    const thief = living.find(player => player.role === 'Thief' && player.alive !== false);
    const visitors = living.filter(player => player !== trapper && player.alive !== false
      && player.name !== jailedName && visitsTarget(player, trapper.name) && !isBlocked(player)
      && !(player.role === 'MasterThief' && thief));
    for (const visitor of visitors) {
      visitor.alive = false;
      deaths.push({ name: visitor.name, role: visitor.role, cause: 'trapper-trap', killerRole: 'Trapper' });
    }
  }

  const privateMessages = [];
  if (thiefSeer && seerHasThiefTeammate && !isBlocked(thiefSeer) && thiefSeer.name !== jailedName
    && thiefSeer.action && thiefSeer.action !== 'none') {
    const target = living.find(player => player.name === thiefSeer.action);
    if (target) {
      const team = living.filter(player => ['MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer'].includes(player.role));
      for (const teammate of team) {
        privateMessages.push({ recipientId: teammate.id, type: 'thief-seer-result', target: target.name, role: target.role });
      }
    }
  }
  if (thiefShaman && shamanCanSilence && !isBlocked(thiefShaman) && thiefShaman.name !== jailedName
    && thiefShaman.action && thiefShaman.action !== 'none') {
    const silencedPlayer = living.find(player => player.name === thiefShaman.action && player.id !== thiefShaman.id && player.alive !== false);
    if (silencedPlayer) {
      silencedPlayer.silenced = true;
      privateMessages.push({ recipientId: silencedPlayer.id, type: 'shaman-silence' });
    }
  }
  const investigator = living.find(player => player.role === 'Militia');
  if (investigator && !isBlocked(investigator) && investigator.name !== jailedName && investigator.action && investigator.action !== 'none' && investigator.action !== jailedName) {
    const target = living.find(player => player.name === investigator.action);
    if (target) privateMessages.push({ recipientId: investigator.id, type: 'investigation-result', target: target.name, alignment: alignmentFor(target.role) });
  }
  const judge = living.find(player => player.role === 'Judge' && !isBlocked(player) && player.name !== jailedName);
  if (judge && Array.isArray(judge.judgeTargets) && judge.judgeTargets.length === 2 && !judge.judgeTargets.includes(jailedName)) {
    const [firstName, secondName] = judge.judgeTargets;
    const first = living.find(player => player.name === firstName);
    const second = living.find(player => player.name === secondName);
    if (first && second) {
      const firstTeam = roleDefinition(first.role)?.team;
      const secondTeam = roleDefinition(second.role)?.team;
      const teammates = firstTeam === secondTeam && firstTeam !== 'Independent Evil';
      privateMessages.push({ recipientId: judge.id, type: 'judge-result', teammates, players: [first.name, second.name] });
    }
  }
  for (const role of ['Shadow', 'Watcher']) {
    const observer = living.find(player => player.role === role && !isBlocked(player));
    if (!observer || observer.name === jailedName || !observer.action || observer.action === 'none' || observer.action === jailedName) continue;
    const visitors = living
      .filter(visitor => visitor.name !== observer.name && visitsTarget(visitor, observer.action) && !isBlocked(visitor))
      .filter(visitor => visitor.role !== 'MasterThief' || !thief || thief.alive === false)
      .map(visitor => visitor.name);
    privateMessages.push({ recipientId: observer.id, type: role === 'Watcher' ? 'watcher-result' : 'shadow-result', target: observer.action, visitors });
  }

  // A player who could not have died anyway produces no healing result.
  const protectedPlayer = protectedName ? living.find(player => player.name === protectedName) : null;
  const protectedWasKillable = Boolean(protectedPlayer) && roleDefinition(protectedPlayer.role)?.canBeKilled !== false && !redHatProtected(protectedPlayer);
  const healed = protectedWasKillable && [...victims].some(target => target === protectedName);
  if (healer && healed) privateMessages.push({ recipientId: healer.id, type: 'healing-result', success: true });
  for (const player of players) {
    player.action = null;
    player.judgeTargets = null;
  }
  return { deaths, protected: protectedName, healed, nightNumber, privateMessages };
}

module.exports = { alignmentFor, resolveNight };
