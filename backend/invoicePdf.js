const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const BRAND = {
  red: '#ef4444',
  text: '#111827',
  border: '#9ca3af',
  tableHead: '#f3f4f6',
  muted: '#6b7280'
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clean = (value) => String(value ?? '').trim();

const formatINR = (value) => {
  const n = toNumber(value, 0);
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value) => {
  const raw = clean(value);
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  if (raw.startsWith('/uploads/')) {
    const local = path.join(__dirname, raw);
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
      const local = path.join(__dirname, 'uploads', fileName);
      if (fs.existsSync(local)) return local;
    }
  } catch (_error) {
    if (fs.existsSync(raw)) return raw;
  }

  return '';
};

const invoiceItems = (invoice = {}) => {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  return items.map((item, index) => {
    const qty = toNumber(item.quantity, 0);
    const rate = toNumber(item.rate, 0);
    const baseAmount = toNumber(item.amount, qty * rate);
    const lineTaxRate = toNumber(item.taxRate, 0);
    return {
      srNo: index + 1,
      service: clean(item.itemName || item.name) || `Service ${index + 1}`,
      description: clean(item.description),
      sac: clean(item.sac || item.hsnSac || item.hsn),
      qty,
      rate,
      lineTaxRate,
      baseAmount,
      igstAmount: (baseAmount * lineTaxRate) / 100
    };
  });
};

const resolveCompany = (settings = {}) => {
  const state = clean(settings.gstState || settings.companyState);
  const company = {
    name: clean(settings.gstCompanyName || settings.companyName) || 'SKUAS Pest Control',
    address: clean(settings.gstBillingAddress || settings.companyAddress),
    city: clean(settings.gstCity || settings.companyCity),
    state,
    pincode: clean(settings.gstPincode || settings.companyPincode),
    phone: clean(settings.gstPhone || settings.companyMobile),
    email: clean(settings.gstEmail || settings.companyEmail),
    website: clean(settings.companyWebsite),
    gst: clean(settings.companyGstNumber || settings.gstRegistrationNumber),
    logo: parseLocalAsset(settings.gstCompanyLogoUrl || settings.dashboardImageUrl),
    signature: parseLocalAsset(settings.gstDigitalSignatureUrl),
    stamp: parseLocalAsset(settings.gstCompanyStampUrl),
    bankName: clean(settings.gstBankName),
    bankAccountNumber: clean(settings.gstBankAccountNumber),
    bankIfsc: clean(settings.gstBankIfsc),
    bankBranch: clean(settings.gstBankBranch),
    bankUpiId: clean(settings.gstBankUpiId),
    termsGst: clean(settings.gstTermsAndConditions),
    termsNonGst: clean(settings.nonGstTermsAndConditions)
  };

  const compactAddress = [company.address, [company.city, company.state, company.pincode].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(', ');

  return { ...company, compactAddress };
};

const resolveBillTo = (invoice = {}, customer = {}) => {
  const title = clean(invoice.customerName)
    || clean(customer.displayName)
    || clean(customer.companyName)
    || clean(customer.name)
    || 'Customer';

  const manual = clean(invoice.billingAddressText);
  if (manual) {
    return {
      title,
      lines: manual.split(/\n+/).map((line) => line.trim()).filter(Boolean),
      gst: clean(customer.gstNumber),
      mobile: clean(customer.mobileNumber),
      email: clean(customer.emailId)
    };
  }

  const lines = [
    clean(customer.billingAddress || customer.billingStreet1),
    clean(customer.billingStreet2),
    clean(customer.billingArea),
    [clean(customer.billingCity || customer.city), clean(customer.billingState || customer.state), clean(customer.billingPincode || customer.pincode)]
      .filter(Boolean)
      .join(', ')
  ].filter(Boolean);

  return {
    title,
    lines,
    gst: clean(customer.gstNumber),
    mobile: clean(customer.mobileNumber),
    email: clean(customer.emailId)
  };
};

const resolveShipTo = (invoice = {}, customer = {}) => {
  const title = clean(invoice.customerName)
    || clean(customer.displayName)
    || clean(customer.companyName)
    || clean(customer.name)
    || 'Customer';

  const manual = clean(invoice.shippingAddressText);
  if (manual) {
    return {
      title,
      lines: manual.split(/\n+/).map((line) => line.trim()).filter(Boolean)
    };
  }

  const lines = [
    clean(customer.shippingAddress || customer.shippingStreet1 || customer.billingAddress),
    clean(customer.shippingStreet2),
    clean(customer.shippingArea || customer.billingArea),
    [clean(customer.shippingCity || customer.city), clean(customer.shippingState || customer.state), clean(customer.shippingPincode || customer.pincode)]
      .filter(Boolean)
      .join(', ')
  ].filter(Boolean);

  return { title, lines };
};

const getServicePeriod = (invoice = {}) => {
  if (clean(invoice.servicePeriod)) return clean(invoice.servicePeriod);
  if (clean(invoice.servicePeriodStart) || clean(invoice.servicePeriodEnd)) {
    return `${formatDate(invoice.servicePeriodStart)} to ${formatDate(invoice.servicePeriodEnd)}`;
  }
  return 'As per agreement';
};

const drawRect = (doc, x, y, w, h, borderColor = BRAND.border, fillColor = null, lineWidth = 0.8) => {
  doc.save();
  doc.lineWidth(lineWidth);
  if (fillColor) {
    doc.fillColor(fillColor).rect(x, y, w, h).fill();
  }
  doc.strokeColor(borderColor).rect(x, y, w, h).stroke();
  doc.restore();
};

const textCell = (doc, text, x, y, w, h, options = {}) => {
  const {
    size = 8.5,
    font = 'Helvetica',
    color = BRAND.text,
    align = 'left',
    padX = 4,
    padY = 4,
    lineGap = 1
  } = options;

  doc.font(font).fontSize(size).fillColor(color).text(String(text || ''), x + padX, y + padY, {
    width: w - (padX * 2),
    height: h - (padY * 2),
    align,
    lineGap
  });
};

const safeImage = (doc, imgPath, x, y, fit) => {
  if (!imgPath) return false;
  try {
    doc.image(imgPath, x, y, { fit, align: 'center', valign: 'center' });
    return true;
  } catch (_error) {
    return false;
  }
};

const deriveTaxMode = ({ invoiceType, placeOfSupply, companyState }) => {
  const nonGst = clean(invoiceType).toUpperCase() === 'NON GST';
  if (nonGst) return 'NON_GST';
  if (!clean(placeOfSupply) || !clean(companyState)) return 'IGST';
  return clean(placeOfSupply).toLowerCase() === clean(companyState).toLowerCase() ? 'CGST_SGST' : 'IGST';
};

const generateInvoicePdfBuffer = async ({ invoice = {}, customer = {}, settings = {} }) => {
  const company = resolveCompany(settings);
  const billTo = resolveBillTo(invoice, customer);
  const shipTo = resolveShipTo(invoice, customer);
  const rows = invoiceItems(invoice);

  const subtotal = toNumber(invoice.subtotal, rows.reduce((sum, r) => sum + r.baseAmount, 0));
  const totalTax = toNumber(invoice.totalTax, rows.reduce((sum, r) => sum + r.igstAmount, 0));
  const roundOff = toNumber(invoice.roundOff, 0);
  const total = toNumber(invoice.total, subtotal + totalTax + roundOff);
  const balanceDue = toNumber(invoice.balanceDue, total);

  const taxMode = deriveTaxMode({
    invoiceType: invoice.invoiceType,
    placeOfSupply: invoice.placeOfSupply,
    companyState: company.state
  });

  const termsText = taxMode === 'NON_GST'
    ? (company.termsNonGst || 'Payment due as per terms agreed.')
    : (company.termsGst || 'GST payable as applicable. Payment due as per terms agreed.');

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 24,
    info: {
      Title: `Invoice ${clean(invoice.invoiceNumber) || ''}`,
      Author: company.name
    }
  });

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const left = doc.page.margins.left;
    const right = pageWidth - doc.page.margins.right;
    const usableWidth = right - left;

    let pageNo = 1;
    const drawPageFrame = () => {
      drawRect(doc, left, doc.page.margins.top, usableWidth, pageHeight - doc.page.margins.top - doc.page.margins.bottom, BRAND.border, null, 0.8);
      doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text('POWERED BY SKUAS MASTER CRM', left + 8, pageHeight - doc.page.margins.bottom - 16, {
        width: usableWidth / 2,
        align: 'left'
      });
      doc.font('Helvetica').fontSize(8).fillColor(BRAND.muted).text(`Page ${pageNo}`, right - 80, pageHeight - doc.page.margins.bottom - 16, {
        width: 72,
        align: 'right'
      });
    };

    drawPageFrame();

    const addPage = () => {
      doc.addPage();
      pageNo += 1;
      drawPageFrame();
    };

    let y = doc.page.margins.top + 8;

    const headerHeight = 118;
    const headerY = y;
    drawRect(doc, left + 8, headerY, usableWidth - 16, headerHeight, BRAND.border, null);

    const logoX = left + 18;
    const logoY = headerY + 12;
    const logoW = 82;
    const logoH = 72;
    drawRect(doc, logoX, logoY, logoW, logoH, BRAND.border);
    if (!safeImage(doc, company.logo, logoX + 4, logoY + 4, [logoW - 8, logoH - 8])) {
      textCell(doc, 'LOGO', logoX, logoY, logoW, logoH, { align: 'center', color: BRAND.muted });
    }

    const companyX = logoX + logoW + 10;
    const companyW = usableWidth - 250;
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND.text).text(company.name, companyX, logoY + 2, { width: companyW });
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.text);
    const companyLines = [
      company.compactAddress,
      [company.phone ? `Phone: ${company.phone}` : '', company.email ? `Email: ${company.email}` : ''].filter(Boolean).join(' | '),
      company.website ? `Website: ${company.website}` : '',
      company.gst ? `GSTIN: ${company.gst}` : ''
    ].filter(Boolean);
    let companyY = logoY + 22;
    companyLines.forEach((line) => {
      doc.text(line, companyX, companyY, { width: companyW, lineGap: 1 });
      companyY = doc.y + 1;
    });

    const rightMetaX = right - 210;
    const rightMetaW = 190;
    doc.font('Helvetica-Bold').fontSize(20).fillColor(BRAND.red).text('TAX INVOICE', rightMetaX, logoY + 4, { width: rightMetaW, align: 'right' });

    const metaTop = logoY + 34;
    const metaRows = [
      ['Invoice #', clean(invoice.invoiceNumber) || '-'],
      ['Invoice Date', formatDate(invoice.date)],
      ['Place Of Supply', clean(invoice.placeOfSupply) || '-'],
      ['Salesperson', clean(invoice.salesperson) || '-']
    ];
    let metaY = metaTop;
    metaRows.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND.muted).text(label, rightMetaX, metaY, { width: 78 });
      doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.text).text(`: ${value}`, rightMetaX + 74, metaY, { width: rightMetaW - 74, align: 'left' });
      metaY += 14;
    });

    y = headerY + headerHeight + 8;

    const twoColW = (usableWidth - 20) / 2;
    const blockH = 112;

    const billX = left + 8;
    const shipX = billX + twoColW + 4;

    drawRect(doc, billX, y, twoColW, blockH, BRAND.border);
    drawRect(doc, shipX, y, twoColW, blockH, BRAND.border);

    textCell(doc, 'Bill To', billX + 1, y + 1, twoColW - 2, 16, { font: 'Helvetica-Bold', size: 10, color: BRAND.red });
    textCell(doc, 'Ship To', shipX + 1, y + 1, twoColW - 2, 16, { font: 'Helvetica-Bold', size: 10, color: BRAND.red });

    const leftText = [billTo.title, ...billTo.lines];
    if (billTo.gst) leftText.push(`GSTIN: ${billTo.gst}`);
    if (billTo.mobile) leftText.push(`Mobile: ${billTo.mobile}`);
    if (billTo.email) leftText.push(`Email: ${billTo.email}`);

    textCell(doc, leftText.join('\n'), billX + 2, y + 18, twoColW - 4, blockH - 20, { size: 8.7, lineGap: 1 });
    textCell(doc, [shipTo.title, ...shipTo.lines].join('\n'), shipX + 2, y + 18, twoColW - 4, blockH - 20, { size: 8.7, lineGap: 1 });

    y += blockH + 6;

    const subjectH = 40;
    drawRect(doc, left + 8, y, usableWidth - 16, subjectH, BRAND.border);
    textCell(doc, 'Subject', left + 10, y + 3, 120, 12, { font: 'Helvetica-Bold', size: 9, color: BRAND.red });
    textCell(doc, clean(invoice.subject) || 'Pest control service invoice', left + 10, y + 14, usableWidth - 220, 22, { size: 9 });
    textCell(doc, `Service Period: ${getServicePeriod(invoice)}`, right - 250, y + 14, 230, 22, { size: 9, align: 'right' });

    y += subjectH + 8;

    const tableX = left + 8;
    const tableW = usableWidth - 16;
    const cols = taxMode === 'NON_GST'
      ? [
          { key: 'srNo', label: 'Sr No', w: 38, align: 'center' },
          { key: 'service', label: 'Service', w: 178, align: 'left' },
          { key: 'sac', label: 'HSN/SAC', w: 66, align: 'center' },
          { key: 'qty', label: 'Qty', w: 48, align: 'right' },
          { key: 'rate', label: 'Rate', w: 70, align: 'right' },
          { key: 'taxLabel', label: 'Tax %', w: 54, align: 'right' },
          { key: 'taxAmt', label: 'Tax Amt', w: 72, align: 'right' },
          { key: 'amount', label: 'Amount', w: 90, align: 'right' }
        ]
      : [
          { key: 'srNo', label: 'Sr No', w: 38, align: 'center' },
          { key: 'service', label: 'Service', w: 178, align: 'left' },
          { key: 'sac', label: 'HSN/SAC', w: 66, align: 'center' },
          { key: 'qty', label: 'Qty', w: 48, align: 'right' },
          { key: 'rate', label: 'Rate', w: 70, align: 'right' },
          { key: 'taxLabel', label: taxMode === 'IGST' ? 'IGST %' : 'GST %', w: 54, align: 'right' },
          { key: 'taxAmt', label: taxMode === 'IGST' ? 'IGST Amt' : 'GST Amt', w: 72, align: 'right' },
          { key: 'amount', label: 'Amount', w: 90, align: 'right' }
        ];

    const drawTableHeader = () => {
      let cx = tableX;
      cols.forEach((c) => {
        drawRect(doc, cx, y, c.w, 24, BRAND.border, BRAND.tableHead);
        textCell(doc, c.label, cx, y, c.w, 24, { font: 'Helvetica-Bold', size: 8.3, align: c.align, color: BRAND.text });
        cx += c.w;
      });
      y += 24;
    };

    const ensureSpace = (h) => {
      const bottomLimit = pageHeight - doc.page.margins.bottom - 24;
      if (y + h <= bottomLimit) return;
      addPage();
      y = doc.page.margins.top + 8;
      drawTableHeader();
    };

    drawTableHeader();

    const itemRows = rows.length > 0 ? rows : [{ srNo: 1, service: 'General Service', description: '', sac: '-', qty: 1, rate: 0, lineTaxRate: 0, baseAmount: 0, igstAmount: 0 }];

    itemRows.forEach((row) => {
      const serviceText = row.description ? `${row.service}\n${row.description}` : row.service;
      const rowHeight = Math.max(26, doc.heightOfString(serviceText, { width: cols[1].w - 8, lineGap: 1 }) + 10);
      ensureSpace(rowHeight);

      const isNonGst = taxMode === 'NON_GST';
      const taxRate = isNonGst ? 0 : row.lineTaxRate;
      const taxAmount = isNonGst ? 0 : (row.baseAmount * taxRate) / 100;
      const lineAmount = row.baseAmount + taxAmount;

      const rowData = {
        srNo: String(row.srNo),
        service: serviceText,
        sac: row.sac || '-',
        qty: row.qty.toFixed(2),
        rate: formatINR(row.rate),
        taxLabel: `${taxRate.toFixed(2)}%`,
        taxAmt: formatINR(taxAmount),
        amount: formatINR(lineAmount)
      };

      let cx = tableX;
      cols.forEach((c) => {
        drawRect(doc, cx, y, c.w, rowHeight, BRAND.border);
        textCell(doc, rowData[c.key], cx, y, c.w, rowHeight, {
          size: c.key === 'service' ? 8.8 : 8.2,
          align: c.align,
          font: c.key === 'service' ? 'Helvetica-Bold' : 'Helvetica'
        });
        cx += c.w;
      });

      y += rowHeight;
    });

    y += 8;

    const leftBoxW = Math.floor((tableW * 0.58));
    const rightBoxW = tableW - leftBoxW - 6;

    const leftBoxX = tableX;
    const rightBoxX = leftBoxX + leftBoxW + 6;

    const wordsText = amountToWords(total);
    const bankLines = [
      `Bank Name: ${company.bankName || '-'}`,
      `A/C No: ${company.bankAccountNumber || '-'}`,
      `IFSC: ${company.bankIfsc || '-'}`,
      `Branch: ${company.bankBranch || '-'}`,
      `UPI ID: ${company.bankUpiId || '-'}`
    ];

    const leftBlockText = [
      `Total In Words: ${wordsText}`,
      '',
      'Bank Account Details:',
      ...bankLines,
      '',
      `Service Period: ${getServicePeriod(invoice)}`,
      '',
      'Terms & Conditions:',
      termsText
    ].join('\n');

    const leftH = Math.max(168, doc.heightOfString(leftBlockText, { width: leftBoxW - 14, lineGap: 1 }) + 14);
    const rightH = leftH;

    ensureSpace(Math.max(leftH, rightH));

    drawRect(doc, leftBoxX, y, leftBoxW, leftH, BRAND.border);
    textCell(doc, leftBlockText, leftBoxX + 2, y + 2, leftBoxW - 4, leftH - 4, { size: 8.4, lineGap: 1 });

    drawRect(doc, rightBoxX, y, rightBoxW, rightH, BRAND.border);

    const summaryRows = [];
    summaryRows.push(['Sub Total', formatINR(subtotal)]);

    if (taxMode === 'NON_GST') {
      summaryRows.push(['Tax', formatINR(0)]);
    } else if (taxMode === 'CGST_SGST') {
      const half = totalTax / 2;
      summaryRows.push(['CGST 9%', formatINR(half)]);
      summaryRows.push(['SGST 9%', formatINR(half)]);
    } else {
      summaryRows.push(['IGST 18%', formatINR(totalTax)]);
    }

    summaryRows.push(['Rounding', formatINR(roundOff)]);
    summaryRows.push(['Total', formatINR(total)]);
    summaryRows.push(['Balance Due', formatINR(balanceDue)]);

    let sy = y + 8;
    summaryRows.forEach((row, idx) => {
      const rh = 24;
      drawRect(doc, rightBoxX + 8, sy, rightBoxW - 16, rh, BRAND.border, row[0] === 'Total' ? BRAND.tableHead : null);
      textCell(doc, row[0], rightBoxX + 10, sy, (rightBoxW - 20) * 0.52, rh, { font: row[0] === 'Total' ? 'Helvetica-Bold' : 'Helvetica', size: 9 });
      textCell(doc, row[1], rightBoxX + (rightBoxW * 0.52), sy, (rightBoxW * 0.48) - 10, rh, { font: row[0] === 'Total' ? 'Helvetica-Bold' : 'Helvetica', size: 9, align: 'right' });
      sy += rh;
      if (idx === summaryRows.length - 1) sy += 4;
    });

    const signAreaY = y + rightH - 72;
    drawRect(doc, rightBoxX + 8, signAreaY, rightBoxW - 16, 64, BRAND.border);
    textCell(doc, 'For ' + company.name, rightBoxX + 12, signAreaY + 4, rightBoxW - 24, 14, { align: 'right', size: 8, font: 'Helvetica-Bold' });

    const signImgX = rightBoxX + rightBoxW - 120;
    const signImgY = signAreaY + 18;
    const signOk = safeImage(doc, company.signature, signImgX, signImgY, [64, 24]);
    if (!signOk) {
      textCell(doc, 'Authorized Sign', signImgX - 14, signImgY + 6, 90, 16, { align: 'right', color: BRAND.muted, size: 8 });
    }

    if (company.stamp) {
      safeImage(doc, company.stamp, rightBoxX + 20, signImgY - 2, [50, 30]);
    }

    textCell(doc, 'Authorized Signature', rightBoxX + 12, signAreaY + 46, rightBoxW - 24, 14, { align: 'right', size: 8.2, font: 'Helvetica-Bold' });

    y += Math.max(leftH, rightH) + 8;

    const receiverBoxH = 42;
    ensureSpace(receiverBoxH + 4);
    drawRect(doc, tableX, y, tableW, receiverBoxH, BRAND.border);
    textCell(doc, 'Receiver Signature: ____________________________', tableX + 8, y + 14, tableW / 2, 14, { size: 9 });
    textCell(doc, 'Thank you for your business.', tableX + tableW / 2, y + 14, tableW / 2 - 8, 14, { size: 9, align: 'right', color: BRAND.muted });

    doc.end();
  });
};

module.exports = {
  generateInvoicePdfBuffer,
  formatINR,
  formatDate
};
