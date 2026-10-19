const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveNominationVotes, resolveFinalVotes } = require('./voting');

test('resolves a unique nomination plurality', () => {
  assert.deepEqual(resolveNominationVotes(['A', 'A', 'B', 'none']), {
    nominee: 'A',
    counts: { A: 2, B: 1 },
    noGallows: false
  });
});

test('turns a nomination tie into no gallows', () => {
  assert.deepEqual(resolveNominationVotes(['A', 'B', 'none', 'none']), {
    nominee: null,
    counts: { A: 1, B: 1 },
    noGallows: true
  });
});

test('turns all abstentions into no gallows', () => {
  assert.deepEqual(resolveNominationVotes(['none', 'none']), {
    nominee: null,
    counts: {},
    noGallows: true
  });
});

test('executes only when YES votes exceed NO votes', () => {
  assert.deepEqual(resolveFinalVotes({ votes: ['yes', 'yes', 'no'], nominee: 'A' }), {
    nominee: 'A',
    yes: 2,
    no: 1,
    executed: true
  });
});

test('saves on a final-vote tie', () => {
  assert.deepEqual(resolveFinalVotes({ votes: ['yes', 'no'], nominee: 'A' }), {
    nominee: 'A',
    yes: 1,
    no: 1,
    executed: false
  });

test('saves when the final vote has no YES votes', () => {
  assert.equal(resolveFinalVotes({ votes: ['no', 'no'], nominee: 'A' }).executed, false);
});
});
