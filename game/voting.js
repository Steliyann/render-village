function resolveNominationVotes(votes) {
  const counts = {};
  for (const target of votes) {
    if (target !== 'none') counts[target] = (counts[target] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((left, right) => right[1] - left[1]);
  const tied = ranked.length > 1 && ranked[0][1] === ranked[1][1];
  const nominee = !ranked.length || tied ? null : ranked[0][0];
  return { nominee, counts, noGallows: !nominee };
}

function resolveFinalVotes({ votes, nominee }) {
  const yes = votes.filter(vote => vote === 'yes').length;
  const no = votes.filter(vote => vote === 'no').length;
  return { nominee, yes, no, executed: yes > no };
}

module.exports = { resolveNominationVotes, resolveFinalVotes };
