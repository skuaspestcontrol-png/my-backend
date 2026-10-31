import { DEFAULT_LEAD_SOURCES } from './leadSources.js';

// Keep the Contract selector's categories distinct, including Reference and RPCI.
export function buildContractLeadSourceSeries(records = []) {
  const canonical = new Map(DEFAULT_LEAD_SOURCES.map(name => [name.toLowerCase(), name]));
  const counts = new Map();
  for (const record of records) {
    const raw = String(record?.leadSource || record?.lead_source || '').trim();
    if (!raw) continue;
    const name = canonical.get(raw.toLowerCase()) || raw;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const names = [...DEFAULT_LEAD_SOURCES, ...[...counts.keys()].filter(name => !DEFAULT_LEAD_SOURCES.includes(name)).sort((a, b) => a.localeCompare(b))];
  return names.filter(name => counts.has(name)).map(name => ({ name, count: counts.get(name) }));
}
