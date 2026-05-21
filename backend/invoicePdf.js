const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const COLORS = {
  label: '#333333',
  text: '#000000',
  border: '#9e9e9e',
  headerBg: '#f2f3f4',
  title: '#000000',
  primary: '#9F174D'
};

const PAGE_MARGIN = {
  top: 50.4,
  bottom: 50.4,
  left: 39.6,
  right: 28.8
};

const BASE_FONT_SIZE = 7;

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clean = (value) => String(value ?? '').trim();
const pickFirstText = (...values) => {
  for (const value of values) {
    const next = clean(value);
    if (next) return next;
  }
  return '';
};

const normalizeInvoiceType = (invoice = {}) => (
  clean(invoice.invoiceType || invoice.invoice_type || invoice.type).toUpperCase() === 'NON GST' ? 'NON GST' : 'GST'
);

const formatINR = (value) => {
  const n = toNumber(value, 0);
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (value) => {
  const raw = clean(value);
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const toWordsBelowThousand = (num) => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  let n = num;
  const parts = [];
  if (n >= 100) {
    parts.push(`${ones[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(tens[Math.floor(n / 10)]);
    n %= 10;
  } else if (n >= 10) {
    parts.push(teens[n - 10]);
    n = 0;
  }
  if (n > 0) parts.push(ones[n]);
  return parts.join(' ').trim();
};

const numberToIndianWords = (value) => {
  const num = Math.floor(Math.abs(toNumber(value, 0)));
  if (num === 0) return 'Zero';

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundredBlock = num % 1000;

  const parts = [];
  if (crore) parts.push(`${toWordsBelowThousand(crore)} Crore`);
  if (lakh) parts.push(`${toWordsBelowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${toWordsBelowThousand(thousand)} Thousand`);
  if (hundredBlock) parts.push(toWordsBelowThousand(hundredBlock));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

const amountToWords = (value) => {
  const amount = Math.max(0, toNumber(value, 0));
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const rupeesPart = `${numberToIndianWords(rupees)} Rupees`;
  if (!paise) return `${rupeesPart} Only`;
  return `${rupeesPart} and ${numberToIndianWords(paise)} Paise Only`;
};

const parseLocalAsset = (input = '') => {
  const raw = clean(input);
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  const primaryUploadsDir = String(
    process.env.UPLOADS_DIR ||
    process.env.UPLOADS_ROOT_DIR ||
    path.join(process.env.HOME || '/home/u610009593', 'uploads-skuas-crm')
  ).trim();
  const uploadDirs = [
    primaryUploadsDir,
    '/home/u610009593/uploads-skuas-crm',
    String(process.env.UPLOADS_MIRROR_DIR || '').trim(),
    path.join(__dirname, '..', 'storage', 'uploads'),
    path.join(__dirname, 'uploads'),
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'public', 'uploads')
  ].filter(Boolean);
  const resolveUploadLocal = (name = '') => {
    const safeName = decodeURIComponent(String(name || '').trim());
    const normalized = safeName.replace(/\\/g, '/').replace(/^\/?uploads\/?/, '').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) return '';
    for (const dir of uploadDirs) {
      const byRelativePath = path.join(dir, normalized);
      if (fs.existsSync(byRelativePath)) return byRelativePath;
      const byFileName = path.join(dir, path.basename(normalized));
      if (fs.existsSync(byFileName)) return byFileName;
    }
    return '';
  };

  if (raw.startsWith('/uploads/')) {
    return resolveUploadLocal(raw.split('/uploads/')[1]);
  }
  if (raw.includes('/uploads/')) {
    return resolveUploadLocal(raw.split('/uploads/').pop());
  }

  if (raw.startsWith('/')) {
    if (fs.existsSync(raw)) return raw;
    return resolveUploadLocal(raw);
  }

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    const local = resolveUploadLocal(raw);
    if (fs.existsSync(local)) return local;
    if (fs.existsSync(raw)) return raw;
  }

  try {
    const url = new URL(raw);
    const fileName = path.basename(url.pathname || '');
    if (fileName) {
      const local = resolveUploadLocal(fileName);
      if (fs.existsSync(local)) return local;
    }
  } catch (_error) {
    if (fs.existsSync(raw)) return raw;
  }

  return '';
};

const resolveFirstLocalAsset = (...sources) => {
  for (const source of sources) {
    const local = parseLocalAsset(source);
    if (local) return local;
  }
  return '';
};

const resolveCompany = (settings = {}, invoice = {}) => {
  const isNonGst = normalizeInvoiceType(invoice) === 'NON GST';
  const primaryColor = clean(settings.brandingAccentColor || settings.primaryColor || settings.primary_color) || COLORS.primary;
  const logo = isNonGst
    ? resolveFirstLocalAsset(
      settings.nonGstCompanyLogoUrl,
      settings.nonGstLogoUrl,
      settings.nonGstBrandingLogoUrl
    )
    : resolveFirstLocalAsset(
      settings.gstCompanyLogoUrl,
      settings.gstLogoUrl,
      settings.gstBrandingLogoUrl
    );
  const address1 = clean((isNonGst ? settings.nonGstBillingAddress : settings.gstBillingAddress) || settings.companyAddress);
  const rawAddress2 = clean((isNonGst ? settings.nonGstAddress : '') || '');
  const address2 = rawAddress2 && rawAddress2 !== address1 ? rawAddress2 : '';
  return {
    isNonGst,
    primaryColor,
    name: clean((isNonGst ? settings.nonGstCompanyName : settings.gstCompanyName) || settings.companyName) || 'SKUAS Pest Control',
    tagline: clean(settings.aboutTagline),
    address1,
    address2,
    city: clean((isNonGst ? settings.nonGstCity : settings.gstCity) || settings.companyCity),
    state: clean((isNonGst ? settings.nonGstState : settings.gstState) || settings.companyState),
    pincode: clean((isNonGst ? settings.nonGstPincode : settings.gstPincode) || settings.companyPincode),
    phone: clean((isNonGst ? settings.nonGstPhone : settings.gstPhone) || settings.companyMobile),
    email: clean((isNonGst ? settings.nonGstEmail : settings.gstEmail) || settings.companyEmail),
    website: clean(settings.companyWebsite),
    gstin: isNonGst
      ? ''
      : pickFirstText(
        settings.companyGstNumber,
        settings.gstCompanyGstinNumber,
        settings.gstinNumber,
        settings.gstRegistrationNumber,
        settings.gstin,
        settings.gstNumber
      ),
    logo,
    signature: parseLocalAsset(isNonGst ? settings.nonGstDigitalSignatureUrl : settings.gstDigitalSignatureUrl),
    bankName: isNonGst ? '' : clean(settings.gstBankName),
    bankAccount: isNonGst ? '' : clean(settings.gstBankAccountNumber),
    bankIfsc: isNonGst ? '' : clean(settings.gstBankIfsc),
    bankUpi: isNonGst ? '' : clean(settings.gstBankUpiId),
    terms: isNonGst ? clean(settings.nonGstTermsAndConditions) : clean(settings.gstTermsAndConditions)
  };
};

const splitAddressText = (value = '') => clean(value).split(/\r?\n|,/).map(clean).filter(Boolean);

const resolveAddressParts = ({ invoiceText = '', customer = {}, prefix = 'billing', fallbackAddress = '' }) => {
  const fallbackParts = splitAddressText(invoiceText || fallbackAddress);
  const attention = clean(customer[`${prefix}Attention`] || fallbackParts[0]);
  const street1 = clean(customer[`${prefix}Street1`] || customer[`${prefix}Address`] || fallbackParts[attention && fallbackParts[0] === attention ? 1 : 0]);
  const street2 = clean(customer[`${prefix}Street2`] || fallbackParts[attention && fallbackParts[0] === attention ? 2 : 1]);
  const area = clean(customer[`${prefix}Area`] || fallbackParts[attention && fallbackParts[0] === attention ? 3 : 2]);
  const state = clean(customer[`${prefix}State`] || customer.state);
  const pincode = clean(customer[`${prefix}Pincode`] || customer.pincode);
  return { attention, street1, street2, area, state, pincode };
};

const resolveBillTo = (invoice = {}, customer = {}) => {
  const parts = resolveAddressParts({
    invoiceText: invoice.billingAddressText,
    customer,
    prefix: 'billing',
    fallbackAddress: customer.billingAddress
  });
  const title = clean(customer.billingAttention) || clean(invoice.customerName) || clean(customer.displayName) || clean(customer.name) || 'Customer';
  return {
    title,
    attention: clean(parts.attention || title),
    street1: parts.street1,
    street2: parts.street2,
    area: parts.area,
    state: parts.state,
    pincode: parts.pincode,
    gstin: pickFirstText(
      customer.gstNumber,
      customer.gstin,
      customer.companyGstNumber,
      customer.billingGstNumber,
      invoice.customerGstNumber,
      invoice.gstNumber,
      invoice.gstin
    )
  };
};

const resolveShipTo = (invoice = {}, customer = {}) => {
  const parts = resolveAddressParts({
    invoiceText: invoice.shippingAddressText,
    customer,
    prefix: 'shipping',
    fallbackAddress: customer.shippingAddress || customer.billingAddress
  });
  const title = clean(customer.shippingAttention) || clean(invoice.customerName) || clean(customer.displayName) || clean(customer.name) || 'Customer';
  return {
    title,
    attention: clean(parts.attention || title),
    street1: parts.street1,
    street2: parts.street2,
    area: parts.area,
    state: parts.state,
    pincode: parts.pincode,
    gstin: pickFirstText(
      customer.gstNumber,
      customer.gstin,
      customer.companyGstNumber,
      customer.shippingGstNumber,
      invoice.customerGstNumber,
      invoice.gstNumber,
      invoice.gstin
    )
  };
};

const invoiceItems = (invoice = {}) => {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const invoiceStart = clean(invoice.servicePeriodStart || invoice.contractStartDate || invoice.startDate);
  const invoiceEnd = clean(invoice.servicePeriodEnd || invoice.contractEndDate || invoice.endDate || invoice.renewalDate);
  return items.map((item, index) => {
    const qty = toNumber(item.quantity, 0);
    const rate = toNumber(item.rate, 0);
    const taxableAmount = toNumber(item.amount, qty * rate);
    const taxRate = toNumber(item.taxRate, 0);
    const taxAmount = (taxableAmount * taxRate) / 100;
    return {
      srNo: index + 1,
      description: clean(item.itemName || item.name) || `Service ${index + 1}`,
      details: clean(item.frequency || item.description),
      contractStartDate: clean(item.contractStartDate || item.serviceStartDate || item.startDate || invoiceStart),
      contractEndDate: clean(item.contractEndDate || item.serviceEndDate || item.renewalDate || item.endDate || invoiceEnd),
      hsn: clean(item.sac || item.hsnSac || item.hsn),
      qty,
      rate,
      taxRate,
      taxAmount,
      amount: taxableAmount + taxAmount
    };
  });
};

const deriveSubjectFromItems = (invoice = {}) => {
  const explicit = clean(invoice.subject);
  if (explicit) {
    return /^invoice for\s+/i.test(explicit) ? explicit : `Invoice for ${explicit}`;
  }
  const labels = (Array.isArray(invoice.items) ? invoice.items : [])
    .map((item) => clean(item.itemName || item.name))
    .filter(Boolean);
  if (labels.length === 0) return 'Invoice for Pest Control Service';
  if (labels.length === 1) return `Invoice for ${labels[0]}`;
  if (labels.length === 2) return `Invoice for ${labels[0]} & ${labels[1]}`;
  return `Invoice for ${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
};

const deriveContractRange = (invoice = {}) => {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const starts = items.map((item) => clean(item.contractStartDate || item.serviceStartDate)).filter(Boolean);
  const ends = items.map((item) => clean(item.contractEndDate || item.serviceEndDate || item.renewalDate)).filter(Boolean);
  const start = starts[0] || clean(invoice.servicePeriodStart);
  const end = ends[0] || clean(invoice.servicePeriodEnd);
  if (!start && !end) return '';
  return `${formatDate(start)} to ${formatDate(end)}`;
};

const addressLinesForInvoiceParty = (party = {}) => [
  party.street1,
  [
    party.area,
    [party.state, party.pincode].map(clean).filter(Boolean).join('-')
  ].map(clean).filter(Boolean).join(', '),
  party.gstin ? `GSTIN: ${party.gstin}` : ''
].map(clean).filter(Boolean);

const drawCell = (doc, text, x, y, w, h, { bold = false, align = 'left', bg = null, border = COLORS.border, color = COLORS.text, size = BASE_FONT_SIZE, padX = 3, padY = 2 } = {}) => {
  if (bg) {
    doc.save();
    doc.fillColor(bg).rect(x, y, w, h).fill();
    doc.restore();
  }
  if (border && border !== 'none') {
    doc.save();
    doc.strokeColor(border).lineWidth(0.6).rect(x, y, w, h).stroke();
    doc.restore();
  }
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color).text(String(text || ''), x + padX, y + padY, {
    width: w - (padX * 2),
    height: h - (padY * 2),
    align,
    lineGap: 0.5
  });
};

const drawCenteredCell = (doc, text, x, y, w, h, options = {}) => {
  const {
    bold = false,
    align = 'left',
    bg = null,
    border = COLORS.border,
    color = COLORS.text,
    size = BASE_FONT_SIZE,
    padX = 3,
    padY = 2
  } = options;
  if (bg) {
    doc.save();
    doc.fillColor(bg).rect(x, y, w, h).fill();
    doc.restore();
  }
  if (border && border !== 'none') {
    doc.save();
    doc.strokeColor(border).lineWidth(0.6).rect(x, y, w, h).stroke();
    doc.restore();
  }
  const fontName = bold ? 'Helvetica-Bold' : 'Helvetica';
  const innerW = w - (padX * 2);
  const innerH = h - (padY * 2);
  const textHeight = doc.font(fontName).fontSize(size).heightOfString(String(text || ''), {
    width: innerW,
    lineGap: 0.5
  });
  doc.font(fontName).fontSize(size).fillColor(color).text(String(text || ''), x + padX, y + padY + Math.max(0, (innerH - textHeight) / 2), {
    width: innerW,
    height: innerH,
    align,
    lineGap: 0.5
  });
};

const drawCenteredRichCell = (doc, segments = [], x, y, w, h, options = {}) => {
  const {
    border = COLORS.border,
    color = COLORS.text,
    size = 8,
    padX = 3,
    padY = 2,
    lineGap = 1
  } = options;
  if (border && border !== 'none') {
    doc.save();
    doc.strokeColor(border).lineWidth(0.6).rect(x, y, w, h).stroke();
    doc.restore();
  }
  const innerW = w - (padX * 2);
  const segmentHeights = segments
    .filter((segment) => clean(segment.text))
    .map((segment) => doc.font(segment.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(segment.size || size).heightOfString(segment.text, {
      width: innerW,
      lineGap
    }));
  const totalTextHeight = segmentHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, segmentHeights.length - 1);
  let cursorY = y + padY + Math.max(0, ((h - (padY * 2)) - totalTextHeight) / 2);

  segments.forEach((segment) => {
    const text = clean(segment.text);
    if (!text) return;
    const fontName = segment.bold ? 'Helvetica-Bold' : 'Helvetica';
    const fontSize = segment.size || size;
    doc.font(fontName).fontSize(fontSize).fillColor(segment.color || color).text(text, x + padX, cursorY, {
      width: innerW,
      lineGap,
      align: segment.align || 'left'
    });
    cursorY = doc.y + 1;
  });
};

const generateInvoicePdfBuffer = async ({ invoice = {}, customer = {}, settings = {} }) => {
  const company = resolveCompany(settings, invoice);
  const billTo = resolveBillTo(invoice, customer);
  const shipTo = resolveShipTo(invoice, customer);
  const rows = invoiceItems(invoice);

  const subtotal = toNumber(invoice.subtotal, rows.reduce((sum, r) => sum + (r.amount - r.taxAmount), 0));
  const totalTax = toNumber(invoice.totalTax, rows.reduce((sum, r) => sum + r.taxAmount, 0));
  const roundOff = toNumber(invoice.roundOff, 0);
  const total = toNumber(invoice.total, subtotal + totalTax + roundOff);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: {
      Title: `Invoice ${clean(invoice.invoiceNumber)}`,
      Author: company.name
    }
  });

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = PAGE_MARGIN.left;
    const top = PAGE_MARGIN.top;
    const right = doc.page.width - PAGE_MARGIN.right;
    const bottom = doc.page.height - PAGE_MARGIN.bottom;
    const contentW = right - left;
    const footerReserved = 34;

    // Watermark logo with transparency (blur not supported in pdfkit)
    if (company.logo) {
      try {
        const watermarkW = contentW - 160;
        const watermarkH = 320;
        const watermarkX = left + 80;
        const usableTop = top + 10;
        const usableBottom = bottom - footerReserved - 10;
        const watermarkY = usableTop + ((usableBottom - usableTop - watermarkH) / 2);
        doc.save();
        doc.opacity(0.18);
        doc.image(company.logo, watermarkX, watermarkY, { fit: [watermarkW, watermarkH], align: 'center', valign: 'center' });
        doc.restore();
      } catch (_e) {
        console.error('Invoice PDF watermark logo failed:', company.logo, _e.message);
      }
    }

    let y = top;

    const newPage = () => {
      doc.addPage();
      y = top;
      drawFooterFrame();
      drawTableHeader();
    };

    const ensureSpace = (h) => {
      if (y + h <= bottom - footerReserved) return;
      newPage();
    };

    const drawFooterFrame = () => {
      const fy = bottom - 18;
      doc.moveTo(left, fy - 4).lineTo(right, fy - 4).lineWidth(0.6).strokeColor('#d1d5db').stroke();
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.label).text('Thank you for your business', left, fy, { width: contentW * 0.55 });
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.label).text('Powered by Skuas Master CRM', left, fy + 9, { width: contentW * 0.55 });
    };

    // Header
    const headerH = 118;
    drawCell(doc, '', left, y, contentW, headerH, { border: 'none' });

    const logoBoxW = 102;
    const logoBoxH = 75;
    if (company.logo) {
      try { doc.image(company.logo, left + 11, y + 11, { fit: [logoBoxW - 6, logoBoxH - 6] }); } catch (_e) {
        console.error('Invoice PDF header logo failed:', company.logo, _e.message);
      }
    } else {
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('LOGO', left + 26, y + 30);
    }

    const companyX = left + 82;
    const companyW = contentW - 292;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.text).text(company.name, companyX, y + 8, { width: companyW });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(company.tagline || '', companyX, y + 20, { width: companyW });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    const addressLines = [
      company.address1,
      company.address2,
      [company.city, company.state, company.pincode].filter(Boolean).join(', '),
      company.phone ? `Mobile: ${company.phone}` : '',
      `E Mail Id: ${company.email || 'info@skuaspestcontrol.com'}`,
      `Visit Us: ${company.website || '-'}`,
      !company.isNonGst ? (company.gstin ? `GST Details: ${company.gstin}` : 'GST Details: ') : ''
    ].filter((line) => line !== '');

    let ay = y + 32;
    addressLines.forEach((line) => {
      doc.text(line, companyX, ay, { width: companyW, lineGap: 0 });
      ay = doc.y;
    });

    const rightW = 252;
    const rightX = right - rightW;
    doc.font('Helvetica-Bold').fontSize(18).fillColor(company.primaryColor).text('TAX INVOICE', rightX, y + 8, { width: rightW, align: 'right' });

    const meta = [
      ['Invoice #', clean(invoice.invoiceNumber) || '-'],
      ['Invoice Date', formatDate(invoice.date)],
      ['Sales Person', clean(invoice.salesperson) || '-']
    ];
    const metaLabelW = 92;
    let my = y + 56;
    meta.forEach(([label, value]) => {
      doc.font('Helvetica').fontSize(9.8).fillColor(COLORS.text).text(`${label} :`, rightX, my, { width: metaLabelW, align: 'left' });
      doc.text(value, rightX + metaLabelW, my, { width: rightW - metaLabelW, align: 'right' });
      my += 11;
    });

    y += headerH + 8;

    // Bill To and Ship To
    const cardGap = 6;
    const cardW = (contentW - cardGap) / 2;
    const cardH = 78;

    drawCell(doc, 'Bill To', left + 5, y, cardW - 5, 14, { bold: true, color: company.primaryColor, size: 9.8, border: 'none', padX: 0, padY: 1 });
    drawCell(doc, '', left, y + 14, cardW, cardH - 14, { border: 'none' });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text).text(billTo.attention || billTo.title, left + 5, y + 16, { width: cardW - 10, lineGap: 1 });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text)
      .text(addressLinesForInvoiceParty(billTo).join('\n'), left + 5, y + 28, { width: cardW - 10, lineGap: 1 });

    const shipX = left + cardW + cardGap;
    drawCell(doc, 'Ship To', shipX + 5, y, cardW - 5, 14, { bold: true, color: company.primaryColor, size: 9.8, border: 'none', padX: 0, padY: 1 });
    drawCell(doc, '', shipX, y + 14, cardW, cardH - 14, { border: 'none' });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text).text(shipTo.attention || shipTo.title, shipX + 5, y + 16, { width: cardW - 10, lineGap: 1 });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text)
      .text(addressLinesForInvoiceParty(shipTo).join('\n'), shipX + 5, y + 28, { width: cardW - 10, lineGap: 1 });

    y += cardH + 2;

    // Subject row
    const subjectH = 16;
    drawCell(doc, '', left, y, contentW, subjectH, { border: 'none' });
    doc.font('Helvetica-Bold').fontSize(9.8).fillColor(company.primaryColor).text('Subject :', left + 2, y + 3);
    doc.font('Helvetica').fontSize(9.8).fillColor(COLORS.text).text(deriveSubjectFromItems(invoice), left + 52, y + 3, { width: contentW - 54 });
    y += subjectH + 6;

    // Items table
    const colPct = { sr: 6, item: 42, hsn: 12, qty: 10, rate: 14, amount: 16 };
    const totalPct = Object.values(colPct).reduce((s, n) => s + n, 0);
    const scale = contentW / totalPct;
    const cols = [
      { k: 'srNo', l: 'Sr No', w: colPct.sr * scale, a: 'center' },
      { k: 'desc', l: 'Frequency', w: colPct.item * scale, a: 'left' },
      { k: 'hsn', l: 'HSN/SAC', w: colPct.hsn * scale, a: 'center' },
      { k: 'qty', l: 'Qty', w: colPct.qty * scale, a: 'right' },
      { k: 'rate', l: 'Rate', w: colPct.rate * scale, a: 'right' },
      { k: 'amount', l: 'Amount', w: colPct.amount * scale, a: 'right' }
    ];

    const drawTableHeader = () => {
      let cx = left;
      cols.forEach((c) => {
        drawCell(doc, c.l, cx, y, c.w, 20, { bold: true, bg: COLORS.headerBg, align: c.a, size: 8, border: COLORS.border, color: '#000000', padY: 5 });
        cx += c.w;
      });
      y += 20;
    };

    drawTableHeader();

    const safeRows = rows.length ? rows : [{ srNo: 1, description: '-', details: '', hsn: '', qty: 0, rate: 0, taxRate: 0, taxAmount: 0, amount: 0 }];
    safeRows.forEach((row) => {
      const contractLine = row.contractStartDate || row.contractEndDate
        ? `Contract: ${formatDate(row.contractStartDate) || '-'} to ${formatDate(row.contractEndDate) || '-'}`
        : '';
      const desc = [row.description, row.details, contractLine].filter(Boolean).join('\n');
      const descH = doc.heightOfString(desc, { width: cols[1].w - 8, lineGap: 1 });
      const rh = Math.max(20, descH + 7);
      ensureSpace(rh + 2);

      let cx = left;
      const values = {
        srNo: String(row.srNo),
        desc,
        hsn: row.hsn || '',
        qty: row.qty.toFixed(2),
        rate: formatINR(row.rate),
        amount: formatINR(row.amount)
      };

      cols.forEach((c) => {
        if (c.k === 'desc') {
          drawCenteredRichCell(doc, [
            { text: row.description, bold: true },
            { text: row.details, bold: false },
            { text: contractLine, bold: false }
          ], cx, y, c.w, rh, { size: 8, border: COLORS.border, color: '#000000', lineGap: 1 });
        } else {
          drawCenteredCell(doc, values[c.k], cx, y, c.w, rh, { align: c.a, size: 8, border: COLORS.border, bold: false, color: '#000000' });
        }
        cx += c.w;
      });

      y += rh;
    });

    y += 6;

    // Summary block
    const leftW = contentW * 0.58;
    const rightW2 = contentW - leftW - 6;
    const sumLeftX = left;
    const sumRightX = left + leftW + 6;

    const bankLines = company.bankName
      ? [
          `Bank Name: ${company.bankName}`,
          `A/C No: ${company.bankAccount}`,
          `IFSC: ${company.bankIfsc}`
        ]
      : [''];

    const termsText = company.terms || '';
    const leftPreviewLines = [
      'PAYMENT DETAILS:',
      ...bankLines,
      '',
      'TERMS & CONDITIONS:',
      termsText
    ];
    const leftH = Math.max(118, doc.heightOfString(leftPreviewLines.join('\n'), { width: leftW - 10, lineGap: 1 }) + 10);
    const rightH = leftH;
    ensureSpace(Math.max(leftH, rightH) + 8);

    drawCell(doc, '', sumLeftX, y, leftW, leftH, { border: 'none' });
    let ly = y + 4;
    const headingStyle = { font: 'Helvetica-Bold', size: 9.8, color: company.primaryColor };
    const bodyStyle = { font: 'Helvetica', size: 8, color: COLORS.text };
    const drawLine = (text, style) => {
      if (!text) {
        ly += 6;
        return;
      }
      doc.font(style.font).fontSize(style.size).fillColor(style.color).text(text, sumLeftX + 5, ly, { width: leftW - 10, lineGap: 1 });
      ly = doc.y + 1;
    };
    drawLine('PAYMENT DETAILS:', headingStyle);
    bankLines.forEach((line) => drawLine(line, bodyStyle));
    drawLine('', bodyStyle);
    drawLine('TERMS & CONDITIONS:', headingStyle);
    drawLine(termsText, bodyStyle);

    drawCell(doc, '', sumRightX, y, rightW2, rightH, { border: 'none' });
    let igst = toNumber(invoice.igstAmount, 0);
    let cgst = toNumber(invoice.cgstAmount, 0);
    let sgst = toNumber(invoice.sgstAmount, 0);
    if (!company.isNonGst && igst === 0 && cgst === 0 && sgst === 0 && totalTax > 0) {
      const companyState = clean(company.state).toLowerCase();
      const supplyState = clean(invoice.placeOfSupply).toLowerCase();
      if (companyState && supplyState && supplyState.includes(companyState)) {
        cgst = totalTax / 2;
        sgst = totalTax / 2;
      } else {
        igst = totalTax;
      }
    }

    const summaryRows = [
      ['Sub Total', formatINR(subtotal)],
      ['IGST', formatINR(company.isNonGst ? 0 : igst)],
      ['CGST', formatINR(company.isNonGst ? 0 : cgst)],
      ['SGST', formatINR(company.isNonGst ? 0 : sgst)],
      ['Rounding', formatINR(roundOff)],
      ['Grand Total', formatINR(total)]
    ];

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#12364a').text('AMOUNT SUMMARY', sumRightX + 10, y + 4, { width: rightW2 - 20, align: 'left' });
    let sy = y + 20;
    summaryRows.forEach(([k, v]) => {
      const isGrand = k === 'Grand Total';
      drawCell(doc, '', sumRightX + 6, sy, rightW2 - 12, 20, { border: 'none', bg: isGrand ? '#e5e7eb' : null });
      doc.font(isGrand ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(COLORS.text).text(k, sumRightX + 10, sy + 6, { width: (rightW2 - 20) * 0.55 });
      doc.font(isGrand ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(COLORS.text).text(v, sumRightX + 10 + ((rightW2 - 20) * 0.55), sy + 6, { width: (rightW2 - 20) * 0.45, align: 'right' });
      sy += 20;
    });

    const wordsY = sy + 8;
    drawCell(doc, '', sumRightX + 6, wordsY, rightW2 - 12, 42, { border: 'none', bg: null });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#12364a').text('AMOUNT IN WORDS', sumRightX + 10, wordsY + 8, {
      width: rightW2 - 20,
      align: 'center'
    });
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#1f2937').text(amountToWords(total), sumRightX + 10, wordsY + 24, {
      width: rightW2 - 20,
      align: 'center',
      lineBreak: false
    });

    y += Math.max(leftH, rightH) + 6;

    // Signature section anchored just above footer line with minimal gap
    const sigH = 18;
    const footerLineY = bottom - 22;
    const sigGapFromFooter = 3;
    y = Math.max(y, footerLineY - sigGapFromFooter - sigH);
    const rightSigX = left + (contentW / 2);
    const rightSigW = contentW / 2;
    drawCell(doc, 'Receiver Signature', left, y, contentW / 2, sigH, { align: 'left', size: 9, border: 'none' });
    drawCell(doc, 'Authorized Signature', rightSigX, y, rightSigW, sigH, { align: 'right', size: 9, border: 'none' });
    if (company.signature) {
      try { doc.image(company.signature, rightSigX + 4, y - 14, { fit: [rightSigW - 8, 12], align: 'center' }); } catch (_e) {}
    }

    // Draw footer on all pages
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      drawFooterFrame();
      const fy = bottom - 9;
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.label).text(`Page ${i + 1} of ${range.count}`, right - 70, fy, { width: 70, align: 'right' });
    }

    doc.end();
  });
};

module.exports = {
  generateInvoicePdfBuffer,
  formatINR,
  formatDate,
  amountToWords
};
