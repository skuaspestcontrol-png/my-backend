const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const COLORS = {
  label: '#333333',
  text: '#000000',
  border: '#9e9e9e',
  headerBg: '#f2f3f4',
  title: '#000000'
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
  const uploadsDir = String(process.env.UPLOADS_DIR || process.env.PERSISTENT_UPLOADS_DIR || '').trim()
    || path.join(__dirname, '..', 'storage', 'uploads');
  const resolveUploadLocal = (fileName) => path.join(uploadsDir, fileName);

  if (raw.startsWith('/uploads/')) {
    const local = resolveUploadLocal(path.basename(raw));
    if (fs.existsSync(local)) return local;
  }

  if (raw.startsWith('/')) {
    const local = path.join(__dirname, raw);
    if (fs.existsSync(local)) return local;
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

const resolveCompany = (settings = {}, invoice = {}) => {
  const isNonGst = clean(invoice.invoiceType).toUpperCase() === 'NON GST';
  const address1 = clean((isNonGst ? settings.nonGstBillingAddress : settings.gstBillingAddress) || settings.companyAddress);
  const rawAddress2 = clean((isNonGst ? settings.nonGstAddress : '') || '');
  const address2 = rawAddress2 && rawAddress2 !== address1 ? rawAddress2 : '';
  return {
    isNonGst,
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
    logo: parseLocalAsset((isNonGst ? settings.nonGstCompanyLogoUrl : settings.gstCompanyLogoUrl) || settings.dashboardImageUrl),
    signature: parseLocalAsset(settings.gstDigitalSignatureUrl),
    bankName: isNonGst ? '' : clean(settings.gstBankName),
    bankAccount: isNonGst ? '' : clean(settings.gstBankAccountNumber),
    bankIfsc: isNonGst ? '' : clean(settings.gstBankIfsc),
    bankUpi: isNonGst ? '' : clean(settings.gstBankUpiId),
    terms: isNonGst ? clean(settings.nonGstTermsAndConditions) : clean(settings.gstTermsAndConditions)
  };
};

const resolveBillTo = (invoice = {}, customer = {}) => {
  const title = clean(customer.billingAttention) || clean(invoice.customerName) || clean(customer.displayName) || clean(customer.name) || 'Customer';
  return {
    title,
    address: clean(customer.billingAddress || customer.billingStreet1 || invoice.billingAddressText),
    state: clean(customer.billingState || customer.state),
    country: clean(customer.billingCountry),
    pincode: clean(customer.billingPincode || customer.pincode),
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
  const title = clean(customer.shippingAttention) || clean(invoice.customerName) || clean(customer.displayName) || clean(customer.name) || 'Customer';
  return {
    title,
    address: clean(customer.shippingAddress || customer.shippingStreet1 || invoice.shippingAddressText || customer.billingAddress),
    state: clean(customer.shippingState || customer.state),
    country: clean(customer.shippingCountry),
    pincode: clean(customer.shippingPincode || customer.pincode),
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
  return items.map((item, index) => {
    const qty = toNumber(item.quantity, 0);
    const rate = toNumber(item.rate, 0);
    const taxableAmount = toNumber(item.amount, qty * rate);
    const taxRate = toNumber(item.taxRate, 0);
    const taxAmount = (taxableAmount * taxRate) / 100;
    return {
      srNo: index + 1,
      description: clean(item.itemName || item.name) || `Service ${index + 1}`,
      details: clean(item.description),
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
  if (clean(invoice.subject)) return clean(invoice.subject);
  const labels = (Array.isArray(invoice.items) ? invoice.items : [])
    .map((item) => clean(item.itemName || item.name))
    .filter(Boolean);
  if (labels.length === 0) return 'Pest Control Service';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
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
        doc.save();
        doc.opacity(0.12);
        doc.image(company.logo, left + 80, top + 160, { fit: [contentW - 160, 320], align: 'center', valign: 'center' });
        doc.restore();
      } catch (_e) {
        // ignore watermark issues
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

    const logoBoxW = 68;
    const logoBoxH = 50;
    if (company.logo) {
      try { doc.image(company.logo, left + 11, y + 11, { fit: [logoBoxW - 6, logoBoxH - 6] }); } catch (_e) {}
    } else {
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('LOGO', left + 26, y + 30);
    }

    const companyX = left + 82;
    const companyW = contentW - 260;
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
      company.gstin ? `GST Details: ${company.gstin}` : 'GST Details: '
    ].filter((line) => line !== '');

    let ay = y + 32;
    addressLines.forEach((line) => {
      doc.text(line, companyX, ay, { width: companyW, lineGap: 0 });
      ay = doc.y;
    });

    const rightX = right - 220;
    const rightW = 212;
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.title).text('TAX INVOICE', rightX, y + 8, { width: rightW, align: 'right' });

    const meta = [
      ['Invoice #', clean(invoice.invoiceNumber) || '-'],
      ['Invoice Date', formatDate(invoice.date)],
      ['Salesperson', clean(invoice.salesperson) || '-']
    ];
    let my = y + 34;
    meta.forEach(([k, v]) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#6b7280').text(`${k} :`, rightX + 6, my, { width: 92, align: 'left' });
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.text).text(`${v}`, rightX + 98, my, { width: rightW - 100, align: 'left' });
      my += 12;
    });

    y += headerH + 8;

    // Bill To and Ship To
    const cardGap = 6;
    const cardW = (contentW - cardGap) / 2;
    const cardH = 102;

    drawCell(doc, 'Bill To', left, y, cardW, 16, { bold: true, color: '#ef4444', size: 10, border: 'none' });
    drawCell(doc, '', left, y + 16, cardW, cardH - 16, { border: 'none' });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text).text(billTo.title, left + 5, y + 22, { width: cardW - 10, lineGap: 1 });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(
      [
        billTo.address,
        `State: ${billTo.state || '-'}`,
        `Pincode - ${billTo.pincode || '-'}`,
        `GSTIN: ${billTo.gstin || ''}`
      ].join('\n'),
      left + 5,
      y + 34,
      { width: cardW - 10, lineGap: 1 }
    );

    const shipX = left + cardW + cardGap;
    drawCell(doc, 'Ship To', shipX, y, cardW, 16, { bold: true, color: '#ef4444', size: 10, border: 'none' });
    drawCell(doc, '', shipX, y + 16, cardW, cardH - 16, { border: 'none' });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text).text(shipTo.title, shipX + 5, y + 22, { width: cardW - 10, lineGap: 1 });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(
      [
        shipTo.address,
        `State: ${shipTo.state || '-'}`,
        `Pincode - ${shipTo.pincode || '-'}`,
        `GSTIN: ${shipTo.gstin || ''}`
      ].join('\n'),
      shipX + 5,
      y + 34,
      { width: cardW - 10, lineGap: 1 }
    );

    y += cardH + 6;

    // Subject row
    const subjectH = 16;
    drawCell(doc, '', left, y, contentW, subjectH, { border: 'none' });
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ef4444').text('Subject :', left + 2, y + 3);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(deriveSubjectFromItems(invoice), left + 52, y + 3, { width: contentW - 54 });
    y += subjectH + 6;

    // Items table
    const colPct = { sr: 6, item: 42, hsn: 12, qty: 10, rate: 14, amount: 16 };
    const totalPct = Object.values(colPct).reduce((s, n) => s + n, 0);
    const scale = contentW / totalPct;
    const cols = [
      { k: 'srNo', l: 'Sr No', w: colPct.sr * scale, a: 'center' },
      { k: 'desc', l: 'Service Description', w: colPct.item * scale, a: 'left' },
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
      const desc = [row.description, row.details].filter(Boolean).join('\n');
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
        drawCell(doc, values[c.k], cx, y, c.w, rh, { align: c.a, size: 8, border: COLORS.border, bold: c.k === 'desc', color: '#000000' });
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
          `IFSC: ${company.bankIfsc}`,
          `UPI ID: ${company.bankUpi}`
        ]
      : [''];

    const leftText = [
      `Total In Words: ${amountToWords(total)}`,
      '',
      'Bank Account Details:',
      ...bankLines,
      '',
      `Contract Duration: ${deriveContractRange(invoice) || '-'}`,
      '',
      'Terms & Conditions:',
      company.terms || ''
    ].join('\n');

    const leftH = Math.max(118, doc.heightOfString(leftText, { width: leftW - 10, lineGap: 1 }) + 10);
    const rightH = leftH;
    ensureSpace(Math.max(leftH, rightH) + 8);

    drawCell(doc, '', sumLeftX, y, leftW, leftH, { border: 'none' });
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text).text(leftText, sumLeftX + 5, y + 4, { width: leftW - 10, lineGap: 1 });

    drawCell(doc, '', sumRightX, y, rightW2, rightH, { border: COLORS.border });
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

    let sy = y + 6;
    summaryRows.forEach(([k, v]) => {
      const isGrand = k === 'Grand Total';
      drawCell(doc, '', sumRightX + 6, sy, rightW2 - 12, 20, { border: COLORS.border, bg: isGrand ? COLORS.headerBg : null });
      doc.font(isGrand ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(COLORS.text).text(k, sumRightX + 10, sy + 6, { width: (rightW2 - 20) * 0.55 });
      doc.font(isGrand ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(COLORS.text).text(v, sumRightX + 10 + ((rightW2 - 20) * 0.55), sy + 6, { width: (rightW2 - 20) * 0.45, align: 'right' });
      sy += 20;
    });

    y += Math.max(leftH, rightH) + 6;

    // Signature section compact
    y -= 10;
    const sigH = 34;
    ensureSpace(sigH + 8);
    drawCell(doc, 'Receiver Signature', left, y, contentW / 2, sigH, { align: 'left', size: 9, border: 'none' });
    drawCell(doc, 'Authorized Signature', left + (contentW / 2), y, contentW / 2, sigH, { align: 'right', size: 9, border: 'none' });
    if (company.signature) {
      try { doc.image(company.signature, right - 120, y + 4, { fit: [88, 18] }); } catch (_e) {}
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
  formatDate
};
