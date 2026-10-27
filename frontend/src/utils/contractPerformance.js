// Compare every JSON field: never infer equality from IDs/timestamps alone.
export const sameSnapshotValue = (left, right) => {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left)) {
    return left.length === right.length && left.every((value, index) => sameSnapshotValue(value, right[index]));
  }
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => (
    Object.prototype.hasOwnProperty.call(right, key) && sameSnapshotValue(left[key], right[key])
  ));
};

export const reuseUnchangedSnapshot = (previous, next) => {
  const snapshot = {};
  let changed = false;
  for (const key of Object.keys(next)) {
    snapshot[key] = sameSnapshotValue(previous?.[key], next[key]) ? previous?.[key] : next[key];
    if (snapshot[key] !== previous?.[key]) changed = true;
  }
  return { snapshot, changed };
};

const contractCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const statusOrder = { Active: 0, Upcoming: 1, 'Expiring Soon': 2, Expired: 3, Renewed: 4, Draft: 5, Proforma: 6, Cancelled: 7, Void: 8 };

export const sortContractRows = (rows, sort, parseDateOnly) => {
  const value = (row) => {
    switch (sort.key) {
      case 'contractNo': return String(row.contractNo || '');
      case 'customer': return String(row.customer || '');
      case 'property': return String(row.property || '');
      case 'duration': return parseDateOnly(row.endDate)?.getTime() || 0;
      case 'type': return parseDateOnly(row.invoiceDate)?.getTime() || 0;
      case 'services': return Number(row.services || 0);
      case 'status': return Number(statusOrder[row.status] ?? 99);
      case 'total': return Number(row.total || 0);
      case 'paid': return Number(row.paid || 0);
      case 'due': return Number(row.due || 0);
      default: return String(row[sort.key] || '');
    }
  };
  // Parse dates/numbers once per row instead of once per comparator invocation.
  return rows.map((row) => ({ row, value: value(row) })).sort((left, right) => {
    const comparison = typeof left.value === 'number' && typeof right.value === 'number'
      ? left.value - right.value
      : contractCollator.compare(String(left.value), String(right.value));
    return sort.direction === 'asc' ? comparison : -comparison;
  }).map((entry) => entry.row);
};
