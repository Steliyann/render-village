function isAlive(player) {
  return Boolean(player && player.alive !== false);
}

function canStartGame({ player, hostId, phase, identifiedCount, minimumPlayers }) {
  return phase === 'lobby' && player?.id === hostId && identifiedCount >= minimumPlayers;
}

function canUseNightAction({ player, activeTurn, phase }) {
  return phase === 'night' && isAlive(player) && activeTurn?.id === player.id && activeTurn.blocked !== true && activeTurn.informational !== true;
}

function canSkipNightAction({ player, activeTurn, phase }) {
  return phase === 'night' && isAlive(player) && activeTurn?.id === player.id && (activeTurn.blocked === true || activeTurn.informational === true);
}

function canSubmitVote({ player, phase, nominee }) {
  return isAlive(player) && (phase === 'vote' || (phase === 'final' && player.name !== nominee));
}

function canSubmitDefense({ player, nominee, phase }) {
  return phase === 'defense' && isAlive(player) && player.name === nominee;
}

function canAdvancePhase({ player, phase }) {
  return isAlive(player) && ['day', 'defense'].includes(phase);
}

function canChat({ player, phase }) {
  if (phase === 'lobby') return Boolean(player);
  return isAlive(player) && !['night', 'night-resolution', 'night-results', 'preparation'].includes(phase);
}

module.exports = { isAlive, canStartGame, canUseNightAction, canSkipNightAction, canSubmitVote, canSubmitDefense, canAdvancePhase, canChat };
