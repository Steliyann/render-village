function evaluateVictory(players, event = {}) {
  if (event.type === 'execution' && event.role === 'Jester') return 'Jester';

  if (players.some(player => player.role === 'Gamester' && (player.gamesterKills || 0) >= 2)) return 'Gamester';

  const living = players.filter(player => player.alive !== false);
  if (living.length === 0) return 'Draw';

  const thieves = living.filter(player => ['MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer'].includes(player.role));
  const werewolves = living.filter(player => player.role === 'Werewolf');
  const gamesters = living.filter(player => player.role === 'Gamester');
  const townsfolk = living.filter(player => !['MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer', 'Werewolf', 'Jester', 'Gamester'].includes(player.role));

  if (werewolves.length > 0 && townsfolk.length === 0 && thieves.length === 0) return 'Werewolf';
  if (thieves.length > 0 && townsfolk.length === 0 && werewolves.length === 0) return 'Thieves';
  if (thieves.length >= living.length - thieves.length) return 'Thieves';
  if (werewolves.length === 0 && thieves.length === 0 && gamesters.length === 0) return 'Townsfolk';

  return null;
}

module.exports = { evaluateVictory };
