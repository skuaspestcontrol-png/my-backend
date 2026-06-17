export const DEFAULT_LEAD_SOURCES = [
  'Call',
  'GoogleAds',
  'GMB',
  'Website',
  'Reference',
  'Existing Customer',
  'Telecalling',
  'RPCI',
  'Hometriangle',
  'Justdial',
  'Indiamart',
  'Walkin'
];

export const normalizeLeadSource = (value) => String(value || '').trim();

export const mergeLeadSourceOptions = (...groups) => {
  const seen = new Set();
  const values = [];

  const append = (group = []) => {
    (Array.isArray(group) ? group : []).forEach((item) => {
      const raw = normalizeLeadSource(item);
      if (!raw) return;
      const key = raw.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      values.push(raw);
    });
  };

  groups.forEach(append);
  return values;
};
