const text = (value) => String(value ?? '').trim();
const nameKey = (value) => text(value).replace(/\s+/g, ' ').toLowerCase();

export function mergeRenewalSalesAssignments(previous = [], rows = []) {
  const assignments = new Map();
  [...previous, ...rows].forEach((row) => {
    const id = text(row.assignedSalesPersonId);
    const name = text(row.assignedSalesPersonName);
    if (id || name) assignments.set(JSON.stringify([id, name]), { assignedSalesPersonId: id, assignedSalesPersonName: name });
  });
  return [...assignments.values()];
}

export function buildRenewalSalesPeople(employees = [], assignments = []) {
  const people = [];
  employees.filter((employee) => nameKey(employee.role || employee.roleName).includes('sales')).forEach((employee) => {
    const ids = [...new Set([employee._id, employee.empCode, employee.id, employee.employeeId, employee.external_id, employee.externalId].map(text).filter(Boolean))];
    const name = text(employee.fullName || [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.name || employee.empCode);
    if (!ids.length || !name || people.some((person) => person.ids.some((id) => ids.includes(id)))) return;
    people.push({ id: ids[0], ids, name });
  });
  assignments.forEach((row) => {
    const id = text(row.assignedSalesPersonId);
    const name = text(row.assignedSalesPersonName);
    if (!id && !name) return;
    if (id && people.some((person) => person.ids.includes(id))) return;
    const sameName = people.filter((person) => nameKey(person.name) === nameKey(name));
    if ((!id || nameKey(id) === nameKey(name)) && sameName.length === 1) return;
    const value = id || name;
    if (people.some((person) => person.id === value)) return;
    people.push({ id: value, ids: id && nameKey(id) !== nameKey(name) ? [id] : [], name: name || id });
  });
  return people.map((person) => {
    const sameName = people.filter((other) => nameKey(other.name) === nameKey(person.name));
    return {
      ...person,
      // Never assign a name-only historical row to one of two different employees.
      matchName: sameName.filter((other) => other.ids.length).length > 1 ? '' : person.name,
      label: sameName.length > 1 ? `${person.name} (${person.ids.length ? person.id : 'name only'})` : person.name
    };
  });
}

export function buildRenewalFilterParams(filters, people = []) {
  const selection = text(filters.assignedSalesPersonId);
  const selected = people.find((person) => person.id === selection || person.ids.includes(selection) || (person.matchName && nameKey(person.matchName) === nameKey(selection)));
  return {
    ...filters,
    assignedSalesPersonId: selected?.id || selection,
    assignedSalesPersonName: selected?.matchName || '',
    assignedSalesPersonIds: JSON.stringify(selected?.ids || [])
  };
}
