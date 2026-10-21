const test = require('node:test');
const assert = require('node:assert/strict');
const batch = () => import('../../frontend/src/utils/renewalLetterBatch.js');
const saved = (id, date = '2026-10-24') => ({ renewalId: id, previousContractEnd: date, renewalLetterUrl: `/letters/${id}.pdf` });

test('monthly update covers every saved letter once, including Won, and leaves other months untouched', async () => {
  const { updateMonthlyRenewalLetters } = await batch();
  const rows = [saved('A'), saved('B'), saved('A'), saved('NOV', '2026-11-01'), { renewalId: 'NO-PDF', previousContractEnd: '2026-10-12' }, { ...saved('WON'), renewalOutcome: 'WON' }];
  const snapshot = JSON.stringify(rows);
  const calls = [], progress = [];
  let active = 0;
  const result = await updateMonthlyRenewalLetters({ rows, month: '10', year: '2026',
    regenerate: async (id, body) => { active += 1; assert.equal(active, 1); calls.push([id, body]); await Promise.resolve(); active -= 1; },
    onProgress: (value) => progress.push(value.completed)
  });
  assert.deepEqual(calls.map(([id]) => id), ['A', 'B', 'WON']);
  assert(calls.every(([, body]) => body.letterMonth === 10 && body.letterYear === 2026));
  assert.equal(result.updated, 3);
  assert.deepEqual(progress, [0, 1, 2, 3]);
  assert.equal(JSON.stringify(rows), snapshot);
});

test('a rejected record is reported while other letters can still update', async () => {
  const { updateMonthlyRenewalLetters } = await batch();
  const calls = [];
  const result = await updateMonthlyRenewalLetters({ rows: [saved('A'), saved('B')], month: 10, year: 2026,
    regenerate: async (id) => { calls.push(id); if (id === 'A') throw { response: { status: 400, data: { error: 'Missing contract dates' } } }; }
  });
  assert.deepEqual(calls, ['A', 'B']);
  assert.equal(result.updated, 1);
  assert.equal(result.failures[0].error, 'Missing contract dates');
  assert.equal(result.stopped, false);
});

test('uncertain network results and access errors stop the batch without retries', async () => {
  const { updateMonthlyRenewalLetters } = await batch();
  for (const error of [new Error('Connection interrupted'), { response: { status: 403, data: { error: 'Access denied' } } }]) {
    const calls = [];
    const result = await updateMonthlyRenewalLetters({ rows: [saved('A'), saved('B')], month: 10, year: 2026,
      regenerate: async (id) => { calls.push(id); throw error; }
    });
    assert.deepEqual(calls, ['A']);
    assert.equal(result.stopped, true);
    assert.equal(result.updated, 0);
  }
});

test('missing month cannot trigger generation and an empty month is harmless', async () => {
  const { updateMonthlyRenewalLetters } = await batch();
  const regenerate = () => assert.fail('No generation expected');
  await assert.rejects(updateMonthlyRenewalLetters({ rows: [saved('A')], month: 'all', year: 2026, regenerate }), /specific dashboard month/);
  const result = await updateMonthlyRenewalLetters({ rows: [saved('A')], month: 11, year: 2026, regenerate });
  assert.equal(result.total, 0);
});
