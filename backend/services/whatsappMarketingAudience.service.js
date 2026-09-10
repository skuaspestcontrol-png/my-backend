const { normalizePhoneNumber, validatePhoneNumber } = require('./whatsapp.service');

const text = (value) => String(value ?? '').trim();
const lower = (value) => text(value).toLowerCase();
const list = (value) => (Array.isArray(value) ? value : []);
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const first = (...values) => values.find((value) => text(value)) || '';
const dateValue = (...values) => {
  const value = first(...values);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateKeys = [
  'date', 'serviceDate', 'service_date', 'visitDate', 'visit_date', 'jobDate', 'job_date',
  'contractDate', 'contract_date', 'startDate', 'start_date', 'createdAt', 'created_at', 'updatedAt', 'updated_at'
];

const idOf = (row) => text(row?._id || row?.id || row?.customerId || row?.customer_id || row?.customerExternalId || row?.customer_external_id);
const customerIdOf = (row) => text(row?.customerId || row?.customer_id || row?.customerExternalId || row?.customer_external_id || row?.customer_id_fk);
const phoneOf = (row) => first(
  row?.whatsappNumber, row?.whatsapp_number, row?.mobile, row?.mobileNumber, row?.phone,
  row?.phoneNumber, row?.contactNumber, row?.customerPhone, row?.customer_phone, row?.billingPhone
);
const nameOf = (row) => first(row?.displayName, row?.name, row?.customerName, row?.customer_name, row?.contactPersonName, row?.companyName, 'Customer');
const serviceOf = (row) => first(row?.serviceType, row?.service_type, row?.serviceName, row?.service_name, row?.service, row?.segment, row?.pestIssue, row?.pest_name);
const areaOf = (row) => first(row?.billingArea, row?.areaName, row?.area, row?.shippingArea, row?.premise_area_name);
const cityOf = (row) => first(row?.billingCity, row?.city, row?.shippingCity, row?.premise_city);
const stateOf = (row) => first(row?.billingState, row?.state, row?.shippingState, row?.placeOfSupply);
const salesPersonOf = (row) => first(row?.salesPersonName, row?.sales_person_name, row?.assignedSalesPersonName, row?.salesPerson, row?.sales_person, row?.assignedTo, row?.assigned_to, row?.employeeName);
const renewalDateOf = (row) => first(row?.renewalDate, row?.renewal_date, row?.nextRenewalDate, row?.next_renewal_date, row?.expiryDate, row?.expiry_date, row?.contractEndDate, row?.contract_end_date, row?.dueDate, row?.due_date);
const balanceOf = (row) => number(first(row?.outstandingBalance, row?.outstanding_balance, row?.balanceDue, row?.balance_due, row?.amountDue, row?.amount_due, row?.dueAmount));

const optedOutOf = (row) => Boolean(
  row?.whatsapp_marketing_opt_out
  || row?.whatsappMarketingOptOut
  || row?.marketingOptOut
  || row?.doNotSendWhatsAppMarketing
  || ['opted_out', 'opted out', 'do not contact', 'disabled'].includes(lower(row?.marketingStatus || row?.whatsappMarketing))
);

const statusOf = (row) => lower(first(row?.contractStatus, row?.contract_status, row?.status, row?.accountStatus, row?.renewalStatus));

const latestDate = (rows) => list(rows)
  .map((row) => dateValue(...dateKeys.map((key) => row?.[key])))
  .filter(Boolean)
  .sort((a, b) => b - a)[0] || null;

const matchesText = (value, expected) => !text(expected) || lower(value).includes(lower(expected));
const withinDays = (date, days) => {
  if (!date) return false;
  const now = new Date();
  const diff = Math.ceil((date.getTime() - now.getTime()) / 86400000);
  return diff >= 0 && diff <= Number(days);
};

const isExpired = (date) => Boolean(date && date.getTime() < Date.now());
const hasActiveContract = (row) => {
  const status = statusOf(row);
  if (/(expired|cancel|inactive|closed|terminated)/i.test(status)) return false;
  if (/(active|renewed|ongoing|live)/i.test(status)) return true;
  const end = dateValue(renewalDateOf(row));
  return !end || !isExpired(end);
};

const normalizeRecord = (customer, related = {}) => {
  const customerId = idOf(customer);
  const relatedRows = [...list(related.renewals), ...list(related.jobs), ...list(related.invoices), ...list(related.payments)]
    .filter((row) => customerIdOf(row) && customerIdOf(row) === customerId);
  const services = [...new Set([serviceOf(customer), ...relatedRows.map(serviceOf)].filter(Boolean))];
  const renewalDate = dateValue(renewalDateOf(customer), ...related.renewals.map(renewalDateOf));
  const lastActivity = latestDate([customer, ...relatedRows]);
  const phone = phoneOf(customer);
  const phoneCheck = validatePhoneNumber(phone);
  return {
    id: customerId,
    customerId,
    name: nameOf(customer),
    phone,
    normalizedPhone: phoneCheck.ok ? phoneCheck.normalized : normalizePhoneNumber(phone),
    phoneValid: phoneCheck.ok,
    service: serviceOf(customer),
    services,
    area: areaOf(customer),
    city: cityOf(customer),
    state: stateOf(customer),
    salesPerson: salesPersonOf(customer),
    contractStatus: statusOf(customer) || 'unknown',
    renewalDate: renewalDate ? renewalDate.toISOString() : '',
    outstandingBalance: balanceOf(customer) + relatedRows.reduce((sum, row) => sum + balanceOf(row), 0),
    lastActivityAt: lastActivity ? lastActivity.toISOString() : '',
    optedOut: optedOutOf(customer)
  };
};

const resolveMarketingAudience = ({ customers = [], renewals = [], jobs = [], invoices = [], payments = [], filters = {}, previousCampaigns = [] } = {}) => {
  const related = { renewals, jobs, invoices, payments };
  const records = list(customers).map((customer) => normalizeRecord(customer, related));
  const serviceHas = lower(filters.hasService || filters.service || '');
  const serviceNot = lower(filters.doesNotHaveService || filters.serviceNot || '');
  const renewalWindow = Number(filters.renewalDays || filters.renewalWindow || 0);
  const dormantMonths = Number(filters.dormantMonths || 0);
  const contactDays = Number(filters.excludeRecentlyContactedDays || filters.recentContactDays || 0);
  const now = Date.now();
  const recentPhones = new Set();
  list(previousCampaigns).forEach((campaign) => {
    const sentAt = dateValue(campaign.completedAt, campaign.startedAt, campaign.createdAt);
    if (!sentAt || !contactDays || now - sentAt.getTime() > contactDays * 86400000) return;
    list(campaign.recipients).forEach((recipient) => {
      if (recipient?.status === 'sent' || !recipient?.status) recentPhones.add(normalizePhoneNumber(text(recipient.normalizedPhone || recipient.phone)) || text(recipient.normalizedPhone || recipient.phone));
    });
  });

  const matched = records.filter((record) => {
    const renewalDate = dateValue(record.renewalDate);
    const contract = lower(record.contractStatus);
    const renewalFilter = lower(filters.renewalStatus || filters.renewalAudience || '');
    if (filters.search && ![record.name, record.phone, record.service, record.area, record.city].some((value) => matchesText(value, filters.search))) return false;
    if (!matchesText(record.name, filters.customerName) || !matchesText(record.phone, filters.mobileNumber)) return false;
    if (!matchesText(record.service, filters.service) || !matchesText(record.area, filters.area) || !matchesText(record.city, filters.city) || !matchesText(record.state, filters.state)) return false;
    if (!matchesText(record.salesPerson, filters.salesPerson)) return false;
    if (filters.contractStatus && !contract.includes(lower(filters.contractStatus))) return false;
    if (filters.outstandingBalance && record.outstandingBalance < number(filters.outstandingBalance)) return false;
    if (filters.outstandingAudience === 'outstanding' && record.outstandingBalance <= 0) return false;
    if (filters.outstandingAudience === 'overdue' && !(record.outstandingBalance > 0 && renewalDate && isExpired(renewalDate))) return false;
    if (filters.contractAudience === 'active' && !hasActiveContract(record)) return false;
    if (filters.contractAudience === 'expired' && !isExpired(renewalDate) && !/(expired|inactive|closed|terminated)/i.test(contract)) return false;
    if (filters.contractAudience === 'expiring' && !withinDays(renewalDate, 60)) return false;
    if (filters.contractAudience === 'renewed' && !/(renewed)/i.test(contract)) return false;
    if (filters.contractAudience === 'without_active' && hasActiveContract(record)) return false;
    if (renewalFilter === 'expired' && !isExpired(renewalDate)) return false;
    if (renewalWindow && !withinDays(renewalDate, renewalWindow)) return false;
    if (serviceHas && !record.services.some((service) => lower(service).includes(serviceHas))) return false;
    if (serviceNot && record.services.some((service) => lower(service).includes(serviceNot))) return false;
    if (dormantMonths && record.lastActivityAt && now - new Date(record.lastActivityAt).getTime() < dormantMonths * 30 * 86400000) return false;
    if (dormantMonths && !record.lastActivityAt) return true;
    if (Array.isArray(filters.customerIds) && filters.customerIds.length && !filters.customerIds.map(String).includes(record.customerId)) return false;
    return true;
  });

  const stats = { matched: matched.length, missingPhone: 0, invalidPhone: 0, optedOut: 0, duplicateNumbers: 0, recentlyContacted: 0, finalRecipients: 0 };
  const seen = new Map();
  const recipients = [];
  const excluded = [];
  matched.forEach((record) => {
    if (!record.phone) { stats.missingPhone += 1; excluded.push({ ...record, status: 'skipped', skippedReason: 'missing_phone' }); return; }
    if (!record.phoneValid) { stats.invalidPhone += 1; excluded.push({ ...record, status: 'skipped', skippedReason: 'invalid_phone' }); return; }
    if (record.optedOut) { stats.optedOut += 1; excluded.push({ ...record, status: 'skipped', skippedReason: 'opted_out' }); return; }
    if (contactDays && recentPhones.has(record.normalizedPhone || record.phone)) { stats.recentlyContacted += 1; excluded.push({ ...record, status: 'skipped', skippedReason: 'recently_contacted' }); return; }
    const key = record.normalizedPhone || record.phone;
    if (seen.has(key)) { stats.duplicateNumbers += 1; excluded.push({ ...record, status: 'skipped', skippedReason: 'duplicate' }); return; }
    seen.set(key, record.customerId);
    recipients.push({ ...record, status: 'pending', skippedReason: '' });
  });
  stats.finalRecipients = recipients.length;
  return { records: matched, recipients, excluded, stats };
};

module.exports = { resolveMarketingAudience, normalizeMarketingRecord: normalizeRecord };
