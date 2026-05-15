const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const toNumber = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clean = (v) => String(v ?? '').trim();
const renewalLetterLogoSize = [400, 160];
const pdfTextSize = {
  title: 16,
  body: 9.6,
  sectionHeading: 9.8,
  paymentHeading: 9.8,
  paymentBody: 9.4,
  signature: 9.6,
  table: 8.8,
  footer: 9.6
};

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

const formatINR = (value) => `${Math.round(toNumber(value, 0)).toLocaleString('en-IN')}/-`;
const defaultPaymentTerms = [
  '100% Advance along with your confirmation order.',
  'All payments should be payable to Skuas Pest Control Private Limited.',
  'The validity of the offer is 30 days. Please note that these charges are valid only for said premises.',
  'Complaints will be handled without any additional charges.',
  'Skuas Pest Control Private Limited is in no way responsible for any direct/indirect losses and/or damages by pests and of the consequences.'
].join('\n');

const formatJoinedNames = (values = []) => {
  const unique = Array.from(new Set(values.map(clean).filter(Boolean)));
  if (unique.length <= 1) return unique[0] || '';
  if (unique.length === 2) return `${unique[0]} & ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')} & ${unique[unique.length - 1]}`;
};

const cleanPaymentTerms = (value = '') => {
  const raw = clean(value);
  if (!raw) return defaultPaymentTerms;
  if (/[ÏÆ¢¤�]/.test(raw)) return defaultPaymentTerms;
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[•●▪◦*-]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .join('\n');
};

const customerDetailLinesForQuotation = (quotation = {}) => {
  const customerName = clean(quotation.customer_name);
  const companyName = clean(quotation.company_name);
  const detailLines = companyName
    ? [
        ['Company Name', companyName],
        ['Customer Name', customerName]
      ]
    : [
        ['Customer Name', customerName],
        ['Company Name', '']
      ];

  return [
    ...detailLines,
    ['Address', clean(quotation.address)],
    ['Phone', clean(quotation.phone)],
    ['Email', clean(quotation.email)],
    ['GSTIN', clean(quotation.gstin)]
  ];
};

const drawLabeledDetailBlock = (doc, rows = [], x, y, width, options = {}) => {
  const pdfFont = getPdfFont(doc);
  const labelWidth = options.labelWidth || 88;
  const fontSize = options.fontSize || pdfTextSize.body;
  const lineGap = Number.isFinite(Number(options.lineGap)) ? Number(options.lineGap) : 2;
  let cursorY = y;

  rows.forEach(([label, value]) => {
    const text = clean(value);
    const valueX = x + labelWidth;
    const valueWidth = Math.max(10, width - labelWidth);
    const rowHeight = Math.max(
      doc.font(pdfFont.bold).fontSize(fontSize).heightOfString(`${label}:`, { width: labelWidth - 4, lineGap }),
      doc.font(pdfFont.regular).fontSize(fontSize).heightOfString(text || ' ', { width: valueWidth, lineGap })
    );

    doc.font(pdfFont.bold).fontSize(fontSize).fillColor('#111827')
      .text(`${label}:`, x, cursorY, { width: labelWidth - 4, align: 'left', lineGap });
    doc.font(pdfFont.regular).fontSize(fontSize).fillColor('#111827')
      .text(text, valueX, cursorY, { width: valueWidth, align: 'left', lineGap });

    cursorY += rowHeight + 2;
  });

  doc.y = cursorY;
};

const drawParagraphBlock = (doc, text, x, y, width, options = {}) => {
  const pdfFont = getPdfFont(doc);
  const fontSize = options.fontSize || pdfTextSize.body;
  const align = options.align || 'justify';
  const lineGap = Number.isFinite(Number(options.lineGap)) ? Number(options.lineGap) : 1.2;
  const paragraphGap = Number.isFinite(Number(options.paragraphGap)) ? Number(options.paragraphGap) : 4;
  const blocks = clean(text).split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  doc.font(pdfFont.regular).fontSize(fontSize).fillColor('#111827');

  if (!blocks.length) {
    doc.text('-', x, y, { width, align: 'left', lineGap });
    return;
  }

  blocks.forEach((block, index) => {
    doc.text(block, x, index === 0 ? y : doc.y + paragraphGap, { width, align, lineGap });
  });
};

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
  const primaryUploadsDir = String(
    process.env.UPLOADS_DIR
    || process.env.UPLOADS_ROOT_DIR
    || path.join(process.env.HOME || '/home/u610009593', 'uploads-skuas-crm')
  ).trim();
  const dirs = [
    primaryUploadsDir,
    '/home/u610009593/uploads-skuas-crm',
    path.join(__dirname, '..', 'storage', 'uploads'),
    path.join(__dirname, 'uploads'),
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'public', 'uploads')
  ].filter(Boolean);
  const findFile = (name = '') => {
    const safeName = decodeURIComponent(String(name || '').trim());
    if (!safeName) return '';
    const normalized = safeName.replace(/\\/g, '/').replace(/^\/?uploads\/?/, '').replace(/^\/+/, '');
    if (!normalized || normalized.includes('..')) return '';
    for (const dir of dirs) {
      const byRelativePath = path.join(dir, normalized);
      if (fs.existsSync(byRelativePath)) return byRelativePath;
      const byFileName = path.join(dir, path.basename(normalized));
      if (fs.existsSync(byFileName)) return byFileName;
    }
    return '';
  };
  if (raw.startsWith('/uploads/')) return findFile(raw.split('/uploads/')[1]);
  if (raw.includes('/uploads/')) return findFile(raw.split('/uploads/').pop());
  if (raw.startsWith('/')) {
    if (fs.existsSync(raw)) return raw;
    return findFile(raw);
  }
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    const local = findFile(raw);
    if (local) return local;
    if (fs.existsSync(raw)) return raw;
  }
  try {
    const url = new URL(raw);
    const fileName = path.basename(url.pathname || '');
    return fileName ? findFile(fileName) : '';
  } catch (_error) {
    if (fs.existsSync(raw)) return raw;
  }
  return '';
};

const drawFooter = (doc, settings = {}) => {
  const pdfFont = getPdfFont(doc);
  const showPage = String(settings.show_page_number || '1') !== '0';
  const footerText = clean(settings.footer_text);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const y = doc.page.height - 24;
  if (footerText) {
    doc.font(pdfFont.regular).fontSize(pdfTextSize.footer).fillColor('#64748b').text(footerText, left, y, { width: right - left - 120, align: 'left' });
  }
  if (showPage) {
    doc.font(pdfFont.regular).fontSize(pdfTextSize.footer).fillColor('#64748b').text(`Page ${doc.page.number}`, right - 120, y, { width: 120, align: 'right' });
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
  const [renewalLetterLogoWidth, renewalLetterLogoHeight] = renewalLetterLogoSize;
  const logoWidth = logo && showLogo ? renewalLetterLogoWidth : 0;
  const logoHeight = logo && showLogo ? renewalLetterLogoHeight : 0;
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

  const headerBottomY = Math.max(doc.y + 8, 118);
  doc.y = headerBottomY + 18;
};

const getRowHeight = (doc, cols, textList, fontSize = pdfTextSize.table, minHeight = 22, paddingY = 12) => {
  const pdfFont = getPdfFont(doc);
  doc.font(pdfFont.regular).fontSize(fontSize);
  let max = minHeight;
  cols.forEach((col, i) => {
    const text = String(textList[i] ?? '');
    const h = doc.heightOfString(text, { width: Math.max(6, col.w - 8), lineGap: 0 }) + paddingY;
    if (h > max) max = h;
  });
  return max;
};

const drawTableRow = (doc, cols, y, values, options = {}) => {
  const pdfFont = getPdfFont(doc);
  const fontSize = options.fontSize || pdfTextSize.table;
  const cellPaddingY = Number.isFinite(Number(options.paddingY)) ? Number(options.paddingY) : (options.isHeader ? 7 : 6);
  const h = options.height || getRowHeight(doc, cols, values, fontSize, options.minHeight || 22, cellPaddingY * 2);
  const borderColor = options.borderColor || '#111827';
  const isHeader = !!options.isHeader;
  const cursorY = doc.y;

  cols.forEach((col, i) => {
    doc.rect(col.x, y, col.w, h).lineWidth(0.8).strokeColor(borderColor);
    if (isHeader) {
      doc.fillAndStroke('#808080', borderColor);
    } else {
      doc.stroke();
    }
    const text = String(values[i] ?? '');
    const textWidth = Math.max(6, col.w - 8);
    const textHeight = doc
      .font(isHeader || options.bold ? pdfFont.bold : pdfFont.regular)
      .fontSize(fontSize)
      .heightOfString(text, {
        width: textWidth,
        lineGap: 0
      });
    const availableHeight = h - (cellPaddingY * 2);
    const textY = options.verticalAlign === 'middle'
      ? y + cellPaddingY + Math.max(0, (availableHeight - textHeight) / 2)
      : y + cellPaddingY;
    doc
      .font(isHeader || options.bold ? pdfFont.bold : pdfFont.regular)
      .fontSize(fontSize)
      .fillColor(isHeader ? '#ffffff' : '#111827')
      .text(text, col.x + 4, textY, {
        width: textWidth,
        height: availableHeight,
        align: options.alignments?.[i] || (isHeader ? 'center' : 'left'),
        lineGap: 0,
        ellipsis: options.ellipsis === true
      });
  });
  doc.y = cursorY;
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

  doc.font(pdfFont.regular).fontSize(pdfTextSize.body).fillColor('#111827')
    .text(`Date: ${formatDate(quotation.quotation_date)}`, left, doc.y, { width: right - left, align: 'left' })
    .text(`Ref: ${clean(quotation.quotation_number)}`, left, doc.y + 2, { width: right - left, align: 'left' });

  doc.moveDown(1);
  doc.font(pdfFont.regular).fontSize(pdfTextSize.body).fillColor('#111827')
    .text('To,', left, doc.y, { width: right - left, align: 'left' });
  drawLabeledDetailBlock(
    doc,
    customerDetailLinesForQuotation(quotation),
    left,
    doc.y + 4,
    right - left,
    { labelWidth: 86, fontSize: pdfTextSize.body, lineGap: 2 }
  );

  ensureSpace(40);
  doc.moveDown(0.9);
  const primaryColor = clean(templateSettings.primary_color || companySettings.brandingAccentColor || '#9F174D');
  const serviceTitles = formatJoinedNames(items.map((item) => item?.service_title || item?.service_name || item?.pest_name));
  const title = `Quotation for ${serviceTitles || 'Pest Control Service'}`;
  doc.font(pdfFont.bold).fontSize(pdfTextSize.title).fillColor(primaryColor).text(title, left, doc.y, { width: right - left, align: 'center' });

  const opening = clean(quotation.opening_paragraph || commonParagraphs.opening_paragraph);
  if (opening) {
    ensureSpace(60);
    doc.moveDown(0.3);
    drawParagraphBlock(doc, opening, left, doc.y, right - left, { align: 'justify', lineGap: 1.2 });
  }

  ensureSpace(48);
  doc.moveDown(0.45);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.sectionHeading).fillColor(primaryColor).text('About Pest', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(0.1);
  const aboutPest = items
    .map((item) => clean(item.about_pest))
    .filter(Boolean)
    .join('\n\n');
  drawParagraphBlock(doc, aboutPest || '-', left, doc.y, right - left, { align: 'justify', lineGap: 1.2 });

  ensureSpace(48);
  doc.moveDown(0.45);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.sectionHeading).fillColor(primaryColor).text('What We Do?', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(0.1);
  const whatWeDo = items
    .map((item) => clean(item.what_we_do))
    .filter(Boolean)
    .join('\n\n');
  drawParagraphBlock(doc, whatWeDo || '-', left, doc.y, right - left, { align: 'justify', lineGap: 1.2 });

  ensureSpace(70);
  doc.moveDown(0.45);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.sectionHeading).fillColor(primaryColor).text('Recommendation', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(0.1);

  const recTableWidth = right - left;
  const recCols = [
    { x: left, w: 46 },
    { x: left + 46, w: 116 },
    { x: left + 162, w: recTableWidth - 162 }
  ];

  let h = drawTableRow(doc, recCols, doc.y, ['Sr No', 'Infestation Level', 'Recommendation'], {
    isHeader: true,
    fontSize: pdfTextSize.table,
    borderColor: '#111827',
    minHeight: 18,
    paddingY: 5
  });
  doc.y += h;

  items.forEach((item, index) => {
    const recText = clean(item.recommendation || item.what_we_do || '-');
    const rowVals = [String(index + 1), clean(item.infestation_level || '-'), recText];
    const rowHeight = getRowHeight(doc, recCols, rowVals, pdfTextSize.table, 22, 6);
    ensureSpace(rowHeight + 2);
    h = drawTableRow(doc, recCols, doc.y, rowVals, {
      fontSize: pdfTextSize.table,
      borderColor: '#111827',
      minHeight: 22,
      paddingY: 3,
      verticalAlign: 'middle',
      alignments: ['center', 'center', 'left']
    });
    doc.y += h;
  });

  ensureSpace(24);
  doc.moveDown(0.55);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.sectionHeading).fillColor(primaryColor).text(title, left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(0.1);

  const serviceNameWidth = Math.max(
    82,
    Math.min(
      140,
      Math.ceil(Math.max(
        doc.font(pdfFont.bold).fontSize(pdfTextSize.table).widthOfString('Service'),
        ...items.map((item) => doc.font(pdfFont.regular).fontSize(pdfTextSize.table).widthOfString(clean(item.service_name || '-')))
      )) + 16
    )
  );
  const serviceTableWidth = right - left;
  const serviceFixedWidth = 30 + serviceNameWidth + 72;
  const remainingServiceWidth = Math.max(230, serviceTableWidth - serviceFixedWidth);
  const frequencyWidth = Math.round(remainingServiceWidth * 0.48);
  const amountWidth = remainingServiceWidth - frequencyWidth;
  const serviceCols = [
    { x: left, w: 30 },
    { x: left + 30, w: serviceNameWidth },
    { x: left + 30 + serviceNameWidth, w: frequencyWidth },
    { x: left + 30 + serviceNameWidth + frequencyWidth, w: 72 },
    { x: left + 30 + serviceNameWidth + frequencyWidth + 72, w: amountWidth }
  ];

  h = drawTableRow(doc, serviceCols, doc.y, ['#', 'Service', 'Frequency', 'GST %', 'Amount'], {
    isHeader: true,
    fontSize: pdfTextSize.table,
    borderColor: '#111827',
    minHeight: 22
  });
  doc.y += h;

  items.forEach((item, index) => {
    const rowVals = [
      String(index + 1),
      clean(item.service_name || '-'),
      clean(item.frequency || '-'),
      `${toNumber(item.gst_percentage, 0)}%`,
      formatINR(item.total_amount)
    ];

    const rowHeight = getRowHeight(doc, serviceCols, rowVals, pdfTextSize.table, 30, 8);
    ensureSpace(rowHeight + 2);
    h = drawTableRow(doc, serviceCols, doc.y, rowVals, {
      fontSize: pdfTextSize.table,
      borderColor: '#111827',
      minHeight: 30,
      paddingY: 4,
      verticalAlign: 'middle',
      alignments: ['center', 'left', 'center', 'center', 'center']
    });
    doc.y += h;
  });

  ensureSpace(28);
  doc.moveDown(0.9);

  const baseClosingText = clean(
    quotation.closing_paragraph
    || commonParagraphs.closing_paragraph
    || commonParagraphs.relationship_closing_paragraph
  ) || [
    'We look forward to working with you and hope this is the beginning of a long and prosperous relationship.',
    'For any clarification, please feel free to contact me.'
  ].join('\n');
  const closingText = /clarification/i.test(baseClosingText)
    ? baseClosingText
    : `${baseClosingText}\nFor any clarification, please feel free to contact me.`;
  const blocks = [
    ['Payment Terms', cleanPaymentTerms(quotation.payment_terms || commonParagraphs.payment_terms)],
    ['', closingText]
  ].filter(([, txt]) => txt);

  blocks.forEach(([titleText, body]) => {
    ensureSpace(70);
    doc.moveDown(0.3);
    if (titleText) {
      const headingSize = titleText === 'Payment Terms' ? pdfTextSize.paymentHeading : pdfTextSize.sectionHeading;
      doc.font(pdfFont.bold).fontSize(headingSize).fillColor(primaryColor).text(titleText, left, doc.y, { width: right - left, align: 'left' });
      if (titleText === 'Payment Terms') doc.moveDown(0.25);
    }
    const bodySize = titleText === 'Payment Terms' ? pdfTextSize.paymentBody : pdfTextSize.body;
    doc.font(pdfFont.regular).fontSize(bodySize).fillColor('#111827').text(body, left, doc.y, { width: right - left, align: titleText === 'Payment Terms' ? 'left' : 'justify', lineGap: 1 });
    if (titleText === 'Payment Terms') doc.moveDown(1.2);
  });

  ensureSpace(90);
  doc.moveDown(2.8);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.signature).fillColor('#111827').text('Yours Truly,', left, doc.y, { width: right - left, align: 'left' });
  doc.font(pdfFont.bold).fontSize(pdfTextSize.signature).text('For Skuas Pest Control Pvt Ltd', left, doc.y, { width: right - left, align: 'left' });

  if (String(templateSettings.show_signature || '1') !== '0') {
    const signature = resolveUploadAsset(templateSettings.signature_image_url);
    if (signature) {
      try { doc.image(signature, left, doc.y + 4, { width: 90, height: 42 }); } catch (_e) {}
    }
  }

  doc.moveDown(3.3);
  [
    clean(quotation.sales_person || templateSettings.default_sales_person),
    clean(quotation.designation || templateSettings.default_designation),
    clean(quotation.mobile || templateSettings.default_mobile)
  ].filter(Boolean).forEach((line) => {
    doc.font(pdfFont.regular).fontSize(pdfTextSize.signature).text(line, left, doc.y, { width: right - left, align: 'left' });
  });

  doc.end();
});

module.exports = {
  generateQuotationPdfBuffer
};
