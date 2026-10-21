export async function updateMonthlyRenewalLetters({ rows, month, year, regenerate, onProgress }) {
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12 ||
      !Number.isInteger(yearNumber) || yearNumber < 1000 || yearNumber > 9999) {
    throw new Error('Select a specific dashboard month and year first.');
  }
  const prefix = `${yearNumber}-${String(monthNumber).padStart(2, '0')}`;
  const unique = new Map();
  for (const row of rows) {
    const id = String(row.renewalId || row.renewal_id || '').trim();
    const expiry = String(row.previousContractEnd || row.renewalDueDate || '').slice(0, 10);
    if (id && expiry.startsWith(`${prefix}-`) && (row.renewalLetterUrl || row.pdf_url)) unique.set(id, row);
  }
  const result = { total: unique.size, updated: 0, failures: [], stopped: false };
  onProgress?.({ ...result, completed: 0 });
  // Generate one at a time: avoid competing PDF/numbering work and pool stalls.
  for (const [id, row] of unique) {
    try {
      await regenerate(id, { letterMonth: monthNumber, letterYear: yearNumber });
      result.updated += 1;
    } catch (error) {
      result.failures.push({ id, customerName: row.customerName || '', error: error?.response?.data?.error || error.message || 'Unable to update letter.' });
      // An interrupted response may still have saved; never automatically retry.
      if (!error.response || [401, 403].includes(error.response.status)) result.stopped = true;
    }
    onProgress?.({ ...result, completed: result.updated + result.failures.length });
    if (result.stopped) break;
  }
  return result;
}
