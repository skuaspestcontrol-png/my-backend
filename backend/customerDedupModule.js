const fs = require('fs');
const zlib = require('zlib');
const PDFDocument = require('pdfkit');

const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const toNullableNumber = (value) => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

const parseJsonPayload = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
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

const parseXmlAttrs = (text = '') => {
  const attrs = {};
  String(text).replace(/([\w:.-]+)="([^"]*)"/g, (_match, key, value) => {
    attrs[key] = value;
    return '';
  });
  return attrs;
};

const decodeXml = (value = '') => String(value)
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

const columnIndexFromRef = (cellRef = '') => {
  const letters = String(cellRef || '').match(/[A-Z]+/i)?.[0] || '';
  if (!letters) return -1;
  return letters.toUpperCase().split('').reduce((sum, ch) => (sum * 26) + ch.charCodeAt(0) - 64, 0) - 1;
};

const readZipEntries = (buffer) => {
  const entries = {};
  const eocdSig = 0x06054b50;
  let eocdOffset = -1;
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new Error('Invalid XLSX file');
  for (let i = Math.max(0, buffer.length - 22); i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSig) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Invalid XLSX file');

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42);
    const fileName = buffer.slice(centralOffset + 46, centralOffset + 46 + fileNameLength).toString('utf8');

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? zlib.inflateRawSync(compressed) : null;
    if (data) entries[fileName.replace(/^\/+/, '')] = data;

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
};

const parseXlsxContent = (content, contentEncoding = '') => {
  const buffer = Buffer.from(String(content || ''), normalizeLower(contentEncoding) === 'base64' ? 'base64' : 'binary');
  const entries = readZipEntries(buffer);
  const sharedXml = entries['xl/sharedStrings.xml']?.toString('utf8') || '';
  const sharedStrings = [];
  sharedXml.replace(/<si\b[\s\S]*?<\/si>/g, (si) => {
    const text = Array.from(si.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map((match) => decodeXml(match[1])).join('');
    sharedStrings.push(text);
    return '';
  });

  const workbookRels = entries['xl/_rels/workbook.xml.rels']?.toString('utf8') || '';
  const relTargets = {};
  workbookRels.replace(/<Relationship\b([^>]*)\/?>/g, (_match, attrText) => {
    const attrs = parseXmlAttrs(attrText);
    if (attrs.Id && attrs.Target) relTargets[attrs.Id] = attrs.Target;
    return '';
  });

  const workbookXml = entries['xl/workbook.xml']?.toString('utf8') || '';
  const firstSheetAttrs = parseXmlAttrs(workbookXml.match(/<sheet\b([^>]*)\/?>/)?.[1] || '');
  const relId = firstSheetAttrs['r:id'];
  const target = relTargets[relId] || 'worksheets/sheet1.xml';
  const sheetPath = `xl/${target.replace(/^\/?xl\//, '').replace(/^\/+/, '')}`;
  const sheetXml = (entries[sheetPath] || entries['xl/worksheets/sheet1.xml'])?.toString('utf8') || '';
  if (!sheetXml) return { headers: [], rows: [] };

  const sheetRows = [];
  sheetXml.replace(/<row\b[^>]*>([\s\S]*?)<\/row>/g, (_rowMatch, rowBody) => {
    const values = [];
    let nextIndex = 0;
    rowBody.replace(/<c\b([^>]*)>([\s\S]*?)<\/c>/g, (_cellMatch, attrText, cellBody) => {
      const attrs = parseXmlAttrs(attrText);
      const index = columnIndexFromRef(attrs.r) >= 0 ? columnIndexFromRef(attrs.r) : nextIndex;
      nextIndex = index + 1;
      const rawValue = cellBody.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? cellBody.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '';
      const decoded = decodeXml(rawValue);
      values[index] = attrs.t === 's' ? sharedStrings[Number(decoded)] || '' : decoded;
      return '';
    });
    if (values.some((value) => normalizeText(value))) sheetRows.push(values.map((value) => normalizeText(value)));
    return '';
  });

  const headers = sheetRows[0] || [];
  const rows = sheetRows.slice(1).map((values) => {
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    return row;
  });
  return { headers, rows };
};

const parseImportContent = ({ fileName, content, contentEncoding }) => {
  const raw = String(content || '');
  const lower = normalizeLower(fileName);
  if (lower.endsWith('.xlsx')) {
    return parseXlsxContent(content, contentEncoding);
  }
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

const mergeMappingWithInferred = (headers, providedMapping) => {
  const inferred = inferMapping(headers);
  if (!providedMapping || typeof providedMapping !== 'object') return inferred;
  return Object.keys(inferred).reduce((acc, key) => {
    acc[key] = normalizeText(providedMapping[key]) || inferred[key] || '';
    return acc;
  }, {});
};

const inferMapping = (headers) => {
  const normalizedHeaders = (Array.isArray(headers) ? headers : []).map((header) => normalizeLower(header));
  const find = (patterns) => {
    const index = normalizedHeaders.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));
    return index >= 0 ? headers[index] : '';
  };
  return {
    segment: find(['segment', 'service type', 'service']),
    companyName: find(['company name', 'company']),
    contactPersonName: find(['contact person name', 'contact person']),
    displayName: find(['display name']),
    position: find(['position', 'designation']),
    positionCustom: find(['position custom', 'custom position']),
    customerName: find(['display name', 'customer name', 'name', 'contact person']),
    mobileNumber: find(['mobile', 'phone', 'workphone', 'work phone']),
    whatsappSameAsMobile: find(['whatsapp same']),
    whatsappNumber: find(['whatsapp']),
    altNumber: find(['alt number', 'alternate mobile', 'alternate phone']),
    email: find(['email']),
    emailId: find(['email id', 'email']),
    hasGst: find(['gst registered', 'has gst']),
    gstNumber: find(['gst number', 'gstin']),
    billingAttention: find(['billing attention']),
    billingStreet1: find(['billing street 1', 'street 1']),
    billingStreet2: find(['billing street 2', 'street 2']),
    billingAddress: find(['billing address', 'address', 'location']),
    address: find(['billing address', 'address', 'street', 'location']),
    billingArea: find(['billing area', 'area']),
    billingState: find(['billing state', 'state']),
    billingPincode: find(['billing pincode', 'pincode', 'zip']),
    billingPhoneCode: find(['billing phone code']),
    billingPhone: find(['billing phone']),
    shippingSameAsBilling: find(['shipping same']),
    shippingAttention: find(['shipping attention']),
    shippingStreet1: find(['shipping street 1']),
    shippingStreet2: find(['shipping street 2']),
    shippingAddress: find(['shipping address']),
    shippingArea: find(['shipping area']),
    shippingState: find(['shipping state']),
    shippingPincode: find(['shipping pincode']),
    shippingPhoneCode: find(['shipping phone code']),
    shippingPhone: find(['shipping phone']),
    areaSqft: find(['area in sqft', 'area sqft', 'sqft']),
    googlePlaceId: find(['google place id']),
    googlePlaceName: find(['google place name']),
    googlePhone: find(['google phone']),
    googleWebsite: find(['google website']),
    latitude: find(['latitude']),
    longitude: find(['longitude']),
    serviceType: find(['service type', 'segment', 'service'])
  };
};

const normalizeImportRow = (raw = {}, mapping = {}) => {
  const pick = (key, fallback = '') => {
    const sourceKey = mapping[key];
    if (sourceKey && raw[sourceKey] != null) return raw[sourceKey];
    return fallback;
  };

  const boolValue = (value) => {
    const text = normalizeLower(value);
    return ['1', 'true', 'yes', 'y', 'same'].includes(text);
  };

  const displayName = properCase(collapseSpaces(pick('displayName', raw.displayName || raw.name || '')));
  const contactPersonName = properCase(collapseSpaces(pick('contactPersonName', raw.contactPersonName || raw.customerName || raw.name || '')));
  const companyName = properCase(collapseSpaces(pick('companyName', raw.companyName || '')));
  const customerName = properCase(collapseSpaces(pick('customerName', raw.customerName || raw.name || displayName || contactPersonName || companyName || '')));
  const mobileNumber = normalizePhone(pick('mobileNumber', raw.mobileNumber || raw.workPhone || ''));
  const whatsappNumber = normalizePhone(pick('whatsappNumber', raw.whatsappNumber || raw.whatsapp || mobileNumber));
  const altNumber = normalizePhone(pick('altNumber', raw.altNumber || raw.alternateMobile || raw.alternatePhone || ''));
  const email = normalizeEmail(pick('email', pick('emailId', raw.email || raw.emailId || '')));
  const billingStreet1 = collapseSpaces(pick('billingStreet1', raw.billingStreet1 || raw.street1 || ''));
  const billingStreet2 = collapseSpaces(pick('billingStreet2', raw.billingStreet2 || raw.street2 || ''));
  const address = collapseSpaces(pick('address', pick('billingAddress', raw.billingAddress || raw.address || [billingStreet1, billingStreet2].filter(Boolean).join(', '))));
  const normalizedAddress = normalizeAddress(address);
  const segment = properCase(collapseSpaces(pick('segment', pick('serviceType', raw.segment || raw.serviceType || '')))) || 'Residential';
  const billingArea = properCase(collapseSpaces(pick('billingArea', raw.billingArea || raw.area || '')));
  const billingState = properCase(collapseSpaces(pick('billingState', raw.billingState || raw.state || '')));
  const billingPincode = normalizeText(pick('billingPincode', raw.billingPincode || raw.pincode || ''));
  const shippingSameAsBilling = boolValue(pick('shippingSameAsBilling', raw.shippingSameAsBilling || ''));
  const shippingStreet1 = collapseSpaces(pick('shippingStreet1', raw.shippingStreet1 || ''));
  const shippingStreet2 = collapseSpaces(pick('shippingStreet2', raw.shippingStreet2 || ''));
  const shippingAddress = collapseSpaces(pick('shippingAddress', raw.shippingAddress || '')) || (shippingSameAsBilling ? address : '');
  const shippingArea = properCase(collapseSpaces(pick('shippingArea', raw.shippingArea || ''))) || (shippingSameAsBilling ? billingArea : '');
  const shippingState = properCase(collapseSpaces(pick('shippingState', raw.shippingState || ''))) || (shippingSameAsBilling ? billingState : '');
  const shippingPincode = normalizeText(pick('shippingPincode', raw.shippingPincode || '')) || (shippingSameAsBilling ? billingPincode : '');
  const gstNumber = normalizeText(pick('gstNumber', raw.gstNumber || raw.gstin || '')).toUpperCase();
  const hasGst = boolValue(pick('hasGst', raw.hasGst || raw.gstRegistered || '')) || !!gstNumber;

  const clean = {
    segment,
    companyName,
    contactPersonName,
    displayName: displayName || customerName || companyName || contactPersonName,
    position: normalizeText(pick('position', raw.position || 'Owner')) || 'Owner',
    positionCustom: normalizeText(pick('positionCustom', raw.positionCustom || '')),
    customerName,
    mobileNumber,
    whatsappSameAsMobile: boolValue(pick('whatsappSameAsMobile', raw.whatsappSameAsMobile || '')) || whatsappNumber === mobileNumber,
    whatsappNumber,
    altNumber,
    email,
    emailId: email,
    hasGst,
    gstRegistered: hasGst,
    gstNumber: hasGst ? gstNumber : '',
    billingAttention: properCase(collapseSpaces(pick('billingAttention', raw.billingAttention || ''))),
    billingStreet1,
    billingStreet2,
    billingAddress: address,
    address,
    normalizedAddress,
    serviceType: segment,
    billingArea,
    billingState,
    billingPincode,
    billingPhoneCode: normalizeText(pick('billingPhoneCode', raw.billingPhoneCode || '+91')) || '+91',
    billingPhone: normalizePhone(pick('billingPhone', raw.billingPhone || mobileNumber)),
    shippingSameAsBilling,
    shippingAttention: properCase(collapseSpaces(pick('shippingAttention', raw.shippingAttention || ''))),
    shippingStreet1,
    shippingStreet2,
    shippingAddress,
    normalizedShippingAddress: normalizeAddress(shippingAddress),
    shippingArea,
    shippingState,
    shippingPincode,
    shippingPhoneCode: normalizeText(pick('shippingPhoneCode', raw.shippingPhoneCode || '+91')) || '+91',
    shippingPhone: normalizePhone(pick('shippingPhone', raw.shippingPhone || mobileNumber)),
    areaSqft: toNumber(pick('areaSqft', raw.areaSqft || 0), 0),
    googlePlaceId: normalizeText(pick('googlePlaceId', raw.googlePlaceId || raw.google_place_id || '')),
    googlePlaceName: normalizeText(pick('googlePlaceName', raw.googlePlaceName || raw.google_place_name || '')),
    googlePhone: normalizeText(pick('googlePhone', raw.googlePhone || raw.google_phone || '')),
    googleWebsite: normalizeText(pick('googleWebsite', raw.googleWebsite || raw.google_website || '')),
    latitude: normalizeText(pick('latitude', raw.latitude || '')),
    longitude: normalizeText(pick('longitude', raw.longitude || ''))
  };

  const validationErrors = [];
  if (!clean.customerName) validationErrors.push('Customer name is required');
  if (!clean.mobileNumber) validationErrors.push('Mobile number is required');
  if (!clean.billingAddress) validationErrors.push('Billing address is required');
  if (!clean.segment) validationErrors.push('Segment is required');

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
  const shippingAddressText = normalizeText(customer.shippingAddress || [customer.shippingStreet1, customer.shippingStreet2].filter(Boolean).join(', '));
  const nameKeys = [
    displayName,
    customer.name,
    customer.companyName,
    customer.contactPersonName
  ].map((value) => normalizeLower(value)).filter(Boolean);
  return {
    ...customer,
    _displayName: displayName,
    _normalizedName: normalizeLower(displayName),
    _nameKeys: Array.from(new Set(nameKeys)),
    _mobile: mobile,
    _email: email,
    _address: addressText,
    _normalizedAddress: normalizeAddress(addressText),
    _shippingAddress: shippingAddressText,
    _normalizedShippingAddress: normalizeAddress(shippingAddressText)
  };
};

const dedupeScore = (importClean, existingCustomer) => {
  const reasons = [];
  let score = 0;
  let classification = 'New Customer';

  const phoneMatch = importClean.mobileNumber && existingCustomer._mobile && importClean.mobileNumber === existingCustomer._mobile;
  const emailMatch = importClean.email && existingCustomer._email && importClean.email === existingCustomer._email;
  const importNameKeys = [
    importClean.customerName,
    importClean.displayName,
    importClean.companyName,
    importClean.contactPersonName
  ].map((value) => normalizeLower(value)).filter(Boolean);
  const existingNameKeys = Array.isArray(existingCustomer._nameKeys) && existingCustomer._nameKeys.length
    ? existingCustomer._nameKeys
    : [normalizeLower(existingCustomer._displayName)].filter(Boolean);
  const nameExact = importNameKeys.some((name) => existingNameKeys.includes(name));
  const addressExact = importClean.normalizedAddress && existingCustomer._normalizedAddress && importClean.normalizedAddress === existingCustomer._normalizedAddress;
  const shippingAddressExact = importClean.normalizedShippingAddress
    && (importClean.normalizedShippingAddress === existingCustomer._normalizedShippingAddress || importClean.normalizedShippingAddress === existingCustomer._normalizedAddress);

  const nameSimilarity = combinedSimilarity(importClean.customerName, existingCustomer._displayName);
  const addressSimilarity = combinedSimilarity(importClean.address, existingCustomer._address);

  if (phoneMatch && nameExact) {
    score = 100;
    reasons.push('Same customer name + same phone');
  } else if (phoneMatch) {
    score = 100;
    reasons.push('Exact mobile number match');
    if (!nameExact) reasons.push('Same phone + different name (high-risk duplicate)');
  } else if (nameExact) {
    score = Math.max(score, 90);
    reasons.push('Exact company/customer name match');
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

  const sameCustomerDifferentAddress = (phoneMatch || emailMatch || nameExact)
    && (
      (importClean.normalizedAddress && existingCustomer._normalizedAddress && !addressExact && addressSimilarity < 90)
      || (importClean.normalizedShippingAddress && !shippingAddressExact)
    );
  if (sameCustomerDifferentAddress) {
    score = Math.max(score, 90);
    classification = 'Possible Duplicate';
    reasons.push('Same customer with different address - add as new premise');
  }

  return {
    score,
    reasons: Array.from(new Set(reasons)),
    classification,
    nameSimilarity,
    addressSimilarity,
    sameCustomerDifferentAddress
  };
};

const decideSuggestedAction = ({ status, score, sameCustomerDifferentAddress = false }) => {
  if (status === 'Invalid Row') return 'skip';
  if (status === 'New Customer') return 'create_new';
  if (sameCustomerDifferentAddress) return 'add_address';
  if (status === 'Exact Duplicate') return 'merge_with_existing';
  if (status === 'Possible Duplicate') return score >= 75 ? 'merge_with_existing' : 'needs_review';
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
    importedAsNew: 0,
    newPremisesAdded: 0,
    failedRows: 0
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
    if (row.finalResult === 'error') summary.failedRows += 1;
    summary.newPremisesAdded += Number(row.addedPremisesCount || 0);
  });

  return summary;
};

const buildCustomerPayloadFromImport = (clean) => {
  const displayName = clean.displayName || clean.customerName || clean.companyName || clean.contactPersonName;
  const billingAddress = clean.billingAddress || clean.address;
  const shippingSameAsBilling = !!clean.shippingSameAsBilling || !clean.shippingAddress;
  return {
    displayName,
    name: displayName,
    segment: clean.segment || clean.serviceType || 'Residential',
    companyName: clean.companyName || displayName,
    contactPersonName: clean.contactPersonName || displayName,
    position: clean.position || 'Owner',
    positionCustom: clean.positionCustom || '',
    mobileNumber: clean.mobileNumber,
    whatsappSameAsMobile: !!clean.whatsappSameAsMobile,
    whatsappNumber: clean.whatsappNumber || clean.mobileNumber,
    altNumber: clean.altNumber || '',
    emailId: clean.email,
    email: clean.email,
    hasGst: !!clean.hasGst,
    gstRegistered: !!clean.hasGst,
    gstNumber: clean.hasGst ? (clean.gstNumber || '') : '',
    billingAttention: clean.billingAttention || '',
    billingStreet1: clean.billingStreet1 || billingAddress,
    billingStreet2: clean.billingStreet2 || '',
    billingAddress,
    billingArea: clean.billingArea,
    billingState: clean.billingState || 'Delhi',
    billingPincode: clean.billingPincode,
    billingPhoneCode: clean.billingPhoneCode || '+91',
    billingPhone: clean.billingPhone || clean.mobileNumber,
    shippingSameAsBilling,
    shippingAttention: clean.shippingAttention || (shippingSameAsBilling ? clean.billingAttention : ''),
    shippingStreet1: clean.shippingStreet1 || (shippingSameAsBilling ? clean.billingStreet1 : ''),
    shippingStreet2: clean.shippingStreet2 || (shippingSameAsBilling ? clean.billingStreet2 : ''),
    shippingAddress: clean.shippingAddress || billingAddress,
    shippingArea: clean.shippingArea || (shippingSameAsBilling ? clean.billingArea : ''),
    shippingState: clean.shippingState || (shippingSameAsBilling ? clean.billingState : '') || 'Delhi',
    shippingPincode: clean.shippingPincode || (shippingSameAsBilling ? clean.billingPincode : ''),
    shippingPhoneCode: clean.shippingPhoneCode || '+91',
    shippingPhone: clean.shippingPhone || clean.mobileNumber,
    area: clean.billingArea,
    state: clean.billingState || 'Delhi',
    pincode: clean.billingPincode,
    areaSqft: clean.areaSqft || 0,
    workPhone: clean.mobileNumber,
    placeOfSupply: clean.billingState || 'Delhi',
    googlePlaceId: clean.googlePlaceId || '',
    googlePlaceName: clean.googlePlaceName || '',
    googlePhone: clean.googlePhone || '',
    googleWebsite: clean.googleWebsite || '',
    latitude: clean.latitude || '',
    longitude: clean.longitude || '',
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

function registerCustomerDedupModule({ app, readJsonFile, files, mysql = {}, uploadMiddleware = null }) {
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

  const persistCustomerToMysql = async (customer) => {
    if (!customer || typeof customer !== 'object') return false;
    if (typeof mysql.canUseMysql !== 'function' || !mysql.canUseMysql()) return false;
    if (typeof mysql.withMysqlConnection !== 'function') return false;

    await mysql.withMysqlConnection(async (conn) => {
      if (typeof mysql.ensureCustomerPlaceColumns === 'function') {
        await mysql.ensureCustomerPlaceColumns(conn);
      }
      await conn.query(
        `INSERT INTO customers (
          external_id, display_name, customer_name, company_name, contact_person_name, mobile_number,
          whatsapp_number, email_id, area_name, city, state, pincode,
          google_place_id, google_place_name, google_phone, google_website, latitude, longitude,
          payload, source_created_at, source_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          display_name=VALUES(display_name),
          customer_name=VALUES(customer_name),
          company_name=VALUES(company_name),
          contact_person_name=VALUES(contact_person_name),
          mobile_number=VALUES(mobile_number),
          whatsapp_number=VALUES(whatsapp_number),
          email_id=VALUES(email_id),
          area_name=VALUES(area_name),
          city=VALUES(city),
          state=VALUES(state),
          pincode=VALUES(pincode),
          google_place_id=VALUES(google_place_id),
          google_place_name=VALUES(google_place_name),
          google_phone=VALUES(google_phone),
          google_website=VALUES(google_website),
          latitude=VALUES(latitude),
          longitude=VALUES(longitude),
          payload=VALUES(payload),
          source_created_at=VALUES(source_created_at),
          source_updated_at=VALUES(source_updated_at)`,
        [
          normalizeText(customer._id) || `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          normalizeText(customer.displayName || customer.name) || null,
          normalizeText(customer.name || customer.displayName) || null,
          normalizeText(customer.companyName) || null,
          normalizeText(customer.contactPersonName) || null,
          normalizePhone(customer.mobileNumber || customer.workPhone) || null,
          normalizePhone(customer.whatsappNumber) || null,
          normalizeEmail(customer.emailId || customer.email) || null,
          normalizeText(customer.billingArea || customer.area) || null,
          normalizeText(customer.city) || null,
          normalizeText(customer.state || customer.billingState) || null,
          normalizeText(customer.pincode || customer.billingPincode) || null,
          normalizeText(customer.googlePlaceId || customer.google_place_id) || null,
          normalizeText(customer.googlePlaceName || customer.google_place_name) || null,
          normalizeText(customer.googlePhone || customer.google_phone) || null,
          normalizeText(customer.googleWebsite || customer.google_website) || null,
          toNullableNumber(customer.latitude),
          toNullableNumber(customer.longitude),
          JSON.stringify(customer),
          customer.createdAt ? new Date(customer.createdAt) : new Date(),
          customer.updatedAt ? new Date(customer.updatedAt) : new Date()
        ]
      );
    });
    return true;
  };

  const fetchCustomersForDedupe = async () => {
    if (typeof mysql.canUseMysql === 'function' && mysql.canUseMysql() && typeof mysql.withMysqlConnection === 'function') {
      try {
        const mysqlRows = await mysql.withMysqlConnection(async (conn) => {
          const [rows] = await conn.query('SELECT id, external_id, payload FROM customers ORDER BY id DESC');
          return Array.isArray(rows) ? rows : [];
        });
        if (mysqlRows.length) {
          return mysqlRows
            .map((row) => {
              const payload = parseJsonPayload(row.payload, {});
              const externalId = normalizeText(row.external_id || payload._id || row.id);
              return externalId ? { ...payload, _id: externalId } : null;
            })
            .filter(Boolean);
        }
      } catch (error) {
        console.error('Customer import MySQL dedupe load failed:', error.message);
      }
    }
    return getCustomers();
  };

  const findCustomerById = (customerId) => getCustomers().find((row) => normalizeText(row._id) === normalizeText(customerId)) || null;

  const appendCustomerAddressBook = (customerId, addressText) => {
    const address = normalizeText(addressText);
    if (!address) return null;
    const customers = getCustomers();
    const index = customers.findIndex((row) => normalizeText(row._id) === normalizeText(customerId));
    if (index < 0) return null;
    const current = customers[index];
    const addressBook = Array.isArray(current.addressBook) ? current.addressBook : [];
    const exists = addressBook.some((entry) => normalizeAddress(entry) === normalizeAddress(address));
    if (!exists) {
      customers[index] = { ...current, addressBook: [...addressBook, address], updatedAt: nowIso() };
      saveCustomers(customers);
      return customers[index];
    }
    return current;
  };

  const premiseAddressKey = (address) => normalizeAddress(address).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || Date.now();

  const customerKnownAddressKeys = (customer = {}) => {
    const values = [
      customer.billingAddress,
      customer.shippingAddress,
      customer.address,
      ...(Array.isArray(customer.addressBook) ? customer.addressBook : [])
    ];
    return new Set(values.map((value) => normalizeAddress(value)).filter(Boolean));
  };

  const importedShippingDiffersFromBilling = (clean = {}) => {
    const billingAddress = normalizeAddress(clean.billingAddress || clean.address);
    const shippingAddress = normalizeAddress(clean.shippingAddress);
    if (!shippingAddress) return false;
    if (clean.shippingSameAsBilling) return false;
    return shippingAddress !== billingAddress;
  };

  const buildPremisePayload = ({ clean = {}, targetCustomer = {}, targetCustomerId = '', kind = 'billing', isDefault = 0 }) => {
    const isShippingAddress = kind === 'shipping';
    const address = isShippingAddress
      ? normalizeText(clean.shippingAddress)
      : normalizeText(clean.billingAddress || clean.address);
    const areaName = isShippingAddress ? (clean.shippingArea || clean.billingArea || '') : (clean.billingArea || '');
    const addressKey = premiseAddressKey(address);
    return {
      premiseId: `PREM-${targetCustomerId}-${addressKey}`,
      premiseCode: `PREM-${targetCustomerId}-${addressKey}`,
      premiseLabel: isShippingAddress ? `Shipping Address${areaName ? ` / ${areaName}` : ''}` : 'Billing Address',
      premiseName: isShippingAddress ? `Shipping Address${areaName ? ` / ${areaName}` : ''}` : 'Billing Address',
      premiseType: isShippingAddress ? 'Shipping' : 'Billing',
      attentionName: clean.billingAttention || clean.shippingAttention || clean.contactPersonName || clean.customerName || targetCustomer.contactPersonName || targetCustomer.name || '',
      contactPerson: clean.contactPersonName || clean.customerName || targetCustomer.contactPersonName || targetCustomer.name || '',
      mobile: clean.mobileNumber || targetCustomer.mobileNumber || targetCustomer.workPhone || '',
      altMobile: clean.altNumber || targetCustomer.altNumber || '',
      phone: clean.mobileNumber || targetCustomer.mobileNumber || targetCustomer.workPhone || '',
      email: clean.email || targetCustomer.emailId || targetCustomer.email || '',
      gstNumber: clean.gstNumber || targetCustomer.gstNumber || '',
      addressLine1: isShippingAddress ? (clean.shippingStreet1 || address) : (clean.billingStreet1 || address),
      addressLine2: isShippingAddress ? (clean.shippingStreet2 || '') : (clean.billingStreet2 || ''),
      address,
      area: areaName,
      areaName,
      city: clean.city || targetCustomer.city || '',
      state: isShippingAddress ? (clean.shippingState || clean.billingState || targetCustomer.billingState || targetCustomer.state || '') : (clean.billingState || targetCustomer.billingState || targetCustomer.state || ''),
      pincode: isShippingAddress ? (clean.shippingPincode || clean.billingPincode || '') : (clean.billingPincode || ''),
      country: 'India',
      latitude: clean.latitude || null,
      longitude: clean.longitude || null,
      googlePlaceId: clean.googlePlaceId || '',
      googlePlaceName: clean.googlePlaceName || '',
      googleMapUrl: clean.googleMapUrl || '',
      gstin: clean.gstNumber || targetCustomer.gstNumber || '',
      placeOfSupply: clean.billingState || targetCustomer.placeOfSupply || targetCustomer.state || '',
      landmark: clean.landmark || '',
      isDefault: isDefault ? 1 : 0,
      isBilling: isShippingAddress ? 0 : 1,
      isShipping: isShippingAddress ? 1 : 0,
      isActive: 1
    };
  };

  const buildPremiseFromImport = (clean = {}, targetCustomer = {}, targetCustomerId = '') => {
    const kind = importedShippingDiffersFromBilling(clean) ? 'shipping' : 'billing';
    const address = kind === 'shipping' ? clean.shippingAddress : (clean.billingAddress || clean.address);
    const addressKey = premiseAddressKey(address);
    return {
      ...buildPremisePayload({ clean, targetCustomer, targetCustomerId, kind, isDefault: 0 }),
      premiseId: `PREM-${targetCustomerId}-${addressKey}`
    };
  };

  const buildImportPremisePlan = ({ clean = {}, targetCustomer = {}, targetCustomerId = '', assumeHasDefaultPremise = true }) => {
    const knownAddressKeys = customerKnownAddressKeys(targetCustomer);
    const plan = [];
    const pushPremise = ({ kind, address, isDefault = 0 }) => {
      const normalizedAddress = normalizeAddress(address);
      if (!normalizedAddress) return;
      const isDuplicate = knownAddressKeys.has(normalizedAddress) || plan.some((entry) => entry.normalizedAddress === normalizedAddress);
      const addressKey = premiseAddressKey(address);
      const premise = {
        ...buildPremisePayload({ clean, targetCustomer, targetCustomerId, kind, isDefault }),
        premiseId: `PREM-${targetCustomerId}-${addressKey}`
      };
      plan.push({
        kind,
        normalizedAddress,
        isDuplicate,
        action: isDuplicate ? 'skip_premise' : 'add_premise',
        premise
      });
      knownAddressKeys.add(normalizedAddress);
    };

    if (!assumeHasDefaultPremise) {
      pushPremise({ kind: 'billing', address: clean.billingAddress || clean.address, isDefault: 1 });
    }

    if (importedShippingDiffersFromBilling(clean)) {
      pushPremise({ kind: 'shipping', address: clean.shippingAddress, isDefault: 0 });
    }

    return plan;
  };

  const previewImportPremisePlan = ({ clean = {}, targetCustomer = {}, targetCustomerId = '' }) => {
    const hasKnownBilling = !!normalizeText(targetCustomer.billingAddress || targetCustomer.address);
    return buildImportPremisePlan({
      clean,
      targetCustomer,
      targetCustomerId,
      assumeHasDefaultPremise: hasKnownBilling
    });
  };

  const addPremisesToMysql = async ({ targetCustomerId, clean, targetCustomer }) => {
    if (!normalizeText(targetCustomerId)) return { added: [], skipped: [], available: false };
    if (typeof mysql.canUseMysql !== 'function' || !mysql.canUseMysql()) return { added: [], skipped: [], available: false };
    if (typeof mysql.withMysqlConnection !== 'function' || typeof mysql.ensureCustomerPremisesInfrastructure !== 'function') return { added: [], skipped: [], available: false };

    return mysql.withMysqlConnection(async (conn) => {
      await mysql.ensureCustomerPremisesInfrastructure(conn);
      const [customerRows] = await conn.query('SELECT id FROM customers WHERE external_id = ? LIMIT 1', [targetCustomerId]);
      const customerRowId = Number(customerRows?.[0]?.id || 0);
      if (!customerRowId) throw new Error('Matched customer not found in MySQL');
      const [existingPremises] = await conn.query('SELECT id, premise_id, address, is_default FROM customer_premises WHERE customer_id = ? AND is_active = 1', [customerRowId]);
      const existingAddressKeys = new Set((existingPremises || []).map((row) => normalizeAddress(row.address)).filter(Boolean));
      let hasDefaultPremise = (existingPremises || []).some((row) => Number(row.is_default || 0) === 1);
      const plan = buildImportPremisePlan({
        clean,
        targetCustomer,
        targetCustomerId,
        assumeHasDefaultPremise: hasDefaultPremise
      });
      const added = [];
      const skipped = [];
      if (typeof mysql.insertOrUpdatePremise === 'function') {
        for (const entry of plan) {
          const normalizedAddress = normalizeAddress(entry.premise.address);
          if (!normalizedAddress || existingAddressKeys.has(normalizedAddress)) {
            const matchingPremise = (existingPremises || []).find((row) => normalizeAddress(row.address) === normalizedAddress);
            if (entry.kind === 'billing' && !hasDefaultPremise && matchingPremise?.id) {
              await conn.query('UPDATE customer_premises SET is_default = 0 WHERE customer_id = ?', [customerRowId]);
              await conn.query(
                "UPDATE customer_premises SET is_default = 1, is_billing = 1, premise_type = 'Billing' WHERE id = ?",
                [matchingPremise.id]
              );
              hasDefaultPremise = true;
              added.push({ ...entry.premise, premiseId: matchingPremise.premise_id || entry.premise.premiseId });
              continue;
            }
            skipped.push({ ...entry.premise, reason: 'Duplicate Address Found' });
            continue;
          }
          await mysql.insertOrUpdatePremise(conn, customerRowId, entry.premise);
          existingAddressKeys.add(normalizedAddress);
          added.push(entry.premise);
        }
        return { added, skipped, available: true };
      }
      throw new Error('Customer premise writer is unavailable');
    });
  };

  const addPremiseToMysql = async ({ targetCustomerId, premise }) => {
    if (!normalizeText(targetCustomerId) || !normalizeText(premise?.address)) return false;
    const clean = {
      billingAddress: premise.premiseType === 'Billing' ? premise.address : '',
      shippingAddress: premise.premiseType === 'Shipping' ? premise.address : '',
      shippingArea: premise.areaName,
      billingArea: premise.areaName,
      shippingSameAsBilling: false
    };
    const result = await addPremisesToMysql({ targetCustomerId, clean, targetCustomer: {} });
    return !!result.available;
  };

  const addImportedPremisesToExistingCustomer = async ({ targetCustomerId, clean, actor, updateMainRecord = true }) => {
    const target = findCustomerById(targetCustomerId) || {};
    const previewPlan = previewImportPremisePlan({ clean, targetCustomer: target, targetCustomerId });
    const addedLocal = [];
    const skippedLocal = [];
    previewPlan.forEach((entry) => {
      if (entry.isDuplicate) {
        skippedLocal.push({ ...entry.premise, reason: 'Duplicate Address Found' });
        return;
      }
      appendCustomerAddressBook(targetCustomerId, entry.premise.address);
      addedLocal.push(entry.premise);
    });
    let targetAfterUpdate = target;
    if (updateMainRecord) {
      const updated = updateExistingFromImport({ targetCustomerId, clean });
      if (!updated.ok) return { ok: false, error: updated.error || 'Target customer not found', added: [], skipped: [] };
      targetAfterUpdate = updated.customer || target;
    }
    const mysqlResult = await addPremisesToMysql({ targetCustomerId, clean, targetCustomer: target });
    const added = mysqlResult.available ? mysqlResult.added : addedLocal;
    const skipped = mysqlResult.available ? mysqlResult.skipped : skippedLocal;
    logAudit('import_row_merged_customer_premises', {
      targetCustomerId,
      addedPremiseIds: added.map((premise) => premise.premiseId),
      skippedPremiseIds: skipped.map((premise) => premise.premiseId)
    }, actor);
    return { ok: true, added, skipped, customer: targetAfterUpdate };
  };

  const addImportedAddressToExistingCustomer = async ({ targetCustomerId, clean, actor }) => {
    const result = await addImportedPremisesToExistingCustomer({ targetCustomerId, clean, actor, updateMainRecord: true });
    return { ok: true, premise: result.added[0] || result.skipped[0] || null, ...result };
  };

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
        previewAction: 'create_customer',
        previewActionLabel: 'New Customer → Create Customer',
        premisePlan: [],
        possibleMatches: []
      };
    }

    const premisePlan = previewImportPremisePlan({ clean, targetCustomer: top.existing, targetCustomerId: top.existing._id });
    const hasNewPremise = premisePlan.some((entry) => !entry.isDuplicate);
    const hasDuplicatePremise = premisePlan.some((entry) => entry.isDuplicate);
    const previewAction = hasNewPremise ? 'add_premise' : hasDuplicatePremise ? 'skip_premise' : 'merge';
    const previewActionLabel = hasNewPremise
      ? 'New Address Found → Add Premise'
      : hasDuplicatePremise
        ? 'Duplicate Address Found → Skip Premise'
        : 'Existing Customer Found → Merge';

    return {
      status: top.classification,
      confidence: round2(top.score),
      matchedCustomerId: top.existing._id,
      matchedCustomerName: top.existing.displayName || top.existing.name || '',
      matchReason: top.reasons.join(' | ') || 'Similarity match',
      previewAction,
      previewActionLabel,
      premisePlan,
      possibleMatches: candidates.slice(0, 5).map((entry) => ({
        customerId: entry.existing._id,
        customerName: entry.existing.displayName || entry.existing.name || '',
        score: round2(entry.score),
        reason: entry.reasons.join(' | ') || 'Similarity match',
        nameSimilarity: entry.nameSimilarity,
        addressSimilarity: entry.addressSimilarity,
        sameCustomerDifferentAddress: !!entry.sameCustomerDifferentAddress,
        phone: entry.existing.mobileNumber || entry.existing.workPhone || '',
        email: entry.existing.emailId || entry.existing.email || '',
        address: entry.existing.shippingAddress || entry.existing.billingAddress || entry.existing.address || '',
        area: entry.existing.shippingArea || entry.existing.billingArea || entry.existing.area || '',
        segment: entry.existing.segment || entry.existing.serviceType || '',
        previewActionLabel: (() => {
          const matchPlan = previewImportPremisePlan({ clean, targetCustomer: entry.existing, targetCustomerId: entry.existing._id });
          if (matchPlan.some((planEntry) => !planEntry.isDuplicate)) return 'New Address Found → Add Premise';
          if (matchPlan.some((planEntry) => planEntry.isDuplicate)) return 'Duplicate Address Found → Skip Premise';
          return 'Existing Customer Found → Merge';
        })()
      }))
    };
  };

  const analyzeRows = async ({ rawRows, mapping, batchId }) => {
    const customers = (await fetchCustomersForDedupe()).filter((entry) => entry.active !== false && !entry.isMerged);
    const analyzedRows = [];
    const allMatches = [];

    rawRows.forEach((raw, idx) => {
      const { clean, validationErrors } = normalizeImportRow(raw, mapping);
      let status = 'New Customer';
      let confidence = 0;
      let matchReason = 'No duplicate found';
      let matchedCustomerId = '';
      let matchedCustomerName = '';
      let previewAction = 'create_customer';
      let previewActionLabel = 'New Customer → Create Customer';
      let premisePlan = [];
      let possibleMatches = [];
      if (validationErrors.length > 0) {
        status = 'Invalid Row';
        confidence = 0;
        matchReason = validationErrors.join(' | ');
        previewAction = 'skip';
        previewActionLabel = 'Invalid Row → Skip';
      } else {
        const scoreResult = scoreAgainstExisting(clean, customers);
        status = scoreResult.status;
        confidence = scoreResult.confidence;
        matchedCustomerId = scoreResult.matchedCustomerId;
        matchedCustomerName = scoreResult.matchedCustomerName;
        matchReason = scoreResult.matchReason;
        previewAction = scoreResult.previewAction;
        previewActionLabel = scoreResult.previewActionLabel;
        premisePlan = scoreResult.premisePlan;
        possibleMatches = scoreResult.possibleMatches;
      }

      const suggestedAction = decideSuggestedAction({
        status,
        score: confidence,
        sameCustomerDifferentAddress: possibleMatches.some((match) => match.sameCustomerDifferentAddress)
      });
      const selectedAction = matchedCustomerId && status !== 'Invalid Row'
        ? (previewAction === 'add_premise' ? 'add_address' : 'merge_with_existing')
        : suggestedAction;
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
        previewAction,
        previewActionLabel,
        premisePlan,
        suggestedAction,
        selectedAction,
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

  const updateImportRowAction = (params = {}) => {
    const { rowId, action, targetCustomerId, reason } = params;
    const rows = getImportRows();
    const index = rows.findIndex((row) => normalizeText(row._id) === normalizeText(rowId));
    if (index < 0) return null;
    const hasTargetCustomerId = Object.prototype.hasOwnProperty.call(params, 'targetCustomerId');
    rows[index] = {
      ...rows[index],
      selectedAction: normalizeText(action || rows[index].selectedAction || 'needs_review'),
      selectedTargetCustomerId: hasTargetCustomerId
        ? normalizeText(targetCustomerId)
        : normalizeText(rows[index].selectedTargetCustomerId || rows[index].matchedCustomerId || ''),
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
      whatsappNumber: normalizePhone(current.whatsappNumber || clean.whatsappNumber || current.mobileNumber || clean.mobileNumber),
      altNumber: normalizePhone(current.altNumber || clean.altNumber),
      emailId: normalizeEmail(current.emailId || current.email || clean.email),
      email: normalizeEmail(current.email || current.emailId || clean.email),
      hasGst: current.hasGst ?? clean.hasGst ?? false,
      gstRegistered: current.gstRegistered ?? clean.hasGst ?? false,
      gstNumber: normalizeText(current.gstNumber || clean.gstNumber),
      billingAttention: normalizeText(current.billingAttention || clean.billingAttention),
      billingStreet1: normalizeText(current.billingStreet1 || clean.billingStreet1),
      billingStreet2: normalizeText(current.billingStreet2 || clean.billingStreet2),
      billingAddress: normalizeText(current.billingAddress || clean.billingAddress || clean.address),
      billingArea: normalizeText(current.billingArea || clean.billingArea),
      billingState: normalizeText(current.billingState || clean.billingState || 'Delhi'),
      billingPincode: normalizeText(current.billingPincode || clean.billingPincode),
      billingPhoneCode: normalizeText(current.billingPhoneCode || clean.billingPhoneCode || '+91'),
      billingPhone: normalizePhone(current.billingPhone || clean.billingPhone || clean.mobileNumber),
      shippingAttention: normalizeText(current.shippingAttention || clean.shippingAttention),
      shippingStreet1: normalizeText(current.shippingStreet1 || clean.shippingStreet1),
      shippingStreet2: normalizeText(current.shippingStreet2 || clean.shippingStreet2),
      shippingAddress: normalizeText(current.shippingAddress || current.billingAddress || clean.shippingAddress || clean.billingAddress || clean.address),
      shippingArea: normalizeText(current.shippingArea || current.billingArea || clean.billingArea),
      shippingState: normalizeText(current.shippingState || current.billingState || clean.billingState || 'Delhi'),
      shippingPincode: normalizeText(current.shippingPincode || current.billingPincode || clean.billingPincode),
      shippingPhoneCode: normalizeText(current.shippingPhoneCode || clean.shippingPhoneCode || '+91'),
      shippingPhone: normalizePhone(current.shippingPhone || clean.shippingPhone || clean.mobileNumber),
      segment: normalizeText(current.segment || clean.segment || clean.serviceType || 'Residential'),
      areaSqft: toNumber(current.areaSqft || clean.areaSqft || 0, 0),
      googlePlaceId: normalizeText(current.googlePlaceId || clean.googlePlaceId),
      googlePlaceName: normalizeText(current.googlePlaceName || clean.googlePlaceName),
      googlePhone: normalizeText(current.googlePhone || clean.googlePhone),
      googleWebsite: normalizeText(current.googleWebsite || clean.googleWebsite),
      latitude: normalizeText(current.latitude || clean.latitude),
      longitude: normalizeText(current.longitude || clean.longitude),
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

  const applyImportRowAction = async ({ row, actor }) => {
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

    if ((action === 'create_new' || action === 'mark_different') && normalizeText(row.matchedCustomerId || row.selectedTargetCustomerId)) {
      const targetId = normalizeText(row.selectedTargetCustomerId || row.matchedCustomerId);
      const result = await addImportedPremisesToExistingCustomer({ targetCustomerId: targetId, clean: row.clean, actor, updateMainRecord: true });
      if (!result.ok) {
        return {
          ...row,
          finalResult: 'error',
          finalMessage: result.error || 'Unable to merge matched customer',
          updatedAt: nowIso()
        };
      }
      await persistCustomerToMysql(result.customer);
      return {
        ...row,
        selectedAction: 'merge_with_existing',
        selectedTargetCustomerId: targetId,
        finalResult: 'merged',
        addedPremisesCount: result.added.length,
        finalMessage: result.added.length
          ? `Matched existing customer; added ${result.added.length} premise(s)`
          : 'Matched existing customer; duplicate premise skipped',
        updatedAt: nowIso()
      };
    }

    if (action === 'create_new' || action === 'mark_different') {
      const payload = buildCustomerPayloadFromImport(row.clean);
      const created = createCustomerRecord(payload);
      await persistCustomerToMysql(created);
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
      const result = await addImportedPremisesToExistingCustomer({ targetCustomerId: targetId, clean: row.clean, actor, updateMainRecord: true });
      if (!result.ok) {
        return {
          ...row,
          finalResult: 'error',
          finalMessage: result.error || 'Unable to merge imported customer',
          updatedAt: nowIso()
        };
      }
      logAudit('import_row_updated_existing_customer', {
        rowId: row._id,
        targetCustomerId: targetId
      }, actor);
      await persistCustomerToMysql(result.customer);
      return {
        ...row,
        finalResult: 'updated',
        addedPremisesCount: result.added.length,
        finalMessage: `Merged customer and ${result.added.length ? `added ${result.added.length} premise(s)` : 'skipped duplicate premise(s)'}`,
        selectedTargetCustomerId: targetId,
        updatedAt: nowIso()
      };
    }

    if (action === 'add_address') {
      const targetId = normalizeText(row.selectedTargetCustomerId || row.matchedCustomerId);
      const result = await addImportedAddressToExistingCustomer({ targetCustomerId: targetId, clean: row.clean, actor });
      if (!result.ok) {
        return {
          ...row,
          finalResult: 'error',
          finalMessage: result.error || 'Unable to add imported address',
          updatedAt: nowIso()
        };
      }
      return {
        ...row,
        finalResult: 'updated',
        addedPremisesCount: result.added.length,
        finalMessage: result.added.length
          ? `Merged customer and added ${result.added.length} premise(s)`
          : 'Merged customer; duplicate premise skipped',
        selectedTargetCustomerId: targetId,
        updatedAt: nowIso()
      };
    }

    if (action === 'merge_with_existing') {
      const targetId = normalizeText(row.selectedTargetCustomerId || row.matchedCustomerId);
      const result = await addImportedPremisesToExistingCustomer({ targetCustomerId: targetId, clean: row.clean, actor, updateMainRecord: true });
      if (!result.ok) {
        return {
          ...row,
          finalResult: 'error',
          finalMessage: result.error || 'Merge failed',
          updatedAt: nowIso()
        };
      }
      await persistCustomerToMysql(result.customer);

      return {
        ...row,
        finalResult: 'merged',
        addedPremisesCount: result.added.length,
        finalMessage: result.added.length
          ? `Merged into customer and added ${result.added.length} premise(s)`
          : 'Merged into customer; duplicate premise skipped',
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

  const getImportBatchPayload = (batchId) => {
    const batch = getBatches().find((entry) => normalizeText(entry._id) === normalizeText(batchId));
    if (!batch) return null;
    const rows = getImportRows().filter((row) => normalizeText(row.batchId) === normalizeText(batchId));
    const matches = getMatches().filter((row) => normalizeText(row.batchId) === normalizeText(batchId));
    return { batch, rows, matches };
  };

  const importUploadMiddleware = uploadMiddleware && typeof uploadMiddleware.single === 'function'
    ? (req, res, next) => {
        uploadMiddleware.single('file')(req, res, (error) => {
          if (error) {
            console.error('[Customer Import Upload] multer failed:', {
              message: error.message,
              code: error.code || '',
              path: error.path || ''
            });
            const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            return res.status(status).json({
              error: error.code === 'LIMIT_FILE_SIZE'
                ? 'Customer import file must be 20MB or smaller'
                : error.message || 'Customer import upload failed'
            });
          }
          console.log('[Customer Import Upload] multer accepted:', {
            file: req.file ? {
              originalname: req.file.originalname,
              filename: req.file.filename,
              mimetype: req.file.mimetype,
              size: req.file.size,
              path: req.file.path,
              destination: req.file.destination
            } : null,
            bodyKeys: Object.keys(req.body || {})
          });
          return next();
        });
      }
    : (_req, _res, next) => next();

  app.post('/api/customers/import/upload', importUploadMiddleware, async (req, res) => {
    try {
      const uploadedFile = req.file || null;
      console.log('[Customer Import Upload] request received:', {
        hasFile: Boolean(uploadedFile),
        file: uploadedFile ? {
          originalname: uploadedFile.originalname,
          filename: uploadedFile.filename,
          mimetype: uploadedFile.mimetype,
          size: uploadedFile.size,
          path: uploadedFile.path,
          destination: uploadedFile.destination
        } : null,
        bodyKeys: Object.keys(req.body || {})
      });
      const fileName = normalizeText(req.body?.fileName || uploadedFile?.originalname || 'customers-import.csv');
      let content = String(req.body?.content || '');
      let contentEncoding = req.body?.contentEncoding || '';
      const lowerFileName = normalizeLower(fileName);

      if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
        const buffer = fs.readFileSync(uploadedFile.path);
        if (lowerFileName.endsWith('.xlsx') || lowerFileName.endsWith('.xls')) {
          content = buffer.toString('base64');
          contentEncoding = 'base64';
        } else {
          content = buffer.toString('utf8');
          contentEncoding = '';
        }
        try {
          fs.unlinkSync(uploadedFile.path);
        } catch (unlinkError) {
          console.error('Unable to remove temporary import upload:', unlinkError.message);
        }
      }

      if (!content.trim()) return res.status(400).json({ error: 'Import file content is required' });

      const { headers, rows } = parseImportContent({ fileName, content, contentEncoding });
      if (rows.length === 0) return res.status(400).json({ error: 'No import rows found' });

      const mapping = mergeMappingWithInferred(headers, req.body?.mapping);

      const batchId = `CIB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const batch = {
        _id: batchId,
        fileName,
        status: 'Uploaded',
        headers,
        mapping,
        rawRows: rows,
        totalRows: rows.length,
        fileSize: toNumber(req.body?.fileSize || uploadedFile?.size, Buffer.byteLength(content, 'utf8')),
        columnPreview: headers.slice(0, 18),
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
          importedAsNew: 0,
          newPremisesAdded: 0,
          failedRows: 0
        }
      };

      const batches = getBatches();
      batches.push(batch);
      saveBatches(batches);
      saveImportRows(getImportRows().filter((row) => normalizeText(row.batchId) !== batchId));
      saveMatches(getMatches().filter((row) => normalizeText(row.batchId) !== batchId));
      logAudit('customer_import_uploaded', { batchId, fileName, totalRows: rows.length }, normalizeText(req.body?.actor || 'System'));

      const latestBatch = getBatches().find((entry) => normalizeText(entry._id) === batchId);
      return res.json({
        message: 'Import uploaded and parsed',
        batch: latestBatch,
        headers,
        totalRows: rows.length,
        columnPreview: headers.slice(0, 18),
        rowPreview: rows.slice(0, 6)
      });
    } catch (error) {
      console.error('[Customer Import Upload] API failed:', {
        message: error.message,
        stack: error.stack
      });
      return res.status(500).json({ error: error.message || 'Unable to upload import file' });
    }
  });

  app.post('/api/customers/import/map', async (req, res) => {
    try {
      const batchId = normalizeText(req.body?.batchId || req.body?.batch_id);
      const requestedMapping = req.body?.mapping && typeof req.body.mapping === 'object' ? req.body.mapping : null;
      if (!batchId) return res.status(400).json({ error: 'batchId is required' });
      if (!requestedMapping) return res.status(400).json({ error: 'mapping is required' });

      const batches = getBatches();
      const batchIndex = batches.findIndex((entry) => normalizeText(entry._id) === batchId);
      if (batchIndex < 0) return res.status(404).json({ error: 'Import batch not found' });
      const mapping = mergeMappingWithInferred(batches[batchIndex].headers || [], requestedMapping);
      batches[batchIndex] = {
        ...batches[batchIndex],
        mapping,
        mappingTemplateName: normalizeText(req.body?.templateName || batches[batchIndex].mappingTemplateName || ''),
        status: 'Mapped',
        updatedAt: nowIso()
      };
      saveBatches(batches);
      logAudit('customer_import_mapped', { batchId }, normalizeText(req.body?.actor || 'System'));
      return res.json({ message: 'Mapping saved', batch: batches[batchIndex], mapping });
    } catch (error) {
      console.error('Import mapping failed:', error.message);
      return res.status(500).json({ error: 'Unable to save import mapping' });
    }
  });

  app.post('/api/customers/import/detect-duplicates', async (req, res) => {
    try {
      const batchId = normalizeText(req.body?.batchId || req.body?.batch_id);
      if (!batchId) return res.status(400).json({ error: 'batchId is required' });
      const batches = getBatches();
      const batchIndex = batches.findIndex((entry) => normalizeText(entry._id) === batchId);
      if (batchIndex < 0) return res.status(404).json({ error: 'Import batch not found' });
      const batch = batches[batchIndex];
      const mapping = mergeMappingWithInferred(batch.headers || [], req.body?.mapping || batch.mapping || {});
      const { analyzedRows, allMatches } = await analyzeRows({ rawRows: Array.isArray(batch.rawRows) ? batch.rawRows : [], mapping, batchId });
      saveImportRows([...getImportRows().filter((row) => normalizeText(row.batchId) !== batchId), ...analyzedRows]);
      saveMatches([...getMatches().filter((row) => normalizeText(row.batchId) !== batchId), ...allMatches]);
      batches[batchIndex] = {
        ...batch,
        mapping,
        status: 'Duplicates Detected',
        updatedAt: nowIso(),
        stats: summarizeBatchRows(analyzedRows)
      };
      saveBatches(batches);
      logAudit('customer_import_duplicates_detected', { batchId, stats: summarizeBatchRows(analyzedRows) }, normalizeText(req.body?.actor || 'System'));
      return res.json({
        message: 'Duplicates detected',
        batch: getBatches().find((entry) => normalizeText(entry._id) === batchId),
        rows: analyzedRows,
        matches: allMatches,
        summary: summarizeBatchRows(analyzedRows)
      });
    } catch (error) {
      console.error('Duplicate detection failed:', error.message);
      return res.status(500).json({ error: 'Unable to detect duplicate customers' });
    }
  });

  app.post('/api/customers/import/merge', (req, res) => {
    const rowId = normalizeText(req.body?.rowId || req.body?.row_id);
    if (!rowId) return res.status(400).json({ error: 'rowId is required' });
    const row = updateImportRowAction({
      rowId,
      action: req.body?.action || 'merge_with_existing',
      targetCustomerId: req.body?.targetCustomerId,
      reason: req.body?.reason || 'Smart import merge action'
    });
    if (!row) return res.status(404).json({ error: 'Import row not found' });
    refreshBatchStats(row.batchId);
    return res.json(row);
  });

  const finalizeImportBatch = async ({ batchId, actor = 'System' }) => {
    const rows = getImportRows().filter((row) => normalizeText(row.batchId) === batchId);
    if (rows.length === 0) return { ok: false, status: 404, error: 'No import rows found for this batch' };

    const updatedRows = [];
    for (const row of rows) {
      updatedRows.push(await applyImportRowAction({ row, actor }));
    }
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

    return {
      ok: true,
      message: 'Import batch processed successfully',
      batch: getBatches().find((entry) => normalizeText(entry._id) === batchId),
      rows: updatedRows
    };
  };

  app.post('/api/customers/import/finalize', async (req, res) => {
    try {
      const result = await finalizeImportBatch({
        batchId: normalizeText(req.body?.batchId || req.body?.batch_id),
        actor: normalizeText(req.body?.actor || 'System')
      });
      if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
      return res.json(result);
    } catch (error) {
      console.error('Import finalize failed:', error.message);
      return res.status(500).json({ error: 'Unable to finalize import and save customers' });
    }
  });

  app.post('/api/customers/import/batches/:batchId/remap', async (req, res) => {
    try {
      const batchId = normalizeText(req.params.batchId);
      const requestedMapping = req.body?.mapping && typeof req.body.mapping === 'object' ? req.body.mapping : null;
      if (!requestedMapping) return res.status(400).json({ error: 'mapping is required' });

      const batches = getBatches();
      const batchIndex = batches.findIndex((entry) => normalizeText(entry._id) === batchId);
      if (batchIndex < 0) return res.status(404).json({ error: 'Import batch not found' });

      const batch = batches[batchIndex];
      const rawRows = Array.isArray(batch.rawRows) ? batch.rawRows : [];
      const mapping = mergeMappingWithInferred(batch.headers || [], requestedMapping);
      const { analyzedRows, allMatches } = await analyzeRows({ rawRows, mapping, batchId });

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
    const actionPayload = {
      rowId: req.params.rowId,
      action: req.body?.action,
      reason: req.body?.reason
    };
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'targetCustomerId')) {
      actionPayload.targetCustomerId = req.body.targetCustomerId;
    }
    const row = updateImportRowAction(actionPayload);
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

  app.post('/api/customers/import/batches/:batchId/confirm', async (req, res) => {
    try {
      const result = await finalizeImportBatch({
        batchId: normalizeText(req.params.batchId),
        actor: normalizeText(req.body?.actor || 'System')
      });
      if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
      return res.json(result);
    } catch (error) {
      console.error('Import confirm failed:', error.message);
      return res.status(500).json({ error: 'Unable to finalize import and save customers' });
    }
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

  app.get('/api/customers/export', async (req, res) => {
    try {
      const scope = normalizeLower(req.query.scope || 'all');
      const format = normalizeLower(req.query.format || 'csv');
      const area = normalizeLower(req.query.area || '');
      const salesPerson = normalizeLower(req.query.salesPerson || req.query.sales_person || '');
      const serviceType = normalizeLower(req.query.serviceType || req.query.service_type || '');

      let customers = getCustomers().filter((entry) => scope === 'all' || entry.active !== false);
      const duplicateIds = new Set(buildDuplicateReport().possibleDuplicateCustomerIds || []);

      if (scope === 'active') customers = customers.filter((entry) => entry.active !== false && !entry.isMerged);
      if (scope === 'duplicates') customers = customers.filter((entry) => duplicateIds.has(entry._id));
      if (scope === 'multiple_premises') {
        customers = customers.filter((entry) => {
          const addresses = [
            entry.billingAddress,
            entry.shippingAddress,
            ...(Array.isArray(entry.addressBook) ? entry.addressBook : [])
          ].map((value) => normalizeAddress(value)).filter(Boolean);
          return new Set(addresses).size > 1;
        });
      }
      if (scope === 'area_wise' && area) customers = customers.filter((entry) => normalizeLower(entry.billingArea || entry.area || entry.shippingArea).includes(area));
      if (scope === 'sales_person_wise' && salesPerson) customers = customers.filter((entry) => normalizeLower(entry.salesPerson || entry.sales_person).includes(salesPerson));
      if (scope === 'service_wise' && serviceType) customers = customers.filter((entry) => normalizeLower(entry.serviceType || entry.segment).includes(serviceType));

      const rows = [
        ['Customer ID', 'Customer Name', 'Company Name', 'Contact Person', 'Mobile', 'WhatsApp', 'Email', 'GST', 'Billing Address', 'Shipping Address', 'Area', 'State', 'Pincode', 'Service Type', 'Premise Count', 'Active'],
        ...customers.map((customer) => {
          const addresses = [
            customer.billingAddress,
            customer.shippingAddress,
            ...(Array.isArray(customer.addressBook) ? customer.addressBook : [])
          ].map((value) => normalizeAddress(value)).filter(Boolean);
          return [
            customer._id || '',
            customer.displayName || customer.name || '',
            customer.companyName || '',
            customer.contactPersonName || '',
            customer.mobileNumber || customer.workPhone || '',
            customer.whatsappNumber || '',
            customer.emailId || customer.email || '',
            customer.gstNumber || '',
            customer.billingAddress || customer.address || '',
            customer.shippingAddress || '',
            customer.billingArea || customer.area || customer.shippingArea || '',
            customer.billingState || customer.state || customer.shippingState || '',
            customer.billingPincode || customer.pincode || customer.shippingPincode || '',
            customer.serviceType || customer.segment || '',
            new Set(addresses).size,
            customer.active === false ? 'No' : 'Yes'
          ];
        })
      ];
      const csv = toCsv(rows);
      const extension = format === 'excel' || format === 'xlsx' ? 'xls' : 'csv';
      res.setHeader('Content-Type', extension === 'xls' ? 'application/vnd.ms-excel' : 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="customers_${scope}_${new Date().toISOString().slice(0, 10)}.${extension}"`);
      return res.send(csv);
    } catch (error) {
      console.error('Customer export failed:', error.message);
      return res.status(500).json({ error: 'Unable to export customers' });
    }
  });

  app.get('/api/customers/import/sample', (req, res) => {
    const csv = [
      [
        'segment',
        'companyName',
        'contactPersonName',
        'displayName',
        'position',
        'positionCustom',
        'mobileNumber',
        'whatsappSameAsMobile',
        'whatsappNumber',
        'altNumber',
        'emailId',
        'hasGst',
        'gstNumber',
        'billingAttention',
        'billingStreet1',
        'billingStreet2',
        'billingAddress',
        'billingArea',
        'billingState',
        'billingPincode',
        'billingPhoneCode',
        'billingPhone',
        'shippingSameAsBilling',
        'shippingAttention',
        'shippingStreet1',
        'shippingStreet2',
        'shippingAddress',
        'shippingArea',
        'shippingState',
        'shippingPincode',
        'shippingPhoneCode',
        'shippingPhone',
        'areaSqft',
        'googlePlaceId',
        'googlePlaceName',
        'googlePhone',
        'googleWebsite',
        'latitude',
        'longitude'
      ].join(','),
      [
        'Residential',
        '',
        'Priya Jain',
        'Priya Jain',
        'Owner',
        '',
        '9810783477',
        'Yes',
        '9810783477',
        '',
        'priya@example.com',
        'No',
        '',
        'Priya Jain',
        '22 Ground Floor',
        'Sarai Jullena',
        '22 Ground Floor Sarai Jullena Delhi',
        'Sarai Jullena',
        'Delhi',
        '110025',
        '+91',
        '9810783477',
        'Yes',
        'Priya Jain',
        '22 Ground Floor',
        'Sarai Jullena',
        '22 Ground Floor Sarai Jullena Delhi',
        'Sarai Jullena',
        'Delhi',
        '110025',
        '+91',
        '9810783477',
        '1200',
        '',
        '',
        '',
        '',
        '',
        ''
      ].join(','),
      [
        'Commercial',
        'Trimaster Private Limited',
        'Accounts Team',
        'Trimaster Private Limited',
        'Manager',
        '',
        '9667959373',
        'Yes',
        '9667959373',
        '',
        'accounts@trimaster.com',
        'Yes',
        '07ABCDE1234F1Z5',
        'Accounts Team',
        '222 Okhla Phase-3',
        '',
        '222 Okhla Phase-3 New Delhi',
        'Okhla',
        'Delhi',
        '110020',
        '+91',
        '9667959373',
        'Yes',
        'Accounts Team',
        '222 Okhla Phase-3',
        '',
        '222 Okhla Phase-3 New Delhi',
        'Okhla',
        'Delhi',
        '110020',
        '+91',
        '9667959373',
        '3500',
        '',
        '',
        '',
        '',
        '',
        ''
      ].join(',')
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers-import-sample-dedupe.csv"');
    res.send(csv);
  });
}

module.exports = {
  registerCustomerDedupModule
};
