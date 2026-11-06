const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveNight } = require('./nightResolver');

function player(name, role, action = 'none') {
  return { id: name, name, role, action, alive: true };
}

test('Tavern Keeper blocks Militia investigation', () => {
  const players = [
    player('Keeper', 'TavernKeeper', 'Militia'),
    player('Militia', 'Militia', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.deepEqual(result.privateMessages, []);
});

test('Jailor prevents a Thief kill against the jailed player', () => {
  const players = [
    player('Jailor', 'Jailor', 'Target'),
    player('Thief', 'Thief', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, true);
  assert.equal(players.find(current => current.name === 'Thief').alive, true);
  assert.deepEqual(result.deaths, []);
});

test('Jailed players cannot use their night ability or be investigated', () => {
  const players = [
    player('Jailor', 'Jailor', 'Wolf'),
    player('Wolf', 'Werewolf', 'Target'),
    player('Militia', 'Militia', 'Wolf'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Target').alive, true);
  assert.equal(result.privateMessages.some(message => message.type === 'investigation-result'), false);
  assert.deepEqual(result.deaths, []);
});

test('Judge recognizes players on the same Townsfolk team as teammates', () => {
  const players = [
    player('Judge', 'Judge'),
    player('Healer', 'Healer'),
    player('Militia', 'Militia')
  ];
  players[0].judgeTargets = ['Healer', 'Militia'];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.deepEqual(result.privateMessages.find(message => message.type === 'judge-result'), {
    recipientId: 'Judge', type: 'judge-result', teammates: true, players: ['Healer', 'Militia']
  });
});

test('Judge passing produces no comparison result', () => {
  const players = [player('Judge', 'Judge'), player('Target', 'Villager')];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(result.privateMessages.some(message => message.type === 'judge-result'), false);
});

test('Judge recognizes members of the Thieves team as teammates', () => {
  const judge = player('Judge', 'Judge');
  judge.judgeTargets = ['Master', 'Thief'];
  const result = resolveNight({ players: [judge, player('Master', 'MasterThief'), player('Thief', 'Thief')], nightNumber: 1 });
  assert.equal(result.privateMessages.find(message => message.type === 'judge-result').teammates, true);
});

test('Judge reports different teams and all Independent Evil pairs as rivals', () => {
  const cases = [
    [['Villager', 'Thief'], false],
    [['Thief', 'Werewolf'], false],
    [['Werewolf', 'Jester'], false]
  ];
  for (const [[firstRole, secondRole], expected] of cases) {
    const judge = player('Judge', 'Judge');
    judge.judgeTargets = ['First', 'Second'];
    const result = resolveNight({ players: [judge, player('First', firstRole), player('Second', secondRole)], nightNumber: 1 });
    assert.equal(result.privateMessages.find(message => message.type === 'judge-result').teammates, expected);
  }
});

test('Healer protection prevents a Thief attack', () => {
  const players = [
    player('Thief', 'Thief', 'Target'),
    player('Healer', 'Healer', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.deepEqual(result.deaths, []);
  assert.equal(result.protected, 'Target');
});

test('Guard saves the target and dies with the Thief attacking them', () => {
  const players = [
    player('Guard', 'Guard', 'Target'),
    player('Thief', 'Thief', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, true);
  assert.equal(players.find(current => current.name === 'Guard').alive, false);
  assert.equal(players.find(current => current.name === 'Thief').alive, false);
  assert.deepEqual(result.deaths.map(death => [death.name, death.killerRole]), [
    ['Guard', 'Thief'],
    ['Thief', 'Guard']
  ]);
});

test('Guard can intercept Hunter and Crossbowman kills', () => {
  for (const [killerRole, nightNumber] of [['Hunter', 2], ['Crossbowman', 2]]) {
    const killer = player(killerRole, killerRole, 'Target');
    const players = [player('Guard', 'Guard', 'Target'), killer, player('Target', 'Villager')];
    const result = resolveNight({ players, nightNumber });
    assert.equal(players.find(current => current.name === 'Target').alive, true);
    assert.equal(players.find(current => current.name === 'Guard').alive, false);
    assert.equal(killer.alive, false);
    assert.ok(result.deaths.some(death => death.name === 'Guard' && death.killerRole === killerRole));
    assert.ok(result.deaths.some(death => death.name === killerRole && death.killerRole === 'Guard'));
  }
});

test('A blocked Guard cannot protect its selected target', () => {
  const players = [
    player('Keeper', 'TavernKeeper', 'Guard'),
    player('Guard', 'Guard', 'Target'),
    player('Thief', 'Thief', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, false);
  assert.equal(players.find(current => current.name === 'Guard').alive, true);
  assert.equal(result.deaths.some(death => death.name === 'Thief' && death.killerRole === 'Guard'), false);
});

test('Hunter cannot shoot on the first Night', () => {
  const players = [player('Hunter', 'Hunter', 'Target'), player('Target', 'Villager')];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Hunter').alive, true);
  assert.deepEqual(result.deaths, []);
});

test('Hunter shoots on later Nights and suicides against Townsfolk', () => {
  const players = [player('Hunter', 'Hunter', 'Target'), player('Target', 'Villager')];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Target').alive, false);
  assert.equal(players.find(current => current.name === 'Hunter').alive, false);
  assert.equal(result.deaths.some(death => death.cause === 'hunter-suicide'), true);
});

test('Crossbowman cannot shoot on the first night', () => {
  const crossbowman = player('Crossbowman', 'Crossbowman', 'Target');
  crossbowman.crossbowArrowsRemaining = 2;
  const players = [crossbowman, player('Target', 'Villager')];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, true);
  assert.equal(crossbowman.crossbowArrowsRemaining, 2);
  assert.deepEqual(result.deaths, []);
});

test('Crossbowman can fire only two arrows over multiple nights', () => {
  const crossbowman = player('Crossbowman', 'Crossbowman', 'Target 1');
  crossbowman.crossbowArrowsRemaining = 2;
  const firstTarget = player('Target 1', 'Villager');
  const secondTarget = player('Target 2', 'Villager');
  const thirdTarget = player('Target 3', 'Villager');
  const players = [crossbowman, firstTarget, secondTarget, thirdTarget];

  const firstShot = resolveNight({ players, nightNumber: 2 });
  assert.equal(firstTarget.alive, false);
  assert.equal(firstShot.deaths[0].killerRole, 'Crossbowman');
  assert.equal(crossbowman.crossbowArrowsRemaining, 1);

  crossbowman.action = 'Target 2';
  const secondShot = resolveNight({ players, nightNumber: 3 });
  assert.equal(secondTarget.alive, false);
  assert.equal(secondShot.deaths[0].killerRole, 'Crossbowman');
  assert.equal(crossbowman.crossbowArrowsRemaining, 0);

  crossbowman.action = 'Target 3';
  const exhausted = resolveNight({ players, nightNumber: 4 });
  assert.equal(thirdTarget.alive, true);
  assert.deepEqual(exhausted.deaths, []);
  assert.equal(crossbowman.crossbowArrowsRemaining, 0);
});

test('A blocked Crossbowman does not spend an arrow', () => {
  const crossbowman = player('Crossbowman', 'Crossbowman', 'Target');
  crossbowman.crossbowArrowsRemaining = 2;
  const players = [player('Keeper', 'TavernKeeper', 'Crossbowman'), crossbowman, player('Target', 'Villager')];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Target').alive, true);
  assert.equal(crossbowman.crossbowArrowsRemaining, 2);
  assert.deepEqual(result.deaths, []);
});

test('RedHat is protected while Hunter is alive', () => {
  const players = [
    player('Thief', 'Thief', 'Red'),
    player('Hunter', 'Hunter'),
    player('Red', 'RedHat')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Red').alive, true);
  assert.deepEqual(result.deaths, []);
});

test('Healer self-protection is available once per game', () => {
  const healer = player('Healer', 'Healer', 'Healer');
  const players = [player('Thief', 'Thief', 'Healer'), healer];
  const firstNight = resolveNight({ players, nightNumber: 1 });
  assert.deepEqual(firstNight.deaths, []);
  assert.equal(healer.selfHealUsed, true);

  healer.action = 'Healer';
  players[0].action = 'Healer';
  const secondNight = resolveNight({ players, nightNumber: 2 });
  assert.equal(secondNight.deaths.some(death => death.name === 'Healer'), true);
});

test('Tavern Keeper cannot block the Werewolf on a Full Moon', () => {
  const players = [
    player('Keeper', 'TavernKeeper', 'Wolf'),
    player('Wolf', 'Werewolf', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Target').alive, false);
  assert.deepEqual(result.deaths.map(death => death.name), ['Target', 'Keeper']);
});

test('Werewolf cannot be killed during any night', () => {
  const players = [player('Thief', 'Thief', 'Wolf'), player('Wolf', 'Werewolf')];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Wolf').alive, true);
  assert.deepEqual(result.deaths.map(death => death.name), ['Thief']);
});

test('Independent Evil targets cannot be killed at night by the Thieves or Werewolf', () => {
  for (const targetRole of ['Jester', 'Gamester']) {
    const thiefTarget = player('Target', targetRole);
    const thiefResult = resolveNight({ players: [player('Thief', 'Thief', 'Target'), thiefTarget], nightNumber: 1 });
    assert.equal(thiefTarget.alive, true, `Thief cannot kill ${targetRole}`);
    assert.deepEqual(thiefResult.deaths, []);

    const visitor = player('Target', targetRole, 'Wolf');
    const wolfResult = resolveNight({ players: [player('Wolf', 'Werewolf'), visitor], nightNumber: 2 });
    assert.equal(visitor.alive, true, `Werewolf cannot kill visiting ${targetRole}`);
    assert.deepEqual(wolfResult.deaths, []);
  }
});

test('Townsfolk night attacks can kill Independent Evil roles', () => {
  for (const targetRole of ['Jester', 'Gamester']) {
    const target = player('Target', targetRole);
    const crossbowman = player('Crossbowman', 'Crossbowman', 'Target');
    crossbowman.crossbowArrowsRemaining = 2;
    const result = resolveNight({ players: [crossbowman, target], nightNumber: 2 });
    assert.equal(target.alive, false, `Crossbowman can kill ${targetRole}`);
    assert.ok(result.deaths.some(death => death.name === 'Target' && death.killerRole === 'Crossbowman'));
  }
});

test('Judge is killed by the Werewolf when selecting it during a Full Moon', () => {
  const judge = player('Judge', 'Judge');
  judge.action = 'judge';
  judge.judgeTargets = ['Wolf', 'Other'];
  const players = [judge, player('Wolf', 'Werewolf'), player('Other', 'Villager')];
  const result = resolveNight({ players, nightNumber: 2 });

  assert.equal(judge.alive, false);
  assert.deepEqual(result.deaths.map(death => [death.name, death.cause, death.killerRole]), [
    ['Judge', 'werewolf-visitor', 'Werewolf']
  ]);
});

test('Gamester challenge target is not treated as a physical visit', () => {
  const players = [
    player('Gamester', 'Gamester', 'Wolf'),
    player('Wolf', 'Werewolf'),
    player('Trapper', 'Trapper', 'Trapper')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.deepEqual(result.deaths, []);
});

test('Master Thief takes over visiting after the Thief is gone', () => {
  const players = [
    player('Master', 'MasterThief', 'Target'),
    player('Shadow', 'Shadow', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, false);
  assert.deepEqual(result.privateMessages.find(message => message.type === 'shadow-result').visitors, ['Master']);
});

test('Watcher privately learns where the selected player went', () => {
  const judge = player('Judge', 'Judge');
  judge.action = 'judge';
  judge.judgeTargets = ['Target', 'Other'];
  const players = [
    player('Watcher', 'Watcher', 'Judge'),
    player('Visitor', 'Healer', 'Target'),
    judge,
    player('Target', 'Villager'),
    player('Other', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.deepEqual(result.privateMessages.find(message => message.type === 'watcher-result'), {
    recipientId: 'Watcher',
    type: 'watcher-result',
    target: 'Judge',
    destinations: ['Target', 'Other']
  });
});

test('Watcher learns when the selected player did not visit anyone', () => {
  const watcher = player('Watcher', 'Watcher', 'Idle');
  const result = resolveNight({ players: [watcher, player('Idle', 'Villager')], nightNumber: 1 });
  assert.deepEqual(result.privateMessages.find(message => message.type === 'watcher-result'), {
    recipientId: 'Watcher', type: 'watcher-result', target: 'Idle', destinations: []
  });
});

test('Blocked Master Thief still picks the target while the Thief is alive', () => {
  const players = [
    player('Keeper', 'TavernKeeper', 'Master'),
    player('Master', 'MasterThief', 'Target'),
    player('Thief', 'Thief'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, false);
  assert.deepEqual(result.deaths.map(death => death.killerRole), ['Thief']);
});

test('Blocked Master Thief cannot attack alone', () => {
  const players = [
    player('Keeper', 'TavernKeeper', 'Master'),
    player('Master', 'MasterThief', 'Target'),
    player('Target', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(players.find(current => current.name === 'Target').alive, true);
  assert.deepEqual(result.deaths, []);
});

test('Full moon kills visitors even when the Werewolf does not attack', () => {
  const players = [
    player('Wolf', 'Werewolf'),
    player('Healer', 'Healer', 'Wolf'),
    player('Villager', 'Villager')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Healer').alive, false);
  assert.deepEqual(result.deaths.map(death => death.name), ['Healer']);
});

test('Only the visiting thief dies at the Werewolf on a Full Moon', () => {
  const players = [
    player('Master', 'MasterThief', 'Wolf'),
    player('Thief', 'Thief'),
    player('Wolf', 'Werewolf', 'Master')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Thief').alive, false);
  assert.equal(players.find(current => current.name === 'Master').alive, false);
  assert.deepEqual(result.deaths.map(death => death.name).sort(), ['Master', 'Thief']);
});

test('Master Thief visits the Werewolf alone once the Thief is dead', () => {
  const players = [
    player('Master', 'MasterThief', 'Wolf'),
    player('Wolf', 'Werewolf')
  ];
  const result = resolveNight({ players, nightNumber: 2 });
  assert.equal(players.find(current => current.name === 'Master').alive, false);
  assert.deepEqual(result.deaths.map(death => death.name), ['Master']);
});

test('Healing a night-immune target reports no healing', () => {
  const players = [
    player('Thief', 'Thief', 'Red'),
    player('Healer', 'Healer', 'Red'),
    player('Hunter', 'Hunter'),
    player('Red', 'RedHat')
  ];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(result.healed, false);
  assert.equal(result.privateMessages.some(message => message.type === 'healing-result'), false);
});

test('healing result is private while public result stays anonymous', () => {
  const players = [player('Thief', 'Thief', 'Target'), player('Healer', 'Healer', 'Target'), player('Target', 'Villager')];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(result.healed, true);
  assert.deepEqual(result.privateMessages.find(message => message.type === 'healing-result'), { recipientId: 'Healer', type: 'healing-result', success: true });
  assert.equal(result.protected, 'Target');
});

test('Trapper kills every unblocked visitor and spends one trap', () => {
  const trapper = player('Trapper', 'Trapper', 'Trapper');
  const visitor = player('Visitor', 'Healer', 'Trapper');
  const otherVisitor = player('Other visitor', 'Militia', 'Trapper');
  const players = [trapper, visitor, otherVisitor, player('Home', 'Villager')];
  const result = resolveNight({ players, nightNumber: 1 });

  assert.equal(trapper.alive, true);
  assert.equal(visitor.alive, false);
  assert.equal(otherVisitor.alive, false);
  assert.equal(trapper.trapperTrapsRemaining, 1);
  assert.deepEqual(result.deaths.map(death => [death.name, death.killerRole]), [
    ['Visitor', 'Trapper'], ['Other visitor', 'Trapper']
  ]);
});

test('A set trap saves the Trapper from a killing visitor', () => {
  const trapper = player('Trapper', 'Trapper', 'Trapper');
  const thief = player('Thief', 'Thief', 'Trapper');
  const players = [trapper, thief];
  const result = resolveNight({ players, nightNumber: 1 });

  assert.equal(trapper.alive, true);
  assert.equal(thief.alive, false);
  assert.deepEqual(result.deaths.map(death => [death.name, death.cause, death.killerRole]), [
    ['Thief', 'trapper-trap', 'Trapper']
  ]);
  assert.equal(trapper.trapperTrapsRemaining, 1);
});

test('A set trap kills the Judge when the Judge selects the Trapper', () => {
  const trapper = player('Trapper', 'Trapper', 'Trapper');
  const judge = player('Judge', 'Judge');
  judge.action = 'judge';
  judge.judgeTargets = ['Trapper', 'Other'];
  const result = resolveNight({ players: [trapper, judge, player('Other', 'Villager')], nightNumber: 1 });

  assert.equal(judge.alive, false);
  assert.deepEqual(result.deaths.map(death => [death.name, death.cause, death.killerRole]), [
    ['Judge', 'trapper-trap', 'Trapper']
  ]);
});

test('Trapper may pass without spending a trap and cannot use more than two traps', () => {
  const trapper = player('Trapper', 'Trapper');
  trapper.trapperTrapsRemaining = 2;
  resolveNight({ players: [trapper, player('Visitor', 'Healer', 'Trapper')], nightNumber: 1 });
  assert.equal(trapper.trapperTrapsRemaining, 2);

  for (let nightNumber = 2; nightNumber <= 3; nightNumber += 1) {
    trapper.action = 'Trapper';
    const visitor = player(`Visitor ${nightNumber}`, 'Healer', 'Trapper');
    resolveNight({ players: [trapper, visitor], nightNumber });
    assert.equal(visitor.alive, false);
  }
  trapper.action = 'Trapper';
  const finalVisitor = player('Final visitor', 'Militia', 'Trapper');
  const exhausted = resolveNight({ players: [trapper, finalVisitor], nightNumber: 4 });
  assert.equal(finalVisitor.alive, true);
  assert.equal(trapper.trapperTrapsRemaining, 0);
  assert.deepEqual(exhausted.deaths, []);
});

test('A blocked Trapper neither sets nor spends a trap', () => {
  const trapper = player('Trapper', 'Trapper', 'Trapper');
  const visitor = player('Visitor', 'Healer', 'Trapper');
  const players = [player('Keeper', 'TavernKeeper', 'Trapper'), trapper, visitor];
  const result = resolveNight({ players, nightNumber: 1 });
  assert.equal(visitor.alive, true);
  assert.equal(trapper.trapperTrapsRemaining, 2);
  assert.deepEqual(result.deaths, []);
});

for (const [killerRole, targetRole] of [
  ['MasterThief', 'Thief'], ['MasterThief', 'ThiefShaman'], ['MasterThief', 'ThiefSeer'],
  ['Thief', 'ThiefShaman'], ['Thief', 'ThiefSeer'], ['ThiefShaman', 'ThiefSeer'],
  ['ThiefSeer', 'ThiefSeer']
]) {
  test(`${killerRole} cannot kill ${targetRole} even with a preloaded teammate target`, () => {
    const attacker = player('Attacker', killerRole, 'Teammate');
    const teammate = killerRole === targetRole ? attacker : player('Teammate', targetRole);
    if (teammate === attacker) attacker.action = attacker.name;
    const players = teammate === attacker ? [attacker] : [attacker, teammate];
    const result = resolveNight({ players: [...players, player('Villager', 'Villager')], nightNumber: 1 });
    assert.equal(teammate.alive, true);
    assert.deepEqual(result.deaths, []);
  });
}

for (const role of ['MasterThief', 'Thief', 'ThiefShaman', 'ThiefSeer']) {
  test(`Thief Seer cannot check a ${role} teammate's role`, () => {
    const seer = player('Seer', 'ThiefSeer', role === 'ThiefSeer' ? 'Seer' : 'Teammate');
    const teammate = role === 'ThiefSeer' ? player('Master', 'MasterThief') : player('Teammate', role);
    const result = resolveNight({ players: [seer, teammate, player('Villager', 'Villager')], nightNumber: 1 });
    assert.equal(result.privateMessages.some(message => message.type === 'thief-seer-result'), false);
  });
}

for (const role of ['MasterThief', 'Thief', 'ThiefSeer']) {
  test(`Thief Shaman can still silence a ${role} teammate`, () => {
    const teammate = player('Teammate', role);
    const players = [player('Shaman', 'ThiefShaman', 'Teammate'), teammate, player('Villager', 'Villager')];
    if (role === 'ThiefSeer') players.push(player('Master', 'MasterThief'));
    const result = resolveNight({ players, nightNumber: 1 });
    assert.equal(teammate.silenced, true);
    assert.equal(teammate.alive, true);
    assert.deepEqual(result.privateMessages, [{ recipientId: 'Teammate', type: 'shaman-silence' }]);
  });
}

test('Thief Shaman silences one player and does not kill while another Thief lives', () => {
  const master = player('Master', 'MasterThief', 'Target');
  const thief = player('Thief', 'Thief');
  const shaman = player('Shaman', 'ThiefShaman', 'Silenced');
  const silenced = player('Silenced', 'Villager');
  const target = player('Target', 'Villager');
  const result = resolveNight({ players: [master, thief, shaman, silenced, target], nightNumber: 1 });

  assert.equal(silenced.silenced, true);
  assert.equal(target.alive, false);
  assert.equal(silenced.alive, true);
  assert.deepEqual(result.privateMessages, [{ recipientId: 'Silenced', type: 'shaman-silence' }]);
});

test('Thief Shaman attacks when both other Thieves are dead', () => {
  const master = player('Master', 'MasterThief');
  const thief = player('Thief', 'Thief');
  master.alive = false;
  thief.alive = false;
  const shaman = player('Shaman', 'ThiefShaman', 'Target');
  const target = player('Target', 'Villager');
  const result = resolveNight({ players: [master, thief, shaman, target], nightNumber: 1 });

  assert.equal(target.alive, false);
  assert.deepEqual(result.deaths.map(death => [death.name, death.killerRole]), [['Target', 'ThiefShaman']]);
  assert.deepEqual(result.privateMessages, []);
});

test('Blocked Thief Shaman does not silence or attack', () => {
  const keeper = player('Keeper', 'TavernKeeper', 'Shaman');
  const shaman = player('Shaman', 'ThiefShaman', 'Target');
  const target = player('Target', 'Villager');
  const thief = player('Thief', 'Thief');
  const result = resolveNight({ players: [keeper, shaman, target, thief], nightNumber: 1 });
  assert.equal(target.alive, true);
  assert.equal(target.silenced, false);
  assert.deepEqual(result.privateMessages, []);
});

test('Thief Seer privately shares the selected role with the living Thieves team', () => {
  const master = player('Master', 'MasterThief', 'Target');
  const thief = player('Thief', 'Thief');
  const shaman = player('Shaman', 'ThiefShaman');
  const seer = player('Seer', 'ThiefSeer', 'Target');
  const target = player('Target', 'Guard');
  const players = [master, thief, shaman, seer, target];
  const result = resolveNight({ players, nightNumber: 1 });

  assert.deepEqual(result.privateMessages.filter(message => message.type === 'thief-seer-result'), [
    { recipientId: 'Master', type: 'thief-seer-result', target: 'Target', role: 'Guard' },
    { recipientId: 'Thief', type: 'thief-seer-result', target: 'Target', role: 'Guard' },
    { recipientId: 'Shaman', type: 'thief-seer-result', target: 'Target', role: 'Guard' },
    { recipientId: 'Seer', type: 'thief-seer-result', target: 'Target', role: 'Guard' }
  ]);
  assert.equal(target.alive, false);
});

test('Thief Seer becomes the killer after the other Thieves are dead', () => {
  const master = player('Master', 'MasterThief');
  const thief = player('Thief', 'Thief');
  const shaman = player('Shaman', 'ThiefShaman');
  master.alive = false;
  thief.alive = false;
  shaman.alive = false;
  const seer = player('Seer', 'ThiefSeer', 'Target');
  const target = player('Target', 'Villager');
  const result = resolveNight({ players: [master, thief, shaman, seer, target], nightNumber: 1 });

  assert.equal(target.alive, false);
  assert.deepEqual(result.deaths.map(death => [death.name, death.killerRole]), [['Target', 'ThiefSeer']]);
  assert.equal(result.privateMessages.some(message => message.type === 'thief-seer-result'), false);
});

test('A blocked Thief Seer neither shares vision nor performs a fallback kill', () => {
  const keeper = player('Keeper', 'TavernKeeper', 'Seer');
  const master = player('Master', 'MasterThief');
  const thief = player('Thief', 'Thief');
  const seer = player('Seer', 'ThiefSeer', 'Target');
  const target = player('Target', 'Villager');
  const result = resolveNight({ players: [keeper, master, thief, seer, target], nightNumber: 1 });

  assert.equal(target.alive, true);
  assert.deepEqual(result.privateMessages, []);
});
