const fs = require('fs');
const PDFDocument = require('pdfkit');

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const round2 = (value) => Number((toNumber(value, 0)).toFixed(2));

const ensureFile = (filePath, fallback) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
};

const nowIso = () => new Date().toISOString();

const properCase = (value) => normalizeText(value)
  .toLowerCase()
  .split(' ')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const collapseSpaces = (value) => normalizeText(value).replace(/\s+/g, ' ');

const normalizePhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
};

const normalizeEmail = (value) => normalizeLower(value);

const normalizeAddress = (value) => collapseSpaces(String(value || '').replace(/[\n\r,;]+/g, ' ')).toLowerCase();

const tokenize = (value) => normalizeLower(value)
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter((token) => token.length > 1);

const jaccardSimilarity = (a, b) => {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) intersection += 1;
  });
  const union = aTokens.size + bTokens.size - intersection;
  return union === 0 ? 0 : (intersection / union);
};

const bigramSet = (value) => {
  const text = normalizeLower(value).replace(/\s+/g, ' ').trim();
  if (text.length < 2) return new Set(text ? [text] : []);
  const set = new Set();
  for (let i = 0; i < text.length - 1; i += 1) {
    set.add(text.slice(i, i + 2));
  }
  return set;
};

const diceSimilarity = (a, b) => {
  const aSet = bigramSet(a);
  const bSet = bigramSet(b);
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let overlap = 0;
  aSet.forEach((item) => {
    if (bSet.has(item)) overlap += 1;
  });
  return (2 * overlap) / (aSet.size + bSet.size);
};

const combinedSimilarity = (a, b) => round2(((jaccardSimilarity(a, b) * 0.55) + (diceSimilarity(a, b) * 0.45)) * 100);

const toCsv = (rows) => {
  const esc = (value) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return rows.map((row) => row.map(esc).join(',')).join('\n');
};

const parseCsvLine = (line) => {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((v) => normalizeText(v));
};

const parseImportContent = ({ fileName, content }) => {
  const raw = String(content || '');
  const lower = normalizeLower(fileName);
  if (lower.endsWith('.json')) {
    const parsed = JSON.parse(raw);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}))));
    return { headers, rows };
  }

  const lines = raw.split(/\r?\n/).filter((line) => normalizeText(line).length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    return row;
  });
  return { headers, rows };
};

const inferMapping = (headers) => {
  const normalizedHeaders = (Array.isArray(headers) ? headers : []).map((header) => normalizeLower(header));
  const find = (patterns) => {
    const index = normalizedHeaders.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));
    return index >= 0 ? headers[index] : '';
  };
  return {
    customerName: find(['display name', 'customer name', 'name', 'contact person']),
    mobileNumber: find(['mobile', 'phone', 'workphone', 'work phone']),
    address: find(['billing address', 'address', 'street', 'location']),
    serviceType: find(['service type', 'segment', 'service']),
    email: find(['email']),
    companyName: find(['company']),
    billingArea: find(['billing area', 'area']),
    billingState: find(['billing state', 'state']),
    billingPincode: find(['billing pincode', 'pincode', 'zip'])
  };
};

const normalizeImportRow = (raw = {}, mapping = {}) => {
  const pick = (key, fallback = '') => {
    const sourceKey = mapping[key];
    if (sourceKey && raw[sourceKey] != null) return raw[sourceKey];
    return fallback;
  };

  const customerName = properCase(collapseSpaces(pick('customerName', raw.customerName || raw.name || raw.displayName || '')));
  const mobileNumber = normalizePhone(pick('mobileNumber', raw.mobileNumber || raw.workPhone || ''));
  const email = normalizeEmail(pick('email', raw.email || raw.emailId || ''));
  const address = collapseSpaces(pick('address', raw.billingAddress || raw.address || ''));
  const normalizedAddress = normalizeAddress(address);
  const serviceType = properCase(collapseSpaces(pick('serviceType', raw.serviceType || raw.segment || '')));
  const companyName = properCase(collapseSpaces(pick('companyName', raw.companyName || '')));
  const billingArea = properCase(collapseSpaces(pick('billingArea', raw.billingArea || raw.area || '')));
  const billingState = properCase(collapseSpaces(pick('billingState', raw.billingState || raw.state || '')));
  const billingPincode = normalizeText(pick('billingPincode', raw.billingPincode || raw.pincode || ''));

  const clean = {
    customerName,
    mobileNumber,
    email,
    address,
    normalizedAddress,
    serviceType,
    companyName,
    billingArea,
    billingState,
    billingPincode
  };

  const validationErrors = [];
  if (!clean.customerName) validationErrors.push('Customer name is required');
  if (!clean.mobileNumber) validationErrors.push('Mobile number is required');
  if (!clean.address) validationErrors.push('Address is required');
  if (!clean.serviceType) validationErrors.push('Service type is required');

  return {
    clean,
    validationErrors
  };
};

const customerDisplayName = (customer) => normalizeText(customer.displayName || customer.name || customer.contactPersonName || customer.companyName || '');

const normalizeExistingCustomer = (customer = {}) => {
  const displayName = customerDisplayName(customer);
  const mobile = normalizePhone(customer.mobileNumber || customer.workPhone || '');
  const email = normalizeEmail(customer.emailId || customer.email || '');
  const addressText = normalizeText(customer.billingAddress || customer.address || [customer.billingStreet1, customer.billingStreet2].filter(Boolean).join(', '));
  return {
    ...customer,
    _displayName: displayName,
    _normalizedName: normalizeLower(displayName),
    _mobile: mobile,
    _email: email,
    _address: addressText,
    _normalizedAddress: normalizeAddress(addressText)
  };
};

const dedupeScore = (importClean, existingCustomer) => {
  const reasons = [];
  let score = 0;
  let classification = 'New Customer';

  const phoneMatch = importClean.mobileNumber && existingCustomer._mobile && importClean.mobileNumber === existingCustomer._mobile;
  const emailMatch = importClean.email && existingCustomer._email && importClean.email === existingCustomer._email;
  const nameExact = importClean.customerName && existingCustomer._displayName && normalizeLower(importClean.customerName) === normalizeLower(existingCustomer._displayName);
  const addressExact = importClean.normalizedAddress && existingCustomer._normalizedAddress && importClean.normalizedAddress === existingCustomer._normalizedAddress;

  const nameSimilarity = combinedSimilarity(importClean.customerName, existingCustomer._displayName);
  const addressSimilarity = combinedSimilarity(importClean.address, existingCustomer._address);

  if (phoneMatch && nameExact) {
    score = 100;
    reasons.push('Same customer name + same phone');
  } else if (phoneMatch) {
    score = 100;
    reasons.push('Exact mobile number match');
    if (!nameExact) reasons.push('Same phone + different name (high-risk duplicate)');
  }

  if (emailMatch) {
    score = Math.max(score, 95);
    reasons.push('Exact email match');
  }

  if (nameExact && addressExact) {
    score = Math.max(score, 85);
    reasons.push('Same customer name + same address');
  }

  if (phoneMatch && addressExact) {
    score = Math.max(score, 100);
    reasons.push('Same phone + same address');
  }

  if (!phoneMatch && addressExact) {
    score = Math.max(score, 70);
    reasons.push('Same address + different phone (possible duplicate)');
  }

  if (nameSimilarity >= 80 && addressSimilarity >= 70) {
    score = Math.max(score, 75);
    reasons.push('Similar customer name + similar address');
  }

  if (score >= 95) classification = 'Exact Duplicate';
  else if (score >= 75) classification = 'Possible Duplicate';
  else if (score >= 60) classification = 'Needs Review';

  return {
    score,
    reasons: Array.from(new Set(reasons)),
    classification,
    nameSimilarity,
    addressSimilarity
  };
};

const decideSuggestedAction = ({ status, score }) => {
  if (status === 'Invalid Row') return 'skip';
  if (status === 'New Customer') return 'create_new';
  if (status === 'Exact Duplicate') return 'skip';
  if (status === 'Possible Duplicate') return score >= 90 ? 'merge_with_existing' : 'needs_review';
  if (status === 'Needs Review') return 'needs_review';
  return 'create_new';
};

const summarizeBatchRows = (rows) => {
  const summary = {
    totalRows: rows.length,
    newCustomers: 0,
    exactDuplicates: 0,
    possibleDuplicates: 0,
    needsReview: 0,
    invalidRows: 0,
    skippedRows: 0,
    mergedRecords: 0,
    updatedExisting: 0,
    importedAsNew: 0
  };

  rows.forEach((row) => {
    if (row.status === 'New Customer') summary.newCustomers += 1;
    if (row.status === 'Exact Duplicate') summary.exactDuplicates += 1;
    if (row.status === 'Possible Duplicate') summary.possibleDuplicates += 1;
    if (row.status === 'Needs Review') summary.needsReview += 1;
    if (row.status === 'Invalid Row') summary.invalidRows += 1;
    if (row.finalResult === 'skipped') summary.skippedRows += 1;
    if (row.finalResult === 'merged') summary.mergedRecords += 1;
    if (row.finalResult === 'updated') summary.updatedExisting += 1;
    if (row.finalResult === 'created') summary.importedAsNew += 1;
  });

  return summary;
};

const buildCustomerPayloadFromImport = (clean) => {
  const displayName = clean.customerName;
  const billingAddress = clean.address;
  return {
    displayName,
    name: displayName,
    segment: clean.serviceType || 'Residential',
    companyName: clean.companyName || displayName,
    contactPersonName: displayName,
    position: 'Owner',
    positionCustom: '',
    mobileNumber: clean.mobileNumber,
    whatsappNumber: clean.mobileNumber,
    altNumber: '',
    emailId: clean.email,
    email: clean.email,
    hasGst: false,
    gstRegistered: false,
    gstNumber: '',
    billingAttention: '',
    billingStreet1: '',
    billingStreet2: '',
    billingAddress,
    billingArea: clean.billingArea,
    billingState: clean.billingState || 'Delhi',
    billingPincode: clean.billingPincode,
    billingPhoneCode: '+91',
    billingPhone: clean.mobileNumber,
    shippingAttention: '',
    shippingStreet1: '',
    shippingStreet2: '',
    shippingAddress: billingAddress,
    shippingArea: clean.billingArea,
    shippingState: clean.billingState || 'Delhi',
    shippingPincode: clean.billingPincode,
    shippingPhoneCode: '+91',
    shippingPhone: clean.mobileNumber,
    area: clean.billingArea,
    state: clean.billingState || 'Delhi',
    pincode: clean.billingPincode,
    areaSqft: 0,
    workPhone: clean.mobileNumber,
    placeOfSupply: clean.billingState || 'Delhi',
    receivables: 0,
    unusedCredits: 0,
    active: true,
    dataQualityScore: 100
  };
};

const mergeUniqueText = (a, b) => {
  const seen = new Set();
  const out = [];
  [a, b].forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
};

function registerCustomerDedupModule({ app, readJsonFile, files }) {
  const {
    customersFile,
    invoicesFile,
    paymentsFile,
    jobsFile,
    renewalsFile,
    addressesFile,
    contactsFile,
    importBatchesFile,
    importRowsFile,
    duplicateMatchesFile,
    mergeHistoryFile,
    dedupAuditFile
  } = files;

  [
    [addressesFile, []],
    [contactsFile, []],
    [importBatchesFile, []],
    [importRowsFile, []],
    [duplicateMatchesFile, []],
    [mergeHistoryFile, []],
    [dedupAuditFile, []]
  ].forEach(([filePath, fallback]) => ensureFile(filePath, fallback));

  const getCustomers = () => readJsonFile(customersFile, []);
  const saveCustomers = (rows) => fs.writeFileSync(customersFile, JSON.stringify(rows, null, 2));
  const getInvoices = () => readJsonFile(invoicesFile, []);
  const saveInvoices = (rows) => fs.writeFileSync(invoicesFile, JSON.stringify(rows, null, 2));
  const getPayments = () => readJsonFile(paymentsFile, []);
  const savePayments = (rows) => fs.writeFileSync(paymentsFile, JSON.stringify(rows, null, 2));
  const getJobs = () => readJsonFile(jobsFile, []);
  const saveJobs = (rows) => fs.writeFileSync(jobsFile, JSON.stringify(rows, null, 2));
  const getRenewals = () => readJsonFile(renewalsFile, []);
  const saveRenewals = (rows) => fs.writeFileSync(renewalsFile, JSON.stringify(rows, null, 2));
  const getAddresses = () => readJsonFile(addressesFile, []);
  const saveAddresses = (rows) => fs.writeFileSync(addressesFile, JSON.stringify(rows, null, 2));
  const getContacts = () => readJsonFile(contactsFile, []);
  const saveContacts = (rows) => fs.writeFileSync(contactsFile, JSON.stringify(rows, null, 2));
  const getBatches = () => readJsonFile(importBatchesFile, []);
  const saveBatches = (rows) => fs.writeFileSync(importBatchesFile, JSON.stringify(rows, null, 2));
  const getImportRows = () => readJsonFile(importRowsFile, []);
  const saveImportRows = (rows) => fs.writeFileSync(importRowsFile, JSON.stringify(rows, null, 2));
  const getMatches = () => readJsonFile(duplicateMatchesFile, []);
  const saveMatches = (rows) => fs.writeFileSync(duplicateMatchesFile, JSON.stringify(rows, null, 2));
  const getMergeHistory = () => readJsonFile(mergeHistoryFile, []);
  const saveMergeHistory = (rows) => fs.writeFileSync(mergeHistoryFile, JSON.stringify(rows, null, 2));
  const getAudit = () => readJsonFile(dedupAuditFile, []);
  const saveAudit = (rows) => fs.writeFileSync(dedupAuditFile, JSON.stringify(rows, null, 2));

  const logAudit = (action, payload = {}, actor = 'System') => {
    const rows = getAudit();
    rows.push({
      _id: `CDA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action,
      actor,
      payload,
      createdAt: nowIso()
    });
    saveAudit(rows);
  };

  const syncCustomerAddressContact = (customer) => {
    const customerId = normalizeText(customer?._id);
    if (!customerId) return;

    const addresses = getAddresses().filter((entry) => normalizeText(entry.customerId) !== customerId);
    addresses.push({
      _id: `CAD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customerId,
      type: 'billing',
      address: normalizeText(customer.billingAddress),
      area: normalizeText(customer.billingArea || customer.area),
      state: normalizeText(customer.billingState || customer.state),
      pincode: normalizeText(customer.billingPincode || customer.pincode),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      active: true
    });

    if (normalizeText(customer.shippingAddress)) {
      addresses.push({
        _id: `CAD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-S`,
        customerId,
        type: 'shipping',
        address: normalizeText(customer.shippingAddress),
        area: normalizeText(customer.shippingArea),
        state: normalizeText(customer.shippingState),
        pincode: normalizeText(customer.shippingPincode),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        active: true
      });
    }
    saveAddresses(addresses);

    const contacts = getContacts().filter((entry) => normalizeText(entry.customerId) !== customerId);
    const contactRows = [];
    const pushContact = (type, value, primary = false) => {
      const text = normalizeText(value);
      if (!text) return;
      contactRows.push({
        _id: `CCN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${type}`,
        customerId,
        type,
        value: text,
        isPrimary: primary,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        active: true
      });
    };

    pushContact('mobile', customer.mobileNumber || customer.workPhone, true);
    pushContact('whatsapp', customer.whatsappNumber);
    pushContact('alternate_mobile', customer.altNumber);
    pushContact('email', customer.emailId || customer.email, true);

    const altMobiles = Array.isArray(customer.altMobileNumbers) ? customer.altMobileNumbers : [];
    altMobiles.forEach((entry) => pushContact('alternate_mobile', entry));
    const altEmails = Array.isArray(customer.altEmails) ? customer.altEmails : [];
    altEmails.forEach((entry) => pushContact('alternate_email', entry));

    saveContacts([...contacts, ...contactRows]);
  };

  const createCustomerRecord = (payload = {}) => {
    const customers = getCustomers();
    const displayName = normalizeText(payload.displayName || payload.name || payload.contactPersonName || payload.companyName || 'Customer');
    const billingState = normalizeText(payload.billingState || payload.state || payload.placeOfSupply || 'Delhi');
    const customer = {
      _id: `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...payload,
      name: displayName,
      displayName,
      companyName: normalizeText(payload.companyName || displayName),
      contactPersonName: normalizeText(payload.contactPersonName || displayName),
      mobileNumber: normalizePhone(payload.mobileNumber || payload.workPhone),
      workPhone: normalizePhone(payload.mobileNumber || payload.workPhone),
      whatsappNumber: normalizePhone(payload.whatsappNumber || payload.mobileNumber || payload.workPhone),
      altNumber: normalizePhone(payload.altNumber),
      emailId: normalizeEmail(payload.emailId || payload.email),
      email: normalizeEmail(payload.emailId || payload.email),
      billingAddress: normalizeText(payload.billingAddress),
      billingArea: normalizeText(payload.billingArea || payload.area),
      billingState,
      billingPincode: normalizeText(payload.billingPincode || payload.pincode),
      shippingAddress: normalizeText(payload.shippingAddress || payload.billingAddress),
      shippingArea: normalizeText(payload.shippingArea || payload.billingArea || payload.area),
      shippingState: normalizeText(payload.shippingState || billingState),
      shippingPincode: normalizeText(payload.shippingPincode || payload.billingPincode || payload.pincode),
      area: normalizeText(payload.area || payload.billingArea),
      state: billingState,
      pincode: normalizeText(payload.pincode || payload.billingPincode),
      placeOfSupply: billingState,
      active: payload.active !== false,
      isMerged: false,
      mergedInto: '',
      mergedAt: '',
      altMobileNumbers: Array.isArray(payload.altMobileNumbers) ? payload.altMobileNumbers : [],
      altEmails: Array.isArray(payload.altEmails) ? payload.altEmails : [],
      addressBook: Array.isArray(payload.addressBook) ? payload.addressBook : [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    customers.push(customer);
    saveCustomers(customers);
    syncCustomerAddressContact(customer);
    return customer;
  };

  const scoreAgainstExisting = (clean, existingCustomers) => {
    const normalizedExisting = existingCustomers.map((customer) => normalizeExistingCustomer(customer));
    const candidates = normalizedExisting
      .map((existing) => ({ existing, ...dedupeScore(clean, existing) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    const top = candidates[0] || null;
    if (!top) {
      return {
        status: 'New Customer',
        confidence: 0,
        matchedCustomerId: '',
        matchedCustomerName: '',
        matchReason: 'No matching customer found',
        possibleMatches: []
      };
    }

    return {
      status: top.classification,
      confidence: round2(top.score),
      matchedCustomerId: top.existing._id,
      matchedCustomerName: top.existing.displayName || top.existing.name || '',
      matchReason: top.reasons.join(' | ') || 'Similarity match',
      possibleMatches: candidates.slice(0, 5).map((entry) => ({
        customerId: entry.existing._id,
        customerName: entry.existing.displayName || entry.existing.name || '',
        score: round2(entry.score),
        reason: entry.reasons.join(' | ') || 'Similarity match',
        nameSimilarity: entry.nameSimilarity,
        addressSimilarity: entry.addressSimilarity,
        phone: entry.existing.mobileNumber || entry.existing.workPhone || '',
        email: entry.existing.emailId || entry.existing.email || ''
      }))
    };
  };

  const analyzeRows = ({ rawRows, mapping, batchId }) => {
    const customers = getCustomers().filter((entry) => entry.active !== false && !entry.isMerged);
    const analyzedRows = [];
    const allMatches = [];

    rawRows.forEach((raw, idx) => {
      const { clean, validationErrors } = normalizeImportRow(raw, mapping);
      let status = 'New Customer';
      let confidence = 0;
      let matchReason = 'No duplicate found';
      let matchedCustomerId = '';
      let matchedCustomerName = '';
      let possibleMatches = [];
      if (validationErrors.length > 0) {
        status = 'Invalid Row';
        confidence = 0;
        matchReason = validationErrors.join(' | ');
      } else {
        const scoreResult = scoreAgainstExisting(clean, customers);
        status = scoreResult.status;
        confidence = scoreResult.confidence;
        matchedCustomerId = scoreResult.matchedCustomerId;
        matchedCustomerName = scoreResult.matchedCustomerName;
        matchReason = scoreResult.matchReason;
        possibleMatches = scoreResult.possibleMatches;
      }

      const suggestedAction = decideSuggestedAction({ status, score: confidence });
      const rowId = `CIR-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
      analyzedRows.push({
        _id: rowId,
        batchId,
        rowNumber: idx + 1,
        raw,
        clean,
        validationErrors,
        status,
        matchedCustomerId,
        matchedCustomerName,
        matchReason,
        confidence,
        suggestedAction,
        selectedAction: suggestedAction,
        selectedTargetCustomerId: matchedCustomerId,
        selectedReason: '',
        finalResult: '',
        finalMessage: '',
        createdAt: nowIso(),
        updatedAt: nowIso()
      });

      possibleMatches.forEach((match) => {
        allMatches.push({
          _id: `CDM-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          batchId,
          importRowId: rowId,
          existingCustomerId: match.customerId,
          reason: match.reason,
          confidence: match.score,
          createdAt: nowIso()
        });
      });
    });

    return { analyzedRows, allMatches };
  };

  const updateImportRowAction = ({ rowId, action, targetCustomerId, reason }) => {
    const rows = getImportRows();
    const index = rows.findIndex((row) => normalizeText(row._id) === normalizeText(rowId));
    if (index < 0) return null;
    rows[index] = {
      ...rows[index],
      selectedAction: normalizeText(action || rows[index].selectedAction || 'needs_review'),
      selectedTargetCustomerId: normalizeText(targetCustomerId || rows[index].selectedTargetCustomerId || rows[index].matchedCustomerId || ''),
      selectedReason: normalizeText(reason || rows[index].selectedReason || ''),
      updatedAt: nowIso()
    };
    saveImportRows(rows);
    return rows[index];
  };

  const mergeCustomers = ({ sourceCustomerId, targetCustomerId, reason, actor = 'System', sourcePayload = null }) => {
    if (!sourceCustomerId || !targetCustomerId || sourceCustomerId === targetCustomerId) {
      return { ok: false, error: 'Source and target customer IDs are required and must be different.' };
    }

    const customers = getCustomers();
    const targetIndex = customers.findIndex((row) => normalizeText(row._id) === normalizeText(targetCustomerId));
    const sourceIndex = customers.findIndex((row) => normalizeText(row._id) === normalizeText(sourceCustomerId));

    if (targetIndex < 0) return { ok: false, error: 'Target customer not found' };
    if (sourceIndex < 0) return { ok: false, error: 'Source customer not found' };

    const target = { ...customers[targetIndex] };
    const source = { ...customers[sourceIndex] };

    target.altMobileNumbers = mergeUniqueText(target.altMobileNumbers?.join(','), [source.mobileNumber, source.workPhone, ...(source.altMobileNumbers || [])].join(','))
      .flatMap((entry) => String(entry).split(',').map((v) => normalizePhone(v)).filter(Boolean));
    target.altEmails = mergeUniqueText(target.altEmails?.join(','), [source.emailId, source.email, ...(source.altEmails || [])].join(','))
      .flatMap((entry) => String(entry).split(',').map((v) => normalizeEmail(v)).filter(Boolean));

    const sourceAddresses = [
      source.billingAddress,
      source.shippingAddress,
      ...(Array.isArray(source.addressBook) ? source.addressBook : [])
    ].filter(Boolean);
    const targetAddresses = [
      target.billingAddress,
      target.shippingAddress,
      ...(Array.isArray(target.addressBook) ? target.addressBook : [])
    ].filter(Boolean);
    target.addressBook = Array.from(new Set([...targetAddresses, ...sourceAddresses].map((entry) => normalizeText(entry)).filter(Boolean)));

    const latestValue = (current, incoming) => (normalizeText(current) ? current : incoming);
    target.companyName = latestValue(target.companyName, source.companyName);
    target.contactPersonName = latestValue(target.contactPersonName, source.contactPersonName);
    target.displayName = latestValue(target.displayName, source.displayName || source.name);
    target.name = target.displayName;
    target.billingArea = latestValue(target.billingArea, source.billingArea || source.area);
    target.billingState = latestValue(target.billingState, source.billingState || source.state);
    target.billingPincode = latestValue(target.billingPincode, source.billingPincode || source.pincode);
    target.updatedAt = nowIso();

    source.active = false;
    source.isMerged = true;
    source.mergedInto = target._id;
    source.mergedAt = nowIso();
    source.updatedAt = nowIso();
    source.mergeReason = normalizeText(reason || 'Merged as duplicate');

    customers[targetIndex] = target;
    customers[sourceIndex] = source;
    saveCustomers(customers);

    const invoices = getInvoices().map((invoice) => {
      const currentId = normalizeText(invoice.customerId);
      const sourceName = normalizeLower(source.displayName || source.name || source.companyName);
      const invoiceName = normalizeLower(invoice.customerName);
      if (currentId === normalizeText(source._id) || (sourceName && invoiceName === sourceName)) {
        return {
          ...invoice,
          customerId: target._id,
          customerName: target.displayName || target.name || invoice.customerName,
          updatedAt: nowIso()
        };
      }
      return invoice;
    });
    saveInvoices(invoices);

    const jobs = getJobs().map((job) => {
      const currentId = normalizeText(job.customerId);
      if (currentId === normalizeText(source._id)) {
        return {
          ...job,
          customerId: target._id,
          customerName: target.displayName || target.name || job.customerName,
          updatedAt: nowIso()
        };
      }
      return job;
    });
    saveJobs(jobs);

    const payments = getPayments().map((payment) => {
      const paymentName = normalizeLower(payment.customerName);
      const sourceName = normalizeLower(source.displayName || source.name || source.companyName);
      if (paymentName && sourceName && paymentName === sourceName) {
        return {
          ...payment,
          customerName: target.displayName || target.name || payment.customerName,
          updatedAt: nowIso()
        };
      }
      return payment;
    });
    savePayments(payments);

    const renewals = getRenewals().map((renewal) => {
      const currentId = normalizeText(renewal.customerId);
      if (currentId === normalizeText(source._id)) {
        return {
          ...renewal,
          customerId: target._id,
          customerName: target.displayName || target.name || renewal.customerName,
          updatedAt: nowIso()
        };
      }
      return renewal;
    });
    saveRenewals(renewals);

    syncCustomerAddressContact(target);

    const history = getMergeHistory();
    history.push({
      _id: `CMH-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceCustomerId: source._id,
      targetCustomerId: target._id,
      sourceSnapshot: source,
      targetSnapshot: target,
      reason: normalizeText(reason || 'Merged duplicate customer'),
      actor,
      createdAt: nowIso(),
      sourcePayload
    });
    saveMergeHistory(history);

    logAudit('customer_merged', {
      sourceCustomerId: source._id,
      targetCustomerId: target._id,
      reason: normalizeText(reason || 'Merged duplicate customer')
    }, actor);

    return { ok: true, target, source };
  };

  const updateExistingFromImport = ({ targetCustomerId, clean }) => {
    const customers = getCustomers();
    const index = customers.findIndex((row) => normalizeText(row._id) === normalizeText(targetCustomerId));
    if (index < 0) return { ok: false, error: 'Target customer not found' };

    const current = customers[index];
    const merged = {
      ...current,
      displayName: normalizeText(current.displayName || clean.customerName || current.name),
      name: normalizeText(current.name || clean.customerName || current.displayName),
      companyName: normalizeText(current.companyName || clean.companyName || clean.customerName),
      contactPersonName: normalizeText(current.contactPersonName || clean.customerName),
      mobileNumber: normalizePhone(current.mobileNumber || current.workPhone || clean.mobileNumber),
      workPhone: normalizePhone(current.workPhone || current.mobileNumber || clean.mobileNumber),
      whatsappNumber: normalizePhone(current.whatsappNumber || current.mobileNumber || clean.mobileNumber),
      emailId: normalizeEmail(current.emailId || current.email || clean.email),
      email: normalizeEmail(current.email || current.emailId || clean.email),
      billingAddress: normalizeText(current.billingAddress || clean.address),
      billingArea: normalizeText(current.billingArea || clean.billingArea),
      billingState: normalizeText(current.billingState || clean.billingState || 'Delhi'),
      billingPincode: normalizeText(current.billingPincode || clean.billingPincode),
      shippingAddress: normalizeText(current.shippingAddress || current.billingAddress || clean.address),
      shippingArea: normalizeText(current.shippingArea || current.billingArea || clean.billingArea),
      shippingState: normalizeText(current.shippingState || current.billingState || clean.billingState || 'Delhi'),
      shippingPincode: normalizeText(current.shippingPincode || current.billingPincode || clean.billingPincode),
      segment: normalizeText(current.segment || clean.serviceType || 'Residential'),
      updatedAt: nowIso()
    };

    if (clean.mobileNumber && clean.mobileNumber !== merged.mobileNumber) {
      const existing = new Set((merged.altMobileNumbers || []).map((entry) => normalizePhone(entry)).filter(Boolean));
      existing.add(clean.mobileNumber);
      merged.altMobileNumbers = Array.from(existing);
    }
    if (clean.email && clean.email !== merged.emailId) {
      const existing = new Set((merged.altEmails || []).map((entry) => normalizeEmail(entry)).filter(Boolean));
      existing.add(clean.email);
      merged.altEmails = Array.from(existing);
    }

    customers[index] = merged;
    saveCustomers(customers);
    syncCustomerAddressContact(merged);
    return { ok: true, customer: merged };
  };

  const applyImportRowAction = ({ row, actor }) => {
    const action = normalizeLower(row.selectedAction || row.suggestedAction || 'needs_review');

    if (row.status === 'Invalid Row') {
      return {
        ...row,
        finalResult: 'skipped',
        finalMessage: 'Skipped invalid row',
        updatedAt: nowIso()
      };
    }

    if (action === 'skip' || action === 'needs_review') {
      return {
        ...row,
        finalResult: 'skipped',
        finalMessage: action === 'needs_review' ? 'Skipped - needs review' : 'Skipped by admin',
        updatedAt: nowIso()
      };
    }

    if (action === 'create_new' || action === 'mark_different') {
      const payload = buildCustomerPayloadFromImport(row.clean);
      const created = createCustomerRecord(payload);
      logAudit('import_row_created_new_customer', {
        rowId: row._id,
        customerId: created._id,
        action
      }, actor);
      return {
        ...row,
        finalResult: 'created',
        finalMessage: `Created new customer ${created.displayName}`,
        selectedTargetCustomerId: created._id,
        updatedAt: nowIso()
      };
    }

    if (action === 'update_existing') {
      const targetId = normalizeText(row.selectedTargetCustomerId || row.matchedCustomerId);
      const updated = updateExistingFromImport({ targetCustomerId: targetId, clean: row.clean });
      if (!updated.ok) {
        return {
          ...row,
          finalResult: 'error',
          finalMessage: updated.error || 'Unable to update existing customer',
          updatedAt: nowIso()
        };
      }
      logAudit('import_row_updated_existing_customer', {
        rowId: row._id,
        targetCustomerId: targetId
      }, actor);
      return {
        ...row,
        finalResult: 'updated',
        finalMessage: `Updated customer ${updated.customer.displayName}`,
        selectedTargetCustomerId: targetId,
        updatedAt: nowIso()
      };
    }

    if (action === 'merge_with_existing') {
      const targetId = normalizeText(row.selectedTargetCustomerId || row.matchedCustomerId);
      let sourceCustomerId = '';
      const importedAsCustomer = createCustomerRecord(buildCustomerPayloadFromImport(row.clean));
      sourceCustomerId = importedAsCustomer._id;

      const mergeResult = mergeCustomers({
        sourceCustomerId,
        targetCustomerId: targetId,
        reason: normalizeText(row.selectedReason || row.matchReason || 'Merged during import dedupe'),
        actor,
        sourcePayload: row.clean
      });

      if (!mergeResult.ok) {
        return {
          ...row,
          finalResult: 'error',
          finalMessage: mergeResult.error || 'Merge failed',
          updatedAt: nowIso()
        };
      }

      return {
        ...row,
        finalResult: 'merged',
        finalMessage: `Merged into customer ${mergeResult.target.displayName || mergeResult.target.name}`,
        selectedTargetCustomerId: targetId,
        updatedAt: nowIso()
      };
    }

    return {
      ...row,
      finalResult: 'skipped',
      finalMessage: 'No action applied',
      updatedAt: nowIso()
    };
  };

  const refreshBatchStats = (batchId) => {
    const rows = getImportRows().filter((row) => normalizeText(row.batchId) === normalizeText(batchId));
    const batches = getBatches();
    const batchIndex = batches.findIndex((entry) => normalizeText(entry._id) === normalizeText(batchId));
    if (batchIndex < 0) return;
    batches[batchIndex] = {
      ...batches[batchIndex],
      stats: summarizeBatchRows(rows),
      updatedAt: nowIso()
    };
    saveBatches(batches);
  };

  const buildDuplicateReport = () => {
    const customers = getCustomers().filter((entry) => entry.active !== false && !entry.isMerged);
    const normalized = customers.map((entry) => normalizeExistingCustomer(entry));
    const pairs = [];

    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        const a = normalized[i];
        const b = normalized[j];
        const clean = {
          customerName: a._displayName,
          mobileNumber: a._mobile,
          email: a._email,
          address: a._address,
          normalizedAddress: a._normalizedAddress
        };
        const score = dedupeScore(clean, b);
        if (score.score < 75) continue;
        pairs.push({
          pairId: `${a._id}-${b._id}`,
          customerAId: a._id,
          customerAName: a._displayName,
          customerBId: b._id,
          customerBName: b._displayName,
          score: score.score,
          status: score.classification,
          reason: score.reasons.join(' | ') || 'Potential duplicate'
        });
      }
    }

    const high = pairs.filter((entry) => entry.score >= 95).length;
    const possible = pairs.filter((entry) => entry.score >= 75 && entry.score < 95).length;
    const healthPenalty = Math.min(80, (high * 5) + (possible * 2));
    const healthScore = Math.max(20, 100 - healthPenalty);

    const possibleCustomerIds = Array.from(new Set(
      pairs
        .filter((entry) => entry.score >= 75)
        .flatMap((entry) => [entry.customerAId, entry.customerBId])
    ));

    return {
      generatedAt: nowIso(),
      summary: {
        totalActiveCustomers: customers.length,
        exactDuplicatePairs: high,
        possibleDuplicatePairs: possible,
        customerDataHealthScore: healthScore
      },
      possibleDuplicateCustomerIds: possibleCustomerIds,
      rows: pairs.sort((a, b) => b.score - a.score)
    };
  };

  app.post('/api/customers/import/upload', (req, res) => {
    try {
      const fileName = normalizeText(req.body?.fileName || 'customers-import.csv');
      const content = String(req.body?.content || '');
      if (!content.trim()) return res.status(400).json({ error: 'Import file content is required' });

      const { headers, rows } = parseImportContent({ fileName, content });
      if (rows.length === 0) return res.status(400).json({ error: 'No import rows found' });

      const mapping = req.body?.mapping && typeof req.body.mapping === 'object'
        ? req.body.mapping
        : inferMapping(headers);

      const batchId = `CIB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const batch = {
        _id: batchId,
        fileName,
        status: 'Uploaded',
        headers,
        mapping,
        rawRows: rows,
        totalRows: rows.length,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        stats: {
          totalRows: rows.length,
          newCustomers: 0,
          exactDuplicates: 0,
          possibleDuplicates: 0,
          needsReview: 0,
          invalidRows: 0,
          skippedRows: 0,
          mergedRecords: 0,
          updatedExisting: 0,
          importedAsNew: 0
        }
      };

      const batches = getBatches();
      batches.push(batch);
      saveBatches(batches);

      const { analyzedRows, allMatches } = analyzeRows({ rawRows: rows, mapping, batchId });
      const importRows = getImportRows();
      saveImportRows([...importRows, ...analyzedRows]);
      const matches = getMatches();
      saveMatches([...matches, ...allMatches]);
      refreshBatchStats(batchId);
      logAudit('customer_import_uploaded', { batchId, fileName, totalRows: rows.length }, normalizeText(req.body?.actor || 'System'));

      const latestBatch = getBatches().find((entry) => normalizeText(entry._id) === batchId);
      const previewRows = analyzedRows.slice(0, 100);
      return res.json({
        message: 'Import uploaded and analyzed',
        batch: latestBatch,
        previewRows
      });
    } catch (error) {
      console.error('Import upload failed:', error.message);
      return res.status(500).json({ error: 'Unable to upload and analyze import file' });
    }
  });

  app.post('/api/customers/import/batches/:batchId/remap', (req, res) => {
    try {
      const batchId = normalizeText(req.params.batchId);
      const mapping = req.body?.mapping && typeof req.body.mapping === 'object' ? req.body.mapping : null;
      if (!mapping) return res.status(400).json({ error: 'mapping is required' });

      const batches = getBatches();
      const batchIndex = batches.findIndex((entry) => normalizeText(entry._id) === batchId);
      if (batchIndex < 0) return res.status(404).json({ error: 'Import batch not found' });

      const batch = batches[batchIndex];
      const rawRows = Array.isArray(batch.rawRows) ? batch.rawRows : [];
      const { analyzedRows, allMatches } = analyzeRows({ rawRows, mapping, batchId });

      const remainingRows = getImportRows().filter((row) => normalizeText(row.batchId) !== batchId);
      saveImportRows([...remainingRows, ...analyzedRows]);

      const remainingMatches = getMatches().filter((row) => normalizeText(row.batchId) !== batchId);
      saveMatches([...remainingMatches, ...allMatches]);

      batches[batchIndex] = {
        ...batch,
        mapping,
        status: 'Mapped',
        updatedAt: nowIso()
      };
      saveBatches(batches);
      refreshBatchStats(batchId);

      return res.json({
        message: 'Field mapping updated and preview regenerated',
        batch: getBatches().find((entry) => normalizeText(entry._id) === batchId),
        previewRows: analyzedRows.slice(0, 100)
      });
    } catch (error) {
      console.error('Batch remap failed:', error.message);
      return res.status(500).json({ error: 'Unable to remap import batch' });
    }
  });

  app.get('/api/customers/import/batches/:batchId/preview', (req, res) => {
    const batchId = normalizeText(req.params.batchId);
    const batch = getBatches().find((entry) => normalizeText(entry._id) === batchId);
    if (!batch) return res.status(404).json({ error: 'Import batch not found' });

    const rows = getImportRows().filter((row) => normalizeText(row.batchId) === batchId);
    const matches = getMatches().filter((row) => normalizeText(row.batchId) === batchId);
    return res.json({ batch, rows, matches });
  });

  app.get('/api/customers/import/batches', (req, res) => {
    const rows = getBatches().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json(rows);
  });

  app.post('/api/customers/import/rows/:rowId/action', (req, res) => {
    const row = updateImportRowAction({
      rowId: req.params.rowId,
      action: req.body?.action,
      targetCustomerId: req.body?.targetCustomerId,
      reason: req.body?.reason
    });
    if (!row) return res.status(404).json({ error: 'Import row not found' });
    refreshBatchStats(row.batchId);
    res.json(row);
  });

  app.post('/api/customers/import/rows/:rowId/skip', (req, res) => {
    const row = updateImportRowAction({ rowId: req.params.rowId, action: 'skip', reason: req.body?.reason || 'Skipped by admin' });
    if (!row) return res.status(404).json({ error: 'Import row not found' });
    refreshBatchStats(row.batchId);
    res.json(row);
  });

  app.post('/api/customers/import/batches/:batchId/confirm', (req, res) => {
    const batchId = normalizeText(req.params.batchId);
    const actor = normalizeText(req.body?.actor || 'System');
    const rows = getImportRows().filter((row) => normalizeText(row.batchId) === batchId);
    if (rows.length === 0) return res.status(404).json({ error: 'No import rows found for this batch' });

    const updatedRows = rows.map((row) => applyImportRowAction({ row, actor }));
    const allRows = getImportRows();
    const remaining = allRows.filter((row) => normalizeText(row.batchId) !== batchId);
    saveImportRows([...remaining, ...updatedRows]);

    const batches = getBatches();
    const batchIndex = batches.findIndex((entry) => normalizeText(entry._id) === batchId);
    if (batchIndex >= 0) {
      batches[batchIndex] = {
        ...batches[batchIndex],
        status: 'Completed',
        updatedAt: nowIso(),
        completedAt: nowIso(),
        stats: summarizeBatchRows(updatedRows)
      };
      saveBatches(batches);
    }

    logAudit('customer_import_confirmed', {
      batchId,
      stats: summarizeBatchRows(updatedRows)
    }, actor);

    res.json({
      message: 'Import batch processed successfully',
      batch: getBatches().find((entry) => normalizeText(entry._id) === batchId),
      rows: updatedRows
    });
  });

  app.post('/api/customers/merge', (req, res) => {
    const sourceCustomerId = normalizeText(req.body?.sourceCustomerId);
    const targetCustomerId = normalizeText(req.body?.targetCustomerId);
    const reason = normalizeText(req.body?.reason || 'Merged from duplicate tool');
    const actor = normalizeText(req.body?.actor || 'System');

    const result = mergeCustomers({ sourceCustomerId, targetCustomerId, reason, actor });
    if (!result.ok) return res.status(400).json({ error: result.error || 'Merge failed' });

    return res.json({
      message: 'Customers merged successfully',
      target: result.target,
      source: result.source
    });
  });

  app.get('/api/customers/similar-search', (req, res) => {
    const customerName = normalizeText(req.query.name || req.query.customerName || '');
    const mobile = normalizePhone(req.query.mobile || req.query.mobileNumber || '');
    const address = normalizeText(req.query.address || req.query.billingAddress || '');
    const queryClean = {
      customerName: properCase(customerName),
      mobileNumber: mobile,
      email: normalizeEmail(req.query.email || req.query.emailId || ''),
      address,
      normalizedAddress: normalizeAddress(address)
    };

    const customers = getCustomers().filter((entry) => entry.active !== false && !entry.isMerged);
    const candidates = customers
      .map((entry) => {
        const normalized = normalizeExistingCustomer(entry);
        const score = dedupeScore(queryClean, normalized);
        return {
          customerId: entry._id,
          customerName: entry.displayName || entry.name || '',
          mobileNumber: entry.mobileNumber || entry.workPhone || '',
          email: entry.emailId || entry.email || '',
          address: entry.billingAddress || '',
          confidence: score.score,
          status: score.classification,
          reason: score.reasons.join(' | ')
        };
      })
      .filter((entry) => entry.confidence >= 60)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    res.json({
      query: queryClean,
      rows: candidates
    });
  });

  app.get('/api/customers/duplicates/report', async (req, res) => {
    try {
      const report = buildDuplicateReport();
      const format = normalizeLower(req.query.format || 'json');

      if (format === 'csv' || format === 'excel') {
        const csv = toCsv([
          ['Customer A ID', 'Customer A', 'Customer B ID', 'Customer B', 'Score', 'Status', 'Reason'],
          ...report.rows.map((row) => [row.customerAId, row.customerAName, row.customerBId, row.customerBName, row.score, row.status, row.reason])
        ]);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="customer_duplicate_report_${new Date().toISOString().slice(0, 10)}.csv"`);
        return res.send(csv);
      }

      if (format === 'pdf') {
        const doc = new PDFDocument({ size: 'A4', margin: 36 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="customer_duplicate_report_${new Date().toISOString().slice(0, 10)}.pdf"`);
          res.send(buffer);
        });

        doc.font('Helvetica-Bold').fontSize(16).text('SKUAS Pest Control - Duplicate Customer Report', 36, 36);
        doc.font('Helvetica').fontSize(10).text(`Generated: ${new Date().toLocaleString('en-IN')}`, 36, 58);
        doc.text(`Data Health Score: ${report.summary.customerDataHealthScore}`, 36, 72);
        doc.moveTo(36, 88).lineTo(559, 88).strokeColor('#cbd5e1').stroke();

        let y = 100;
        report.rows.slice(0, 180).forEach((row, idx) => {
          if (y > 780) {
            doc.addPage();
            y = 48;
          }
          doc.font('Helvetica').fontSize(8).text(`${idx + 1}. ${row.customerAName} (${row.customerAId}) <-> ${row.customerBName} (${row.customerBId}) | ${row.score}% | ${row.reason}`, 36, y, { width: 523 });
          y += 12;
        });

        doc.end();
        return null;
      }

      return res.json(report);
    } catch (error) {
      console.error('Duplicate report failed:', error.message);
      return res.status(500).json({ error: 'Unable to generate duplicate report' });
    }
  });

  app.get('/api/customers/import/sample', (req, res) => {
    const csv = [
      ['customerName', 'mobileNumber', 'email', 'address', 'serviceType', 'companyName', 'billingArea', 'billingState', 'billingPincode'].join(','),
      ['Priya Jain', '9810783477', 'priya@example.com', '22 Ground Floor Sarai Jullena', 'Residential', 'N/A', 'Sarai Jullena', 'Delhi', '110025'].join(','),
      ['Trimaster Private Limited', '9667959373', 'accounts@trimaster.com', '222 Okhla Phase-3 New Delhi', 'Commercial', 'Trimaster Private Limited', 'Okhla', 'Delhi', '110020'].join(',')
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers-import-sample-dedupe.csv"');
    res.send(csv);
  });
}

module.exports = {
  registerCustomerDedupModule
};
