// Invoice number is a display label, not identity. Keep each service/period key intact.
export const groupRenewalCandidates = (candidates, { search = '', selectedKey = '', selectedInvoiceId = '' } = {}) => {
  const groups = new Map();
  const exactCopies = new Set();
  candidates.forEach((candidate, index) => {
    const signature = JSON.stringify(candidate);
    if (exactCopies.has(signature)) return;
    exactCopies.add(signature);
    const id = String(candidate.invoiceId || '').trim() || `candidate:${candidate.key || index}`;
    if (!groups.has(id)) groups.set(id, { id, invoiceNumber: candidate.invoiceNumber || 'Invoice not set', candidates: [] });
    groups.get(id).candidates.push(candidate);
  });
  const all = [...groups.values()];
  const numbers = new Map();
  all.forEach((group) => {
    const number = String(group.invoiceNumber).trim().toLowerCase();
    const peers = numbers.get(number) || [];
    peers.push(group); numbers.set(number, peers);
  });
  const query = String(search || '').toLowerCase();
  return all.filter((group) => group.id === selectedInvoiceId || group.candidates.some((candidate) => (
    candidate.key === selectedKey || `${candidate.invoiceNumber} ${candidate.customerName} ${candidate.serviceType} ${candidate.premiseLabel} ${candidate.start} ${candidate.end} ${candidate.contractStatusLabel || ''}`.toLowerCase().includes(query)
  ))).map((group) => {
    const peers = numbers.get(String(group.invoiceNumber).trim().toLowerCase());
    const statuses = [...new Set(group.candidates.map((candidate) => candidate.contractStatusLabel || 'Contract'))];
    return { ...group, statusLabel: statuses.length === 1 ? statuses[0] : 'Multiple service periods', recordSuffix: peers.length > 1 ? ` · Record ${peers.indexOf(group) + 1} of ${peers.length}` : '' };
  });
};
