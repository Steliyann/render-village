const choices = ['rock', 'paper', 'scissors'];

function validGamesterChoice(choice) {
  return choices.includes(choice);
}

function gamesterWins(gamesterChoice, opponentChoice) {
  return (gamesterChoice === 'rock' && opponentChoice === 'scissors')
    || (gamesterChoice === 'scissors' && opponentChoice === 'paper')
    || (gamesterChoice === 'paper' && opponentChoice === 'rock');
}

function gamesterChallengeWouldKill(players, challenge, jailedPlayerId = null) {
  if (!challenge || !validGamesterChoice(challenge.gamesterChoice) || !validGamesterChoice(challenge.opponentChoice)) return null;
  const gamester = players.find(player => player.id === challenge.gamesterId);
  const opponent = players.find(player => player.id === challenge.opponentId);
  if (!gamester || !opponent || gamester.role !== 'Gamester' || gamester.alive === false
    || opponent.alive === false || opponent.id === jailedPlayerId
    || !gamesterWins(challenge.gamesterChoice, challenge.opponentChoice)) return null;
  return true;
}

function resolveGamesterChallenge(players, challenge, jailedPlayerId = null, protectedPlayerId = null) {
  if (!gamesterChallengeWouldKill(players, challenge, jailedPlayerId)
    || challenge.opponentId === protectedPlayerId) return null;
  const gamester = players.find(player => player.id === challenge.gamesterId);
  const opponent = players.find(player => player.id === challenge.opponentId);

  opponent.alive = false;
  gamester.gamesterKills = (gamester.gamesterKills || 0) + 1;
  return { name: opponent.name, role: opponent.role, cause: 'gamester-game' };
}

module.exports = { choices, validGamesterChoice, gamesterWins, gamesterChallengeWouldKill, resolveGamesterChallenge };