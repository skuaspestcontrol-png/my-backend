export const PEST_ISSUE_CODES = {
  'cockroach control': 'CC',
  'termite control': 'TC',
  'bedbug control': 'BBC',
  'bed bug control': 'BBC',
  'general pest control': 'GPC',
  'rodent control': 'RC',
  'mosquito control': 'MC',
  'wood borer control': 'WBC',
  'pre construction termite control': 'PCTC',
  'ants control': 'AC',
  'flies control': 'FC',
  'spider control': 'SC',
  'wasp control': 'WC'
};

export const pestIssueShort = (value) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  const normalized = text.toLowerCase().replace(/\s+/g, ' ');
  if (PEST_ISSUE_CODES[normalized]) return PEST_ISSUE_CODES[normalized];
  return text
    .split(/[\s/&+-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 5)
    .toUpperCase();
};

export const pestIssueLabel = (value) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const code = pestIssueShort(text);
  return code && code !== '-' ? `${text} - ${code}` : text;
};
