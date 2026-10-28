const crypto = require('node:crypto');

const text = (value) => String(value ?? '').trim();
const serviceKey = (value) => text(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const dateOnly = (value) => {
  const candidate = value instanceof Date ? value.toISOString().slice(0, 10) : text(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return '';
  const date = new Date(`${candidate}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === candidate ? candidate : '';
};
const jsonObject = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try { return JSON.parse(value || '{}') || {}; } catch { return {}; }
};
const fail = (statusCode, message) => { const error = new Error(message); error.statusCode = statusCode; throw error; };
const money = (value) => value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const todayInIndia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const contractStatusLabel = (start, end, today = todayInIndia()) => {
  if (!dateOnly(end)) return 'Period unavailable';
  if (end < today) return 'Expired Contract';
  if (dateOnly(start) && start > today) return 'Upcoming Contract';
  return 'Active Contract';
};
const samePremise = (source, target) => {
  const firstId = text(source?.customerPremiseId), secondId = text(target?.customerPremiseId);
  if (firstId || secondId) return Boolean(firstId && firstId === secondId);
  const firstAddress = serviceKey(source?.premiseAddress || source?.shippingAddressText);
  return Boolean(firstAddress && firstAddress === serviceKey(target?.premiseAddress || target?.shippingAddressText));
};

// Contract records are invoice-backed. Production linking uses wholeContract so
// every included service is claimed together with the full invoice total.
const fixedContractPeriods = new Set(['monthly', 'quarterly', 'bi_monthly', 'three_months', 'half_yearly', 'annual', 'two_years', 'three_years', 'five_years', 'ten_years']);
function isExistingContract(invoice, classifySource) {
  if (classifySource(invoice).relationshipType === 'CONTRACT') return true;
  // Legacy invoice forms defaulted relationship type to ONE_TIME even for
  // fixed-term contracts. Dates alone are never evidence of a contract.
  const lines = Array.isArray(invoice.items) ? invoice.items : [];
  return lines.length > 0 && lines.every((line) => fixedContractPeriods.has(text(line.contractPeriod).toLowerCase()));
}
function withSourceContractDates(renewal, sourceInvoice, deriveWindow) {
  const window = deriveWindow(sourceInvoice);
  return { ...renewal,
    previousContractStart: dateOnly(window.contractStartDate) || renewal.previousContractStart,
    previousContractEnd: dateOnly(window.contractEndDate) || renewal.previousContractEnd
  };
}
function buildExistingCandidates({ renewal, sourceInvoice, invoices, deriveWindow, classifySource, itemTotals, wholeContract = false, allowPremiseReview = false, allowPeriodReview = false, allowServiceReview = false, allowClassificationReview = false }) {
  renewal = withSourceContractDates(renewal, sourceInvoice, deriveWindow);
  const customerId = text(sourceInvoice?.customerId);
  const expectedCustomer = text(renewal.customerExternalId);
  if (!customerId || (expectedCustomer && expectedCustomer !== customerId)) {
    fail(409, 'The previous contract needs a verified customer ID before linking existing records.');
  }
  const wantedService = serviceKey(renewal.serviceType);
  if (!wantedService) fail(409, 'The renewal needs a service name before linking existing records.');
  const previousEnd = dateOnly(renewal.previousContractEnd);
  if (!previousEnd) fail(409, 'The previous contract needs a valid end date before linking.');
  const candidates = [];
  for (const invoice of invoices) {
    if (text(invoice._id) === text(sourceInvoice._id) || text(invoice.customerId) !== customerId) continue;
    if (/draft|cancelled|canceled|void|proforma/i.test(`${invoice.status || ''} ${invoice.invoiceType || ''}`)) continue;
    if (!text(invoice.invoiceNumber)) continue;
    const premiseReviewRequired = !samePremise(sourceInvoice, invoice);
    if (premiseReviewRequired && !allowPremiseReview) continue;
    const lines = Array.isArray(invoice.items) && invoice.items.length ? invoice.items : [{ itemName: invoice.serviceType || invoice.subject }];
    const groups = new Map();
    let incomplete = false;
    for (const line of lines) {
      const name = text(line.itemName || line.name || invoice.serviceType || invoice.subject);
      const start = dateOnly(line.contractStartDate || line.serviceStartDate || invoice.servicePeriodStart);
      const derived = deriveWindow({ ...invoice, items: [line] });
      const end = dateOnly(line.contractEndDate || line.serviceEndDate || line.renewalDate || invoice.servicePeriodEnd
        || (line.contractPeriod && start ? derived.contractEndDate : ''));
      if (!name || !start || !end || end < start) { incomplete = true; break; }
      const key = JSON.stringify([serviceKey(name), start, end]);
      const group = groups.get(key) || { serviceType: name, start, end, lines: [] };
      group.lines.push(line); groups.set(key, group);
    }
    if (incomplete || !groups.size) continue;
    if (wholeContract) {
      const services = [...groups.values()];
      groups.clear();
      groups.set('contract', {
        serviceType: [...new Set(services.map((group) => group.serviceType))].join(', '),
        serviceKeys: [...new Set(services.map((group) => serviceKey(group.serviceType)))],
        servicePeriods: services.map(({ serviceType, start, end }) => ({ serviceType, start, end })),
        start: services.map((group) => group.start).sort()[0],
        end: services.map((group) => group.end).sort().at(-1),
        periodReviewRequired: services.some((group) => group.start < previousEnd || group.end <= previousEnd),
        lines
      });
    }
    const total = money(invoice.total ?? invoice.amount);
    if (total === null) continue;
    const gross = itemTotals(lines, invoice.invoiceType).total;
    if (groups.size > 1 && (!(gross > 0) || lines.some((line) => money(line.amount) === null && (money(line.quantity) === null || money(line.rate) === null)))) continue;
    const ordered = [...groups.values()];
    const totalCents = Math.round(total * 100);
    const shares = ordered.map((group, index) => ({ index, value: groups.size === 1 ? totalCents : totalCents * itemTotals(group.lines, invoice.invoiceType).total / gross }));
    const allocations = shares.map((share) => Math.floor(share.value));
    const remainder = totalCents - allocations.reduce((sum, value) => sum + value, 0);
    const fractions = [...shares].sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)) || a.index - b.index);
    for (let index = 0; index < remainder; index += 1) allocations[fractions[index % fractions.length].index] += 1;
    ordered.forEach((group, index) => {
      const amountCents = allocations[index];
      const serviceReviewRequired = wholeContract ? !group.serviceKeys.includes(wantedService) : serviceKey(group.serviceType) !== wantedService;
      const periodReviewRequired = group.periodReviewRequired || group.start < previousEnd || group.end <= previousEnd;
      const classificationReviewRequired = !isExistingContract({ ...invoice, items: group.lines }, classifySource);
      if ((serviceReviewRequired && !allowServiceReview) || (periodReviewRequired && !allowPeriodReview) ||
          (classificationReviewRequired && !allowClassificationReview)) return;
      const reviewWarnings = [
        ...(premiseReviewRequired ? [{ code: 'PREMISES_MISMATCH', message: 'Premises differ or are unverified. Confirm the same service location.' }] : []),
        ...(periodReviewRequired ? [{ code: 'PERIOD_MISMATCH', message: 'This contract period does not follow the previous contract. Compare and approve the selected period.' }] : []),
        ...(serviceReviewRequired ? [{ code: 'SERVICE_MISMATCH', message: 'The service name differs from this renewal. Confirm the selected service fulfils this renewal.' }] : []),
        ...(classificationReviewRequired ? [{ code: 'CONTRACT_CLASSIFICATION', message: 'This issued record is not classified as a contract. Confirm it represents the renewal contract.' }] : [])
      ];
      const identity = JSON.stringify(wholeContract ? ['CONTRACT', text(invoice._id), group.serviceKeys, group.servicePeriods] : serviceReviewRequired
        ? [text(invoice._id), wantedService, serviceKey(group.serviceType), group.start, group.end]
        : [text(invoice._id), wantedService, group.start, group.end]);
      candidates.push({
        key: crypto.createHash('sha256').update(identity).digest('hex'), invoiceId: text(invoice._id),
        invoiceNumber: text(invoice.invoiceNumber), customerName: text(invoice.customerName),
        premiseReviewRequired, periodReviewRequired, serviceReviewRequired, classificationReviewRequired, reviewWarnings,
        renewalVersion: crypto.createHash('sha256').update(JSON.stringify({ renewalId: renewal.renewalId,
          previousContractId: renewal.previousContractId || renewal.contractId, customerExternalId: renewal.customerExternalId,
          serviceType: renewal.serviceType, previousContractStart: renewal.previousContractStart, previousContractEnd: previousEnd,
          previousContractAmount: money(renewal.previousContractAmount), renewalOutcome: renewal.renewalOutcome,
          convertedContractId: renewal.convertedContractId, newContractId: renewal.newContractId })).digest('hex'),
        sourceInvoiceVersion: crypto.createHash('sha256').update(JSON.stringify(sourceInvoice)).digest('hex'),
        previousContract: {
          invoiceId: text(sourceInvoice._id), invoiceNumber: text(sourceInvoice.invoiceNumber), customerName: text(sourceInvoice.customerName),
          premiseId: text(sourceInvoice.customerPremiseId),
          address: text(sourceInvoice.premiseAddress || sourceInvoice.shippingAddressText || sourceInvoice.billingAddressText),
          start: dateOnly(renewal.previousContractStart), end: previousEnd, serviceType: renewal.serviceType,
          amount: renewal.previousContractAmount
        },
        premiseId: text(invoice.customerPremiseId),
        address: text(invoice.premiseAddress || invoice.shippingAddressText || invoice.billingAddressText),
        premiseLabel: text(invoice.premiseLabel || invoice.premiseAddress || invoice.shippingAddressText),
        serviceType: group.serviceType, serviceKey: serviceKey(group.serviceType), start: group.start, end: group.end,
        ...(wholeContract ? { linkScope: 'CONTRACT', serviceKeys: group.serviceKeys, servicePeriods: group.servicePeriods } : {}),
        classification: classificationReviewRequired ? 'Not classified as contract' : 'Contract',
        expectedStart: new Date(Date.parse(`${previousEnd}T00:00:00Z`) + 86400000).toISOString().slice(0, 10),
        amount: amountCents / 100, invoiceTotal: total,
        amountBasis: wholeContract ? 'Full existing contract / invoice total, including all services' : groups.size === 1 ? 'Existing invoice total' : 'Invoice total allocated by service value, including tax and discounts',
        agreementDate: dateOnly(invoice.agreementDate || invoice.date),
        invoiceVersion: crypto.createHash('sha256').update(JSON.stringify(invoice)).digest('hex')
      });
    });
  }
  return candidates.sort((a, b) => a.start.localeCompare(b.start) || a.invoiceNumber.localeCompare(b.invoiceNumber));
}

// Discovery is broader than permission to link: show the customer's entire
// invoice history so old invoice numbers remain searchable, while saves still
// use buildExistingCandidates and the transactional duplicate checks.
function buildExistingHistory(options) {
  const { sourceInvoice, invoices, deriveWindow, classifySource } = options;
  const renewal = withSourceContractDates(options.renewal, sourceInvoice, deriveWindow);
  if (!text(sourceInvoice?.customerId) || (text(renewal.customerExternalId) && text(renewal.customerExternalId) !== text(sourceInvoice.customerId))) {
    fail(409, 'The previous contract needs a verified customer ID before searching existing records.');
  }
  let eligible = [], validationError = '';
  try { eligible = buildExistingCandidates(options); } catch (error) {
    if (error.statusCode !== 409) throw error;
    validationError = error.message;
  }
  const history = [];
  const reviewCandidates = options.canReview && !validationError ? buildExistingCandidates({ ...options, allowPremiseReview: true, allowPeriodReview: true, allowServiceReview: true, allowClassificationReview: true }).filter((item) => item.reviewWarnings.length) : [];
  for (const invoice of invoices) {
    if (text(invoice.customerId) !== text(sourceInvoice.customerId) || !text(invoice.invoiceNumber)) continue;
    const matches = eligible.filter((item) => item.invoiceId === text(invoice._id));
    const reviewMatches = reviewCandidates.filter((item) => item.invoiceId === text(invoice._id));
    if (matches.length || reviewMatches.length) {
      history.push(...matches.map((item) => ({ ...item, eligible: true, contractStatusLabel: contractStatusLabel(item.start, item.end, options.today) })));
      history.push(...reviewMatches.map((item) => ({ ...item, eligible: false, reviewAllowed: true,
        eligibilityReason: item.reviewWarnings.map((warning) => warning.message).join(' '),
        contractStatusLabel: contractStatusLabel(item.start, item.end, options.today) })));
      continue;
    }
    const lines = Array.isArray(invoice.items) ? invoice.items : [];
    const window = deriveWindow(invoice);
    const start = dateOnly(window.contractStartDate || invoice.servicePeriodStart || invoice.date);
    // Do not infer a contract expiry from a payment due date.
    const explicitEnds = lines.map((line) => dateOnly(line.contractEndDate || line.serviceEndDate || line.renewalDate)).filter(Boolean);
    const end = explicitEnds.sort().at(-1) || dateOnly(invoice.servicePeriodEnd)
      || (lines.some((line) => line.contractPeriod) ? dateOnly(window.contractEndDate) : '');
    const serviceType = [...new Set(lines.map((line) => text(line.itemName || line.name)).filter(Boolean))].join(', ') || text(invoice.serviceType || invoice.subject);
    let reason = validationError;
    if (!reason && text(invoice._id) === text(sourceInvoice._id)) reason = 'This is the previous contract. Select the contract that renewed it.';
    if (!reason && /draft/i.test(`${invoice.status || ''} ${invoice.invoiceType || ''}`)) reason = 'This invoice is saved as Draft. Open and save the existing contract / invoice to issue it automatically, then refresh records here.';
    if (!reason && /cancelled|canceled|void|proforma/i.test(`${invoice.status || ''} ${invoice.invoiceType || ''}`)) reason = 'Cancelled, void or proforma invoices cannot be linked.';
    if (!reason && !samePremise(sourceInvoice, invoice)) reason = 'Premises do not match or are not verified on both records.';
    if (!reason && !lines.some((line) => serviceKey(line.itemName || line.name) === serviceKey(renewal.serviceType)) && serviceKey(invoice.serviceType || invoice.subject) !== serviceKey(renewal.serviceType)) reason = 'The service does not match this renewal.';
    if (!reason && (!start || !end)) reason = 'A verified contract start and end date are required before linking.';
    if (!reason && (start < dateOnly(renewal.previousContractEnd) || end <= dateOnly(renewal.previousContractEnd))) reason = 'This contract period does not follow the previous contract.';
    if (!reason && !isExistingContract(invoice, classifySource)) reason = 'This record is not classified as a contract. Set a fixed contract period or classify the service as Contract in the existing invoice.';
    if (!reason) reason = 'Review the service dates and invoice amounts before linking this record.';
    history.push({
      key: `history-${text(invoice._id)}`, invoiceId: text(invoice._id), invoiceNumber: text(invoice.invoiceNumber),
      customerName: text(invoice.customerName), premiseLabel: text(invoice.premiseLabel || invoice.premiseAddress || invoice.shippingAddressText),
      serviceType, start, end, invoiceTotal: money(invoice.total ?? invoice.amount), amount: money(invoice.total ?? invoice.amount),
      amountBasis: 'Existing invoice total', agreementDate: dateOnly(invoice.agreementDate || invoice.date),
      previousContract: { invoiceId: text(sourceInvoice._id), invoiceNumber: text(sourceInvoice.invoiceNumber), customerName: text(sourceInvoice.customerName),
        premiseId: text(sourceInvoice.customerPremiseId), address: text(sourceInvoice.premiseAddress || sourceInvoice.shippingAddressText || sourceInvoice.billingAddressText),
        start: dateOnly(renewal.previousContractStart), end: dateOnly(renewal.previousContractEnd), serviceType: renewal.serviceType, amount: renewal.previousContractAmount },
      address: text(invoice.premiseAddress || invoice.shippingAddressText || invoice.billingAddressText), premiseId: text(invoice.customerPremiseId),
      contractStatusLabel: contractStatusLabel(start, end, options.today), eligible: false, eligibilityReason: reason
    });
  }
  return history.sort((a, b) => b.start.localeCompare(a.start) || a.invoiceNumber.localeCompare(b.invoiceNumber));
}

function createExistingLinkService({ getConnection, toRenewal, toInvoice, deriveWindow, classifySource, itemTotals, deriveTiming, priceDelta, audit }) {
  const build = (renewal, sourceInvoice, invoices, approvals = {}) => buildExistingCandidates({ renewal, sourceInvoice, invoices, deriveWindow, classifySource, itemTotals, wholeContract: true, ...approvals });
  const loadRenewal = async (conn, id, lock = false) => {
    const [rows] = await conn.query(`SELECT * FROM renewals WHERE renewal_id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id]);
    if (!rows[0]) fail(404, 'Renewal not found.');
    return rows[0];
  };
  const sourceFor = async (conn, renewal) => {
    const id = text(renewal.previousContractId || renewal.contractId);
    const [rows] = await conn.query('SELECT * FROM invoices WHERE external_id = ? LIMIT 1', [id]);
    if (!rows[0]) fail(404, 'The previous contract/invoice was not found.');
    return toInvoice(rows[0]);
  };
  const conflictsWithLink = (candidate, renewal, source, invoices, linkedRows) => linkedRows.some((raw) => {
    const other = toRenewal(raw);
    if (other.renewalId === renewal.renewalId) return false;
    const otherLink = jsonObject(raw.payload).existingRenewalLink;
    const otherInvoice = invoices.find((invoice) => [other.convertedContractId, other.newContractId].includes(text(invoice._id)));
    const otherLines = !otherLink && Array.isArray(otherInvoice?.items) ? otherInvoice.items : [];
    const candidateServices = candidate.serviceKeys || [candidate.serviceKey || serviceKey(candidate.serviceType)];
    const otherServices = otherLink?.serviceKeys || (otherLines.length ? otherLines.map((line) => serviceKey(line.itemName || line.name)) : [serviceKey(otherLink?.serviceType || other.serviceType)]);
    const sameService = otherServices.some((key) => candidateServices.includes(key));
    const otherStart = dateOnly(otherLink?.start || other.newContractStartDate);
    const otherEnd = dateOnly(otherLink?.end || other.newContractEndDate);
    const candidatePeriods = candidate.servicePeriods || [{ serviceType: candidate.serviceType, start: candidate.start, end: candidate.end }];
    const otherPeriods = otherLink?.servicePeriods || (otherLines.length ? otherLines.map((line) => ({
      serviceType: line.itemName || line.name,
      start: dateOnly(line.contractStartDate || line.serviceStartDate) || otherStart,
      end: dateOnly(line.contractEndDate || line.serviceEndDate || line.renewalDate) || otherEnd
    })) : [{ serviceType: otherLink?.serviceType || other.serviceType, start: otherStart, end: otherEnd }]);
    const samePeriod = candidatePeriods.some((first) => otherPeriods.some((second) =>
      serviceKey(first.serviceType) === serviceKey(second.serviceType) && first.start === second.start && first.end === second.end));
    const sameInvoice = [other.convertedContractId, other.newContractId].includes(candidate.invoiceId);
    if (sameInvoice && (candidate.linkScope === 'CONTRACT' || otherLink?.linkScope === 'CONTRACT')) return true;
    // With unverified premises, conservatively block an already-claimed service
    // period for this customer even if it appears on a different invoice.
    return sameService && ((sameInvoice && (!otherStart || !otherEnd || samePeriod)) || (samePeriod && (samePremise(source, otherInvoice) || candidate.premiseReviewRequired)));
  });
  const list = async ({ renewalId, authorize, canReview = false }) => {
    const conn = await getConnection();
    try {
      const renewal = toRenewal(await loadRenewal(conn, renewalId)); authorize(renewal);
      const source = await sourceFor(conn, renewal);
      const [rows] = await conn.query('SELECT * FROM invoices WHERE customer_external_id = ? ORDER BY external_id', [source.customerId]);
      const invoices = rows.map(toInvoice);
      const ids = invoices.map((invoice) => text(invoice._id)).filter(Boolean);
      if (!ids.length) return [];
      const [linkedRows] = await conn.query('SELECT * FROM renewals WHERE converted_contract_id IN (?) OR new_contract_id IN (?) OR contract_id IN (?)', [ids, ids, ids]);
      return buildExistingHistory({ renewal, sourceInvoice: source, invoices, deriveWindow, classifySource, itemTotals, canReview, wholeContract: true })
        .filter((candidate) => candidate.invoiceId !== text(source._id))
        .filter((candidate) => !conflictsWithLink(candidate, renewal, source, invoices, linkedRows))
        .filter((candidate) => candidate.eligible !== false || !linkedRows.some((raw) => {
          const other = toRenewal(raw);
          return other.renewalId !== renewal.renewalId && [other.convertedContractId, other.newContractId].includes(candidate.invoiceId);
        }));
    } finally { conn.release(); }
  };
  const link = async ({ renewalId, body, actor, authorize, canCorrect = false, req = null }) => {
    const agreementDate = dateOnly(body.agreementDate);
    const today = todayInIndia();
    if (!agreementDate || agreementDate > today) fail(400, 'Enter the actual agreement date (today or earlier).');
    if (body.correctLink === true && !text(body.notes)) fail(400, 'Enter a reason for correcting the existing link.');
    const reviewFlags = ['reviewPremises', 'reviewPeriod', 'reviewService', 'reviewClassification'];
    if (reviewFlags.some((key) => body[key] === true) && !canCorrect) fail(403, 'Only a manager can approve renewal exceptions.');
    if (reviewFlags.some((key) => body[key] === true) && !text(body.notes)) fail(400, 'Enter the reason for approving the renewal exceptions.');
    if (!text(body.candidateKey) || !text(body.invoiceId) || !text(body.invoiceVersion)) fail(400, 'Select and review an existing contract/invoice first.');
    const conn = await getConnection();
    let committed = false;
    try {
      const initial = toRenewal(await loadRenewal(conn, renewalId)); authorize(initial);
      const initialSource = await sourceFor(conn, initial);
      await conn.beginTransaction();
      // Serialize links for this customer, including different services/renewals.
      const [invoiceRows] = await conn.query('SELECT * FROM invoices WHERE customer_external_id = ? ORDER BY external_id FOR UPDATE', [initialSource.customerId]);
      const raw = await loadRenewal(conn, renewalId, true);
      let renewal = toRenewal(raw); authorize(renewal);
      const source = invoiceRows.map(toInvoice).find((invoice) => text(invoice._id) === text(renewal.previousContractId || renewal.contractId));
      if (!source) fail(409, 'The previous contract changed. Refresh and try again.');
      renewal = withSourceContractDates(renewal, source, deriveWindow);
      const payload = jsonObject(raw.payload);
      const existing = payload.existingRenewalLink;
      if (existing?.key === body.candidateKey && existing.agreementDate === agreementDate) {
        await conn.commit(); committed = true;
        return { renewalId, alreadyLinked: true, renewal };
      }
      if (renewal.renewalOutcome === 'LOST' || ['Lost', 'Declined'].includes(renewal.status)) fail(409, 'Reopen the lost renewal before linking an existing contract.');
      if (renewal.convertedContractId || renewal.newContractId) {
        if (!(existing && canCorrect && body.correctLink === true)) fail(409, 'This renewal already has a linked contract. Only a manager can correct an existing-record link.');
      }
      const candidate = build(renewal, source, invoiceRows.map(toInvoice), { allowPremiseReview: body.reviewPremises === true && canCorrect,
        allowPeriodReview: body.reviewPeriod === true && canCorrect, allowServiceReview: body.reviewService === true && canCorrect,
        allowClassificationReview: body.reviewClassification === true && canCorrect }).find((item) => item.key === body.candidateKey && item.invoiceId === body.invoiceId);
      if (!candidate) fail(409, 'The selected record no longer matches the customer, premises, service or renewal period. Refresh the matches.');
      if (candidate.invoiceVersion !== body.invoiceVersion) fail(409, 'The invoice changed after your preview. Refresh and review it again.');
      if (candidate.reviewWarnings.length && candidate.renewalVersion !== body.renewalVersion) fail(409, 'The renewal changed after comparison. Refresh and review both records again.');
      if (candidate.reviewWarnings.length && candidate.sourceInvoiceVersion !== body.sourceInvoiceVersion) fail(409, 'The previous invoice changed after comparison. Refresh and review both records again.');
      const [linkedRows] = await conn.query('SELECT * FROM renewals WHERE converted_contract_id = ? OR new_contract_id = ? OR contract_id IN (?) FOR UPDATE', [candidate.invoiceId, candidate.invoiceId, invoiceRows.map((row) => row.external_id)]);
      if (conflictsWithLink(candidate, renewal, source, invoiceRows.map(toInvoice), linkedRows)) {
        fail(409, 'This contract or an included service period is already linked to another renewal. Review that renewal instead.');
      }
      const edges = new Map();
      for (const row of linkedRows) {
        const other = toRenewal(row);
        if (other.renewalId === renewal.renewalId) continue;
        const parent = text(other.previousContractId || other.contractId);
        const child = text(other.convertedContractId || other.newContractId);
        if (parent && child) edges.set(parent, [...(edges.get(parent) || []), child]);
      }
      const pending = [candidate.invoiceId], seen = new Set();
      while (pending.length) {
        const id = pending.pop();
        if (id === text(source._id)) fail(409, 'This link would create a circular renewal chain. Review the existing links instead.');
        if (seen.has(id)) continue;
        seen.add(id); pending.push(...(edges.get(id) || []));
      }
      const now = new Date().toISOString();
      const linkInfo = { ...candidate, mode: 'existing', agreementDate, linkedAt: now, linkedBy: actor, notes: text(body.notes),
        premisesReview: candidate.premiseReviewRequired ? { approvedBy: actor, approvedAt: now, reason: text(body.notes) } : null,
        exceptionReview: candidate.reviewWarnings.length ? { issues: candidate.reviewWarnings.map((warning) => warning.code),
          approvedBy: actor, approvedAt: now, reason: text(body.notes), renewalVersion: candidate.renewalVersion, sourceInvoiceVersion: candidate.sourceInvoiceVersion,
          invoiceVersion: candidate.invoiceVersion, previousContract: candidate.previousContract,
          selectedContract: { invoiceId: candidate.invoiceId, invoiceNumber: candidate.invoiceNumber, serviceType: candidate.serviceType,
            premiseId: candidate.premiseId, address: candidate.address, start: candidate.start, end: candidate.end, amount: candidate.amount } } : null };
      delete linkInfo.invoiceVersion;
      const reminderPlan = { ...(payload.reminderPlan || {}), autoEnabled: false, nextReminderDate: '' };
      const nextPayload = { ...payload, existingRenewalLink: linkInfo, reminderPlan };
      const timing = deriveTiming({ renewal_outcome: 'WON', outcome_decision_date: agreementDate, previous_contract_end: renewal.previousContractEnd });
      const delta = priceDelta(renewal.previousContractAmount, candidate.amount);
      const [updateResult] = await conn.query(`UPDATE renewals SET status = 'Done', renewal_status = 'RENEWED', renewal_outcome = 'WON',
        converted_contract_id = ?, new_contract_id = ?, agreement_date = ?, outcome_decision_date = ?,
        outcome_recorded_at = ?, outcome_updated_by = ?, renewed_at = ?, new_contract_start_date = ?, new_contract_end_date = ?,
        agreed_contract_amount = ?, final_renewal_amount = ?, price_difference = ?, price_change_percent = ?,
        renewal_timing = ?, renewed_by_sales_person_id = ?, renewed_by_sales_person_name = ?, followup_date = NULL, payload = ?
        WHERE renewal_id = ?`, [candidate.invoiceId, candidate.invoiceId, agreementDate, agreementDate,
        now.slice(0, 19).replace('T', ' '), actor, `${agreementDate} 00:00:00`, candidate.start, candidate.end,
        candidate.amount, candidate.amount, delta.difference, delta.percentage, timing,
        renewal.renewedBySalesPersonId || renewal.assignedSalesPersonId || null,
        renewal.renewedBySalesPersonName || renewal.assignedSalesPersonName || null,
        JSON.stringify(nextPayload), renewalId]);
      if (Number(updateResult?.affectedRows) !== 1) fail(409, 'The renewal changed while linking. Refresh and try again.');
      await audit(conn, { renewalId, action: existing ? 'renewal_correct_existing_link' : 'renewal_link_existing',
        previousValue: { renewalOutcome: renewal.renewalOutcome, convertedContractId: renewal.convertedContractId, existingRenewalLink: existing || null },
        nextValue: { renewalOutcome: 'WON', existingRenewalLink: linkInfo, notes: text(body.notes) }, req });
      const saved = toRenewal(await loadRenewal(conn, renewalId));
      await conn.commit(); committed = true;
      return { renewalId, alreadyLinked: false, renewal: saved };
    } catch (error) {
      if (!committed) await conn.rollback();
      throw error;
    } finally { conn.release(); }
  };
  return { list, link };
}

module.exports = { buildExistingCandidates, buildExistingHistory, contractStatusLabel, createExistingLinkService, dateOnly, serviceKey };
