const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const toNumber = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clean = (v) => String(v ?? '').trim();

const formatDate = (value) => {
  const raw = clean(value);
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatINR = (value) => toNumber(value, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fontPathCandidates = (fileNames) => [
  ...fileNames.map((fileName) => path.join(__dirname, 'assets', 'fonts', fileName)),
  ...fileNames.map((fileName) => path.join(__dirname, 'fonts', fileName)),
  ...fileNames.map((fileName) => path.join(process.cwd(), 'assets', 'fonts', fileName)),
  ...fileNames.map((fileName) => path.join(process.cwd(), 'fonts', fileName)),
  ...fileNames.map((fileName) => path.join('/usr/share/fonts/truetype/msttcorefonts', fileName)),
  ...fileNames.map((fileName) => path.join('/usr/share/fonts/truetype/microsoft', fileName)),
  ...fileNames.map((fileName) => path.join('/Library/Fonts', fileName)),
  ...fileNames.map((fileName) => path.join('/System/Library/Fonts/Supplemental', fileName))
];

const findExistingFont = (fileNames) => fontPathCandidates(fileNames).find((candidate) => {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
});

const registerQuotationFonts = (doc) => {
  const pdfFont = { regular: 'Helvetica', bold: 'Helvetica-Bold' };
  const calibriRegularPath = clean(process.env.CALIBRI_FONT_PATH)
    || findExistingFont(['calibri.ttf', 'Calibri.ttf', 'calibri-regular.ttf', 'Calibri-Regular.ttf']);
  const calibriBoldPath = clean(process.env.CALIBRI_BOLD_FONT_PATH)
    || findExistingFont(['calibrib.ttf', 'Calibri-Bold.ttf', 'calibri-bold.ttf', 'Calibri Bold.ttf']);

  try {
    if (calibriRegularPath && fs.existsSync(calibriRegularPath)) {
      doc.registerFont('Calibri', calibriRegularPath);
      pdfFont.regular = 'Calibri';
    }
    if (calibriBoldPath && fs.existsSync(calibriBoldPath)) {
      doc.registerFont('Calibri-Bold', calibriBoldPath);
      pdfFont.bold = 'Calibri-Bold';
    } else if (pdfFont.regular === 'Calibri') {
      pdfFont.bold = 'Calibri';
    }
  } catch (error) {
    console.error('Quotation PDF Calibri font registration failed:', error.message);
    pdfFont.regular = 'Helvetica';
    pdfFont.bold = 'Helvetica-Bold';
  }

  doc._quotationPdfFont = pdfFont;
  return pdfFont;
};

const getPdfFont = (doc) => doc._quotationPdfFont || { regular: 'Helvetica', bold: 'Helvetica-Bold' };

const resolveUploadAsset = (input = '') => {
  const raw = clean(input);
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  const uploadsDir = path.join(process.env.HOME || '/home/u610009593', 'uploads-skuas-crm');
  const dirs = [uploadsDir, path.join(__dirname, 'uploads'), path.join(__dirname, '..', 'uploads')];
  const findFile = (name) => {
    const safeName = decodeURIComponent(String(name || '').trim());
    if (!safeName) return '';
    for (const dir of dirs) {
      const p = path.join(dir, path.basename(safeName));
      if (fs.existsSync(p)) return p;
    }
    return '';
  };
  if (raw.startsWith('/uploads/')) return findFile(raw.split('/uploads/')[1]);
  if (raw.includes('/uploads/')) return findFile(raw.split('/uploads/').pop());
  if (fs.existsSync(raw)) return raw;
  return '';
};

const amountInWords = (amount) => `${Math.floor(Math.max(0, toNumber(amount, 0))).toLocaleString('en-IN')} Rupees Only`;

const drawFooter = (doc, settings = {}) => {
  const pdfFont = getPdfFont(doc);
  const showPage = String(settings.show_page_number || '1') !== '0';
  const footerText = clean(settings.footer_text);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const y = doc.page.height - 24;
  if (footerText) {
    doc.font(pdfFont.regular).fontSize(8).fillColor('#64748b').text(footerText, left, y, { width: right - left - 120, align: 'left' });
  }
  if (showPage) {
    doc.font(pdfFont.regular).fontSize(8).fillColor('#64748b').text(`Page ${doc.page.number}`, right - 120, y, { width: 120, align: 'right' });
  }
};

const drawHeader = (doc, settings = {}, companySettings = {}) => {
  const pdfFont = getPdfFont(doc);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const logo = resolveUploadAsset(
    companySettings.gstCompanyLogoUrl
    || companySettings.dashboardImageUrl
    || companySettings.companyLogoUrl
    || settings.logo_url
  );
  const lineColor = clean(settings.header_line_color || '#9F174D');
  const companyName = clean(
    companySettings.gstCompanyName
    || companySettings.companyName
    || settings.company_name
    || 'SKUAS Pest Control Private Limited'
  );
  const companyAddress = clean(
    companySettings.gstBillingAddress
    || companySettings.companyAddress
    || settings.company_address
  );
  const companyCityLine = [
    clean(companySettings.gstCity || companySettings.companyCity),
    clean(companySettings.gstState || companySettings.companyState)
  ].filter(Boolean).join(',');
  const companyPin = clean(companySettings.gstPincode || companySettings.companyPincode);
  const companyEmail = clean(companySettings.gstEmail || companySettings.companyEmail || settings.email);
  const companyPhone = clean(companySettings.gstPhone || companySettings.companyMobile || settings.phone);
  const companyWebsite = clean(companySettings.companyWebsite || settings.website);
  const companyGst = clean(companySettings.companyGstNumber || companySettings.gstRegistrationNumber || settings.gstin);
  const companyDetailLines = [
    companyAddress,
    companyCityLine || companyPin ? `${companyCityLine}${companyPin ? ` - ${companyPin}` : ''}, India` : '',
    `Email: ${companyEmail || '-'}`,
    `Tel: ${companyPhone || '-'}`,
    `Web: ${companyWebsite || '-'}`,
    String(settings.show_gstin || '1') !== '0' ? `GST Details: ${companyGst || '-'}` : ''
  ].filter(Boolean);
  const headerTopY = 45;
  const showLogo = String(settings.show_logo || '1') !== '0';

  doc.font(pdfFont.bold).fontSize(10.2);
  const companyNameWidth = doc.widthOfString(companyName);
  const headerX = Math.max(left + 240, right - companyNameWidth);
  const headerWidth = right - headerX;
  const detailLineHeight = 9.1;
  const headerBoxHeight = 11.2 + (companyDetailLines.length * detailLineHeight);
  const logoWidth = logo && showLogo ? Math.max(160, toNumber(settings.logo_width, 400)) : 0;
  const logoHeight = logo && showLogo ? Math.max(80, toNumber(settings.logo_height, 160)) : 0;
  const logoY = headerTopY + ((headerBoxHeight - logoHeight) / 2);

  if (logo && showLogo) {
    try { doc.image(logo, left, logoY, { fit: [logoWidth, logoHeight] }); } catch (_e) {}
  }

  doc.font(pdfFont.bold).fontSize(10.2).fillColor('#111827')
    .text(companyName, headerX, headerTopY, { width: width, align: 'left', lineBreak: false });
  doc.font(pdfFont.regular).fontSize(8.1).fillColor('#475569');
  companyDetailLines.forEach((line) => {
    doc.text(line, headerX, doc.y + 1, { width: headerWidth, align: 'left', lineGap: 0 });
  });

  const lineY = Math.max(doc.y + 8, 118);
  doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(1).strokeColor(lineColor).stroke();
  doc.y = lineY + 18;
};

const getRowHeight = (doc, cols, textList, fontSize = 9, minHeight = 22) => {
  const pdfFont = getPdfFont(doc);
  doc.font(pdfFont.regular).fontSize(fontSize);
  let max = minHeight;
  cols.forEach((col, i) => {
    const text = String(textList[i] ?? '');
    const h = doc.heightOfString(text, { width: Math.max(6, col.w - 8) }) + 8;
    if (h > max) max = h;
  });
  return max;
};

const drawTableRow = (doc, cols, y, values, options = {}) => {
  const pdfFont = getPdfFont(doc);
  const fontSize = options.fontSize || 9;
  const h = options.height || getRowHeight(doc, cols, values, fontSize, options.minHeight || 22);
  const borderColor = options.borderColor || '#d1d5db';
  const left = cols[0].x;
  const right = cols[cols.length - 1].x + cols[cols.length - 1].w;

  doc.lineWidth(0.7).strokeColor(borderColor);
  doc.rect(left, y, right - left, h).stroke();
  for (let i = 1; i < cols.length; i += 1) {
    doc.moveTo(cols[i].x, y).lineTo(cols[i].x, y + h).stroke();
  }

  cols.forEach((col, i) => {
    doc.font(options.bold ? pdfFont.bold : pdfFont.regular).fontSize(fontSize).fillColor('#111827')
      .text(String(values[i] ?? ''), col.x + 4, y + 4, { width: col.w - 8, height: h - 8 });
  });
  return h;
};

const generateQuotationPdfBuffer = ({ quotation = {}, items = [], templateSettings = {}, commonParagraphs = {}, companySettings = {} }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 34, left: 44, right: 44 }, bufferPages: true });
  const pdfFont = registerQuotationFonts(doc);
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      drawFooter(doc, templateSettings);
    }
    resolve(Buffer.concat(chunks));
  });
  doc.on('error', reject);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const usableBottom = () => doc.page.height - doc.page.margins.bottom - 30;
  const newPage = () => {
    doc.addPage();
    drawHeader(doc, templateSettings, companySettings);
  };
  const ensureSpace = (needed = 40) => {
    if (doc.y + needed > usableBottom()) newPage();
  };

  drawHeader(doc, templateSettings, companySettings);

  doc.font(pdfFont.regular).fontSize(10).fillColor('#111827')
    .text(`Date: ${formatDate(quotation.quotation_date)}`, left, doc.y, { width: right - left, align: 'left' })
    .text(`Ref: ${clean(quotation.quotation_number)}`, left, doc.y + 2, { width: right - left, align: 'left' });

  doc.moveDown(1);
  doc.font(pdfFont.regular).fontSize(10).fillColor('#111827')
    .text('To,', left, doc.y, { width: right - left, align: 'left' })
    .text(clean(quotation.customer_name || quotation.company_name || 'Customer'), left, doc.y + 2, { width: right - left, align: 'left' })
    .text(clean(quotation.address || '-'), left, doc.y + 2, { width: right - left, align: 'left' });

  ensureSpace(40);
  doc.moveDown(0.4);
  const title = items.length > 1
    ? 'Quotation for Pest Control Services'
    : `Quotation for ${clean(items[0]?.service_name || 'Pest Control Service')}`;
  doc.font(pdfFont.bold).fontSize(10).fillColor('#111827').text(title, left, doc.y, { width: right - left, align: 'left' });

  const opening = clean(quotation.opening_paragraph || commonParagraphs.opening_paragraph);
  if (opening) {
    ensureSpace(60);
    doc.moveDown(0.3);
    doc.font(pdfFont.regular).fontSize(10).fillColor('#111827').text(opening, left, doc.y, { width: right - left, align: 'left', lineGap: 1 });
  }

  ensureSpace(48);
  doc.moveDown(0.7);
  doc.font(pdfFont.bold).fontSize(10).fillColor(clean(templateSettings.primary_color || '#9F174D')).text('SERVICE SUMMARY');
  doc.moveDown(0.2);

  const serviceCols = [
    { x: left, w: 30 },
    { x: left + 30, w: 208 },
    { x: left + 238, w: 80 },
    { x: left + 318, w: 72 },
    { x: left + 390, w: 122 }
  ];

  let h = drawTableRow(doc, serviceCols, doc.y, ['#', 'Service', 'Frequency', 'GST %', 'Amount'], {
    bold: true,
    fontSize: Math.max(10, toNumber(templateSettings.table_font_size, 10)),
    borderColor: clean(templateSettings.border_color || '#cbd5e1'),
    minHeight: 24
  });
  doc.y += h;

  items.forEach((item, index) => {
    const details = [
      clean(item.service_name),
      clean(item.about_pest),
      clean(item.what_we_do),
      `Contract: ${formatDate(item.contract_start_date || quotation.contract_start_date)} to ${formatDate(item.contract_end_date || quotation.contract_end_date)}`
    ].filter(Boolean).join('\n');

    const rowVals = [
      String(index + 1),
      details,
      clean(item.frequency || '-'),
      `${toNumber(item.gst_percentage, 0)}%`,
      `₹ ${formatINR(item.total_amount)}`
    ];

    const rowHeight = getRowHeight(doc, serviceCols, rowVals, 10, 34);
    ensureSpace(rowHeight + 2);
    h = drawTableRow(doc, serviceCols, doc.y, rowVals, {
      fontSize: 10,
      borderColor: clean(templateSettings.border_color || '#cbd5e1'),
      minHeight: 34
    });
    doc.y += h;
  });

  ensureSpace(70);
  doc.moveDown(0.6);
  doc.font(pdfFont.bold).fontSize(10).fillColor(clean(templateSettings.primary_color || '#9F174D')).text('RECOMMENDATION TABLE');
  doc.moveDown(0.2);

  const recCols = [
    { x: left, w: 30 },
    { x: left + 30, w: 120 },
    { x: left + 150, w: 80 },
    { x: left + 230, w: 72 },
    { x: left + 302, w: 210 }
  ];

  h = drawTableRow(doc, recCols, doc.y, ['#', 'Service', 'Infestation', 'Image', 'Recommendation'], {
    bold: true,
    fontSize: Math.max(10, toNumber(templateSettings.table_font_size, 10)),
    borderColor: clean(templateSettings.border_color || '#cbd5e1'),
    minHeight: 24
  });
  doc.y += h;

  items.forEach((item, index) => {
    const recText = clean(item.recommendation || item.what_we_do || '-');
    const rowVals = [String(index + 1), clean(item.service_name || '-'), clean(item.infestation_level || '-'), '', recText];
    const rowHeight = Math.max(58, getRowHeight(doc, recCols, rowVals, 10, 58));
    ensureSpace(rowHeight + 2);
    const y = doc.y;
    h = drawTableRow(doc, recCols, y, rowVals, {
      fontSize: 10,
      borderColor: clean(templateSettings.border_color || '#cbd5e1'),
      minHeight: 58
    });

    const img = resolveUploadAsset(item.infestation_image_url);
    if (img) {
      try {
        const pad = 4;
        const maxW = recCols[3].w - pad * 2;
        const maxH = h - pad * 2;
        const size = Math.min(maxW, maxH, 52);
        const x = recCols[3].x + (recCols[3].w - size) / 2;
        const iy = y + (h - size) / 2;
        doc.image(img, x, iy, { width: size, height: size, fit: [size, size] });
      } catch (_e) {}
    }

    doc.y += h;
  });

  const subtotal = toNumber(quotation.subtotal_without_gst, 0);
  const gstTotal = toNumber(quotation.gst_total, 0);
  const roundOff = toNumber(quotation.round_off, 0);
  const grand = toNumber(quotation.grand_total, subtotal + gstTotal + roundOff);

  ensureSpace(120);
  doc.moveDown(0.5);
  const sumX = right - 200;
  const line = (label, value, bold = false) => {
    doc.font(bold ? pdfFont.bold : pdfFont.regular).fontSize(10).fillColor('#111827').text(label, sumX, doc.y, { width: 110 });
    doc.text(value, sumX + 110, doc.y - 10, { width: 90, align: 'right' });
    doc.moveDown(0.2);
  };
  line('Subtotal', `₹ ${formatINR(subtotal)}`);
  line('GST', `₹ ${formatINR(gstTotal)}`);
  line('Round Off', `₹ ${formatINR(roundOff)}`);
  line('Grand Total', `₹ ${formatINR(grand)}`, true);
  doc.moveDown(0.2);
  doc.font(pdfFont.bold).fontSize(10).text('Amount in words');
  doc.font(pdfFont.regular).fontSize(10).text(amountInWords(grand));

  const blocks = [
    ['Payment Terms', clean(quotation.payment_terms || commonParagraphs.payment_terms)],
    ['Warranty', clean(quotation.warranty_note || commonParagraphs.warranty_paragraph)],
    ['Disclaimer', clean(quotation.disclaimer || commonParagraphs.disclaimer_paragraph)],
    ['Closing', clean(quotation.closing_paragraph || commonParagraphs.closing_paragraph || commonParagraphs.relationship_closing_paragraph)]
  ].filter(([, txt]) => txt);

  blocks.forEach(([titleText, body]) => {
    ensureSpace(70);
    doc.moveDown(0.3);
    doc.font(pdfFont.bold).fontSize(10).fillColor(clean(templateSettings.primary_color || '#9F174D')).text(titleText);
    doc.font(pdfFont.regular).fontSize(10).fillColor('#111827').text(body, { align: 'left', lineGap: 1 });
  });

  ensureSpace(90);
  doc.moveDown(0.4);
  doc.font(pdfFont.regular).fontSize(10).fillColor('#111827').text('Yours Truly,');
  doc.text('For Skuas Pest Control Pvt Ltd');

  if (String(templateSettings.show_signature || '1') !== '0') {
    const signature = resolveUploadAsset(templateSettings.signature_image_url);
    if (signature) {
      try { doc.image(signature, left, doc.y + 4, { width: 90, height: 42 }); } catch (_e) {}
    }
  }

  doc.moveDown(3.3);
  doc.text(clean(quotation.sales_person || templateSettings.default_sales_person));
  doc.text(clean(quotation.designation || templateSettings.default_designation));
  doc.text(clean(quotation.mobile || templateSettings.default_mobile));

  doc.end();
});

module.exports = {
  generateQuotationPdfBuffer
};
