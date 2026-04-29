const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const defaultInvoiceFieldSettings = {
  showSubject: true,
  showServicePeriod: true,
  showPaymentSummary: true,
  showCustomerNotes: true,
  showTermsAndConditions: true,
  showCompanyGst: true,
  showCompanyWebsite: true,
  showGoogleReviewLink: true
};

const templateThemes = {
  classic: {
    accent: '#d92d20',
    accentSoft: '#fef2f2',
    border: '#f1d4d2',
    heading: '#111827',
    muted: '#6b7280',
    cardBg: '#ffffff',
    tableHead: '#fff5f5'
  },
  clean: {
    accent: '#1d4ed8',
    accentSoft: '#eff6ff',
    border: '#c7d2fe',
    heading: '#0f172a',
    muted: '#64748b',
    cardBg: '#ffffff',
    tableHead: '#f8fafc'
  },
  executive: {
    accent: '#111827',
    accentSoft: '#f3f4f6',
    border: '#d1d5db',
    heading: '#111827',
    muted: '#4b5563',
    cardBg: '#ffffff',
    tableHead: '#f9fafb'
  }
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatINR = (value) => `INR ${toNumber(value, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const clean = (value) => String(value || '').trim();

const buildCompanyAddress = (settings = {}) => {
  const line1 = clean(settings.companyAddress);
  const line2 = [clean(settings.companyCity), clean(settings.companyState), clean(settings.companyPincode)]
    .filter(Boolean)
    .join(', ');
  return [line1, line2].filter(Boolean);
};

const buildCustomerAddress = (invoice = {}, customer = {}) => {
  if (clean(invoice.billingAddressText)) {
    return clean(invoice.billingAddressText).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  }

  const name =
    clean(invoice.customerName) ||
    clean(customer.displayName) ||
    clean(customer.name) ||
    clean(customer.companyName) ||
    'Customer';

  const line1 = clean(customer.billingAddress || customer.billingStreet1);
  const line2 = clean(customer.billingStreet2);
  const area = clean(customer.billingArea);
  const statePin = [clean(customer.billingState || customer.state), clean(customer.billingPincode || customer.pincode)]
    .filter(Boolean)
    .join(' ');

  return [name, line1, line2, area, statePin].filter(Boolean);
};

const servicePeriodText = (invoice = {}) => {
  if (clean(invoice.servicePeriod)) return clean(invoice.servicePeriod);
  if (clean(invoice.servicePeriodStart) || clean(invoice.servicePeriodEnd)) {
    const start = clean(invoice.servicePeriodStart) ? formatDate(invoice.servicePeriodStart) : 'NA';
    const end = clean(invoice.servicePeriodEnd) ? formatDate(invoice.servicePeriodEnd) : 'NA';
    return `${start} to ${end}`;
  }
  return '';
};

const normalizeFieldSettings = (raw) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const next = { ...defaultInvoiceFieldSettings };
  Object.keys(defaultInvoiceFieldSettings).forEach((key) => {
    if (source[key] === undefined) return;
    next[key] = Boolean(source[key]);
  });
  return next;
};

const normalizeTemplate = (value) => {
  const key = clean(value);
  return templateThemes[key] ? key : 'classic';
};

const parseLogoPath = (dashboardImageUrl = '') => {
  const raw = clean(dashboardImageUrl);
  if (!raw) return '';

  if (raw.startsWith('/')) {
    const direct = path.resolve(__dirname, `.${raw}`);
    if (fs.existsSync(direct)) return direct;
  }

  try {
    const url = new URL(raw);
    const pathname = url.pathname || '';
    if (pathname.includes('/uploads/')) {
      const fileName = path.basename(pathname);
      const local = path.join(__dirname, 'uploads', fileName);
      if (fs.existsSync(local)) return local;
    }
  } catch (_error) {
    if (fs.existsSync(raw)) return raw;
  }

  return '';
};

const invoiceItems = (invoice = {}) => {
  const rows = Array.isArray(invoice.items) ? invoice.items : [];
  return rows.map((line, index) => {
    const qty = toNumber(line.quantity, 0);
    const rate = toNumber(line.rate, 0);
    const taxRate = toNumber(line.taxRate, 0);
    const base = qty * rate;
    const tax = (base * taxRate) / 100;
    const total = base + tax;
    return {
      index: index + 1,
      name: clean(line.itemName) || `Item ${index + 1}`,
      description: clean(line.description),
      sac: clean(line.sac),
      qty,
      rate,
      taxRate,
      total
    };
  });
};

const drawBorderedCell = (doc, x, y, width, height, borderColor) => {
  doc.save();
  doc.lineWidth(0.7).strokeColor(borderColor).rect(x, y, width, height).stroke();
  doc.restore();
};

const drawSectionTitle = (doc, x, y, text, theme) => {
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(theme.accent)
    .text(String(text || '').toUpperCase(), x, y);
};

const drawInfoBlock = (doc, options) => {
  const {
    x,
    y,
    width,
    minHeight,
    title,
    lines,
    theme
  } = options;

  let cursorY = y + 10;
  drawSectionTitle(doc, x + 10, cursorY, title, theme);
  cursorY += 14;

  doc.font('Helvetica').fontSize(9).fillColor(theme.heading);
  (Array.isArray(lines) ? lines : []).forEach((line) => {
    if (!line) return;
    doc.text(String(line), x + 10, cursorY, { width: width - 20, lineGap: 1 });
    cursorY = doc.y + 2;
  });

  const boxHeight = Math.max(minHeight || 72, cursorY - y + 8);
  doc.save();
  doc.lineWidth(0.8).strokeColor(theme.border).rect(x, y, width, boxHeight).stroke();
  doc.restore();
  return boxHeight;
};

const drawTotalsBox = (doc, options) => {
  const {
    x,
    y,
    width,
    subtotal,
    totalTax,
    withholdingAmount,
    roundOff,
    grandTotal,
    balanceDue,
    theme
  } = options;

  const rows = [
    { label: 'Sub Total', value: formatINR(subtotal) },
    { label: 'Total Tax', value: formatINR(totalTax) },
    { label: 'Withholding', value: `- ${formatINR(withholdingAmount)}` },
    { label: 'Round Off', value: formatINR(roundOff) },
    { label: 'Grand Total', value: formatINR(grandTotal), grand: true },
    { label: 'Balance Due', value: formatINR(Math.max(balanceDue, 0)) }
  ];

  const rowHeight = 21;
  const boxHeight = rows.length * rowHeight;

  rows.forEach((row, rowIndex) => {
    const rowY = y + rowIndex * rowHeight;
    if (row.grand) {
      doc.save();
      doc.fillColor(theme.accentSoft).rect(x, rowY, width, rowHeight).fill();
      doc.restore();
    }

    drawBorderedCell(doc, x, rowY, width, rowHeight, theme.border);
    doc
      .font(row.grand ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(row.grand ? 10 : 9)
      .fillColor(theme.heading)
      .text(row.label, x + 9, rowY + 6, { width: width / 2 - 10, align: 'left' })
      .text(row.value, x + width / 2, rowY + 6, { width: width / 2 - 10, align: 'right' });
  });

  return boxHeight;
};

const drawTextCard = (doc, options) => {
  const { x, y, width, title, text, theme } = options;
  if (!clean(text)) return 0;

  const headingHeight = 12;
  const bodyHeight = doc.heightOfString(String(text), { width: width - 20, lineGap: 1, align: 'left' });
  const boxHeight = headingHeight + bodyHeight + 16;

  doc.save();
  doc.lineWidth(0.8).strokeColor(theme.border).rect(x, y, width, boxHeight).stroke();
  doc.restore();

  drawSectionTitle(doc, x + 10, y + 8, title, theme);
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(theme.heading)
    .text(String(text), x + 10, y + 22, { width: width - 20, lineGap: 1 });

  return boxHeight;
};

const drawPaymentSummaryCard = (doc, options) => {
  const { x, y, width, totalAmount, amountReceived, balanceDue, paymentSplits, theme } = options;

  const splitRows = Array.isArray(paymentSplits)
    ? paymentSplits
      .map((split) => {
        const mode = clean(split?.mode);
        const depositTo = clean(split?.depositTo);
        const amount = formatINR(toNumber(split?.amount, 0));
        return [mode, depositTo, amount].filter(Boolean).join(' | ');
      })
      .filter(Boolean)
    : [];

  const baseLines = [
    `Total Amount: ${formatINR(totalAmount)}`,
    `Amount Received: ${formatINR(amountReceived)}`,
    `Balance Due: ${formatINR(Math.max(balanceDue, 0))}`
  ];

  const text = [...baseLines, ...splitRows].join('\n');
  return drawTextCard(doc, {
    x,
    y,
    width,
    title: 'Payment Summary',
    text,
    theme
  });
};

const drawInvoiceHeader = (doc, options) => {
  const {
    x,
    y,
    width,
    invoice,
    settings,
    customer,
    theme,
    fieldSettings
  } = options;

  const logoPath = parseLogoPath(settings.gstCompanyLogoUrl || settings.dashboardImageUrl);
  const headerHeight = 102;

  doc.save();
  doc.fillColor(theme.accentSoft).rect(x, y, width, headerHeight).fill();
  doc.restore();

  const companyName = clean(settings.companyName) || 'Your Company';
  const companyAddressLines = buildCompanyAddress(settings);

  doc
    .font('Helvetica-Bold')
    .fontSize(21)
    .fillColor(theme.heading)
    .text(companyName, x + 12, y + 12, { width: width - 130, lineBreak: true });

  doc.font('Helvetica').fontSize(9).fillColor(theme.muted);
  let addressY = doc.y + 2;
  companyAddressLines.forEach((line) => {
    doc.text(line, x + 12, addressY, { width: width - 130, lineGap: 1 });
    addressY = doc.y + 1;
  });

  if (fieldSettings.showCompanyGst && clean(settings.companyGstNumber)) {
    doc.text(`GSTIN: ${clean(settings.companyGstNumber)}`, x + 12, addressY + 2, { width: width - 130 });
    addressY = doc.y + 1;
  }

  const contactParts = [clean(settings.companyEmail), clean(settings.companyMobile)].filter(Boolean);
  if (contactParts.length > 0) {
    doc.text(contactParts.join(' | '), x + 12, addressY + 2, { width: width - 130 });
  }

  if (logoPath) {
    try {
      doc.image(logoPath, x + width - 90, y + 12, { fit: [76, 76], align: 'center', valign: 'center' });
      doc.save();
      doc.lineWidth(0.8).strokeColor(theme.border).rect(x + width - 93, y + 9, 82, 82).stroke();
      doc.restore();
    } catch (_error) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(theme.muted)
        .text('Logo', x + width - 72, y + 44, { width: 40, align: 'center' });
    }
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(theme.accent)
    .text('TAX INVOICE', x + width - 125, y + 84, { width: 115, align: 'right' });

  const metaY = y + headerHeight + 8;
  const metaWidth = width / 4;
  const metaItems = [
    { label: 'Invoice Number', value: clean(invoice.invoiceNumber) || '-' },
    { label: 'Invoice Date', value: formatDate(invoice.date) },
    { label: 'Due Date', value: formatDate(invoice.dueDate) },
    { label: 'Status', value: String(invoice.status || 'DRAFT').toUpperCase() }
  ];

  metaItems.forEach((item, index) => {
    const blockX = x + index * metaWidth;
    drawBorderedCell(doc, blockX, metaY, metaWidth, 38, theme.border);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(theme.muted)
      .text(String(item.label || '').toUpperCase(), blockX + 8, metaY + 5, { width: metaWidth - 16 });
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(theme.heading)
      .text(String(item.value || ''), blockX + 8, metaY + 18, { width: metaWidth - 16 });
  });

  const infoY = metaY + 48;
  const customerLines = buildCustomerAddress(invoice, customer);
  const rightLines = [
    `Customer: ${clean(invoice.customerName) || clean(customer.displayName) || clean(customer.name) || '-'}`,
    `Terms: ${clean(invoice.terms) || '-'}`,
    `Place of Supply: ${clean(invoice.placeOfSupply) || '-'}`
  ];

  if (fieldSettings.showServicePeriod) {
    const period = servicePeriodText(invoice);
    if (period) rightLines.push(`Service Period: ${period}`);
  }

  const infoWidth = (width - 12) / 2;
  const leftHeight = drawInfoBlock(doc, {
    x,
    y: infoY,
    width: infoWidth,
    minHeight: 78,
    title: 'Bill To',
    lines: customerLines,
    theme
  });

  const rightHeight = drawInfoBlock(doc, {
    x: x + infoWidth + 12,
    y: infoY,
    width: infoWidth,
    minHeight: 78,
    title: 'Invoice Details',
    lines: rightLines,
    theme
  });

  return infoY + Math.max(leftHeight, rightHeight);
};

const drawItemsTable = (doc, options) => {
  const { x, startY, width, items, theme } = options;

  const columns = [
    { key: 'index', label: '#', width: 28, align: 'center' },
    { key: 'item', label: 'Item Details', width: 225, align: 'left' },
    { key: 'qty', label: 'Qty', width: 50, align: 'right' },
    { key: 'rate', label: 'Rate', width: 80, align: 'right' },
    { key: 'tax', label: 'Tax', width: 50, align: 'right' },
    { key: 'amount', label: 'Amount', width: 90, align: 'right' }
  ];

  let y = startY;

  const drawTableHeader = () => {
    let cursorX = x;
    columns.forEach((column) => {
      doc.save();
      doc.fillColor(theme.tableHead).rect(cursorX, y, column.width, 24).fill();
      doc.restore();
      drawBorderedCell(doc, cursorX, y, column.width, 24, theme.border);
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(theme.muted)
        .text(column.label, cursorX + 5, y + 8, {
          width: column.width - 10,
          align: column.align
        });
      cursorX += column.width;
    });
    y += 24;
  };

  const ensureRowSpace = (height) => {
    const maxY = doc.page.height - doc.page.margins.bottom;
    if (y + height <= maxY) return;
    doc.addPage();
    y = doc.page.margins.top;
    drawTableHeader();
  };

  drawTableHeader();

  if (!Array.isArray(items) || items.length === 0) {
    drawBorderedCell(doc, x, y, width, 24, theme.border);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(theme.muted)
      .text('No items available', x, y + 8, { width, align: 'center' });
    y += 24;
    return y;
  }

  items.forEach((row) => {
    const descriptionParts = [row.name, row.description, row.sac ? `SAC: ${row.sac}` : ''].filter(Boolean);
    const description = descriptionParts.join('\n');
    const rowHeight = Math.max(24, doc.heightOfString(description, { width: 225 - 10, lineGap: 1 }) + 8);
    ensureRowSpace(rowHeight);

    let cursorX = x;
    const values = {
      index: String(row.index),
      item: description,
      qty: row.qty.toFixed(2),
      rate: formatINR(row.rate),
      tax: `${row.taxRate.toFixed(2)}%`,
      amount: formatINR(row.total)
    };

    columns.forEach((column) => {
      drawBorderedCell(doc, cursorX, y, column.width, rowHeight, theme.border);
      doc
        .font(column.key === 'item' ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(column.key === 'item' ? 9 : 8.5)
        .fillColor(theme.heading)
        .text(values[column.key], cursorX + 5, y + 6, {
          width: column.width - 10,
          align: column.align,
          lineGap: 1
        });
      cursorX += column.width;
    });

    y += rowHeight;
  });

  return y;
};

const resolveGrandTotal = (invoice, computedTotal) => {
  const explicit = toNumber(invoice.total, NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const amount = toNumber(invoice.amount, NaN);
  if (Number.isFinite(amount) && amount > 0) return amount;
  return computedTotal;
};

const generateInvoicePdfBuffer = async ({ invoice = {}, customer = {}, settings = {} }) => {
  const template = normalizeTemplate(settings.invoiceTemplate);
  const theme = templateThemes[template];
  const fieldSettings = normalizeFieldSettings(settings.invoiceFieldSettings);

  const items = invoiceItems(invoice);
  const computedSubTotal = items.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const computedTax = items.reduce((sum, item) => sum + (item.total - item.qty * item.rate), 0);

  const subtotal = toNumber(invoice.subtotal, computedSubTotal);
  const totalTax = toNumber(invoice.totalTax, computedTax);
  const withholdingAmount = toNumber(invoice.withholdingAmount, 0);
  const roundOff = toNumber(invoice.roundOff, 0);
  const grandTotal = resolveGrandTotal(invoice, subtotal + totalTax - withholdingAmount + roundOff);
  const amountReceived = toNumber(invoice.paymentReceivedTotal, 0);
  const balanceDue = toNumber(invoice.balanceDue, grandTotal - amountReceived);

  const document = new PDFDocument({
    size: 'A4',
    margin: 36,
    info: {
      Title: `Invoice ${clean(invoice.invoiceNumber)}`,
      Author: clean(settings.companyName) || 'Invoice System'
    }
  });

  return new Promise((resolve, reject) => {
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    const x = document.page.margins.left;
    const width = document.page.width - document.page.margins.left - document.page.margins.right;

    let y = drawInvoiceHeader(document, {
      x,
      y: document.page.margins.top,
      width,
      invoice,
      settings,
      customer,
      theme,
      fieldSettings
    });

    if (fieldSettings.showSubject && clean(invoice.subject)) {
      y += 10;
      const subjectHeight = drawTextCard(document, {
        x,
        y,
        width,
        title: 'Subject',
        text: clean(invoice.subject),
        theme
      });
      y += subjectHeight;
    }

    y += 10;
    y = drawItemsTable(document, {
      x,
      startY: y,
      width,
      items,
      theme
    });

    y += 10;
    const leftWidth = 300;
    const rightWidth = width - leftWidth - 12;
    let leftY = y;

    if (fieldSettings.showPaymentSummary) {
      const paymentHeight = drawPaymentSummaryCard(document, {
        x,
        y: leftY,
        width: leftWidth,
        totalAmount: grandTotal,
        amountReceived,
        balanceDue,
        paymentSplits: invoice.paymentSplits,
        theme
      });
      if (paymentHeight > 0) leftY += paymentHeight + 8;
    }

    if (fieldSettings.showCustomerNotes) {
      const notesHeight = drawTextCard(document, {
        x,
        y: leftY,
        width: leftWidth,
        title: 'Customer Notes',
        text: clean(invoice.customerNotes),
        theme
      });
      if (notesHeight > 0) leftY += notesHeight + 8;
    }

    if (fieldSettings.showTermsAndConditions) {
      const termsHeight = drawTextCard(document, {
        x,
        y: leftY,
        width: leftWidth,
        title: 'Terms & Conditions',
        text: clean(invoice.termsAndConditions),
        theme
      });
      if (termsHeight > 0) leftY += termsHeight + 8;
    }

    const totalsHeight = drawTotalsBox(document, {
      x: x + leftWidth + 12,
      y,
      width: rightWidth,
      subtotal,
      totalTax,
      withholdingAmount,
      roundOff,
      grandTotal,
      balanceDue,
      theme
    });

    y = Math.max(leftY, y + totalsHeight) + 8;

    const footerLines = [];
    if (fieldSettings.showCompanyWebsite && clean(settings.companyWebsite)) {
      footerLines.push(`Website: ${clean(settings.companyWebsite)}`);
    }
    if (fieldSettings.showGoogleReviewLink && clean(settings.googleReviewLink)) {
      footerLines.push(`Google Review: ${clean(settings.googleReviewLink)}`);
    }

    drawBorderedCell(document, x, y, width, 34, theme.border);
    document
      .font('Helvetica')
      .fontSize(8)
      .fillColor(theme.muted)
      .text(
        `This is a computer generated invoice.${footerLines.length > 0 ? ` ${footerLines.join(' | ')}` : ''}`,
        x + 8,
        y + 12,
        { width: width - 16, align: 'left' }
      );

    document.end();
  });
};

module.exports = {
  generateInvoicePdfBuffer,
  formatINR,
  formatDate
};
