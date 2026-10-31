import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContractLeadSourceSeries } from './contractLeadSources.js';

test('counts saved contract source values without collapsing separate selector categories', () => {
  assert.deepEqual(buildContractLeadSourceSeries([
    { leadSource: 'RPCI' }, { leadSource: 'Reference' }, { leadSource: 'Telecalling' },
    { leadSource: 'GoogleAds' }, { leadSource: 'GMB' }, { leadSource: 'Existing Customer' },
    { leadSource: ' rpci ' }, { lead_source: 'Website' }, { leadSource: '' }, {}
  ]), [
    { name: 'GoogleAds', count: 1 }, { name: 'GMB', count: 1 }, { name: 'Website', count: 1 },
    { name: 'Reference', count: 1 }, { name: 'Existing Customer', count: 1 },
    { name: 'Telecalling', count: 1 }, { name: 'RPCI', count: 2 }
  ]);
});

test('retains custom saved sources and omits empty sources without inventing counts', () => {
  assert.deepEqual(buildContractLeadSourceSeries([{ leadSource: 'Partner Event' }, { leadSource: '   ' }, null]), [{ name: 'Partner Event', count: 1 }]);
  assert.deepEqual(buildContractLeadSourceSeries([]), []);
});
