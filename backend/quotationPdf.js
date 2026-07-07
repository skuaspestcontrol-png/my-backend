const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const toNumber = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clean = (v) => String(v ?? '').trim();
const toBooleanFlag = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'true' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === 'no') return false;
  return fallback;
};
const renewalLetterLogoSize = [400, 160];
const pdfTextSize = {
  title: 12.5,
  body: 9.6,
  sectionHeading: 9.8,
  paymentHeading: 9.8,
  paymentBody: 9.4,
  signature: 9.6,
  table: 8.8,
  footer: 9.6
};
const sectionSpacing = {
  beforeHeading: 0.8,
  afterHeading: 0.22,
  afterContent: 0.7,
  afterTable: 0.65
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

const resolveQuotationBankDetails = (companySettings = {}, preferGst = true) => {
  const useGst = preferGst !== false;
  const primary = useGst ? 'gst' : 'nonGst';
  const fallback = useGst ? 'nonGst' : 'gst';
  const pick = (field) => clean(companySettings[`${primary}${field}`] || companySettings[`${fallback}${field}`]);

  return {
    bankAccountName: pick('BankAccountName'),
    bankName: pick('BankName'),
    bankAccount: pick('BankAccountNumber'),
    bankIfsc: pick('BankIfsc'),
    bankUpi: pick('BankUpiId')
  };
};

const ownTextOrDefault = (source = {}, key, fallback = '') => (
  Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null
    ? clean(source[key])
    : clean(fallback)
);

const hasOwnTextField = (source = {}, key) => Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null;

const appendAddressMeta = (address = '', city = '', pincode = '') => {
  const base = clean(address);
  const parts = [clean(city), clean(pincode)].filter(Boolean);
  if (!parts.length) return base;
  const lowerBase = base.toLowerCase();
  const missingParts = parts.filter((part) => !lowerBase.includes(part.toLowerCase()));
  if (!missingParts.length) return base;
  return [base, missingParts.join(' - ')].filter(Boolean).join('\n');
};

const isLeadQuotation = (quotation = {}) => clean(quotation.source_type).toLowerCase() === 'lead' || Boolean(clean(quotation.lead_id));

const formatLeadCustomerAddress = (address = '', city = '', pincode = '') => {
  const base = clean(address);
  const cityText = clean(city);
  const pincodeText = clean(pincode);
  const metaLine = cityText && pincodeText ? `${cityText}-${pincodeText}` : cityText || pincodeText;
  if (!metaLine) return base;

  const lowerBase = base.toLowerCase();
  const hasCity = cityText && lowerBase.includes(cityText.toLowerCase());
  const hasPincode = pincodeText && lowerBase.includes(pincodeText.toLowerCase());
  if ((cityText ? hasCity : true) && (pincodeText ? hasPincode : true)) return base;

  return [base, metaLine].filter(Boolean).join('\n');
};

const customerDetailLinesForQuotation = (quotation = {}) => {
  const customerName = clean(quotation.customer_name);
  const companyName = clean(quotation.company_name);
  const address = isLeadQuotation(quotation)
    ? formatLeadCustomerAddress(quotation.address, quotation.premise_city, quotation.premise_pincode)
    : appendAddressMeta(quotation.address, quotation.premise_city, quotation.premise_pincode);
  const identityLines = companyName
    ? [
        { label: '', value: companyName, bold: true },
        { label: '', value: customerName, bold: false }
      ]
    : [
        { label: '', value: customerName, bold: true }
      ];

  return [
    ...identityLines,
    { label: '', value: address, bold: false },
    { label: 'Phone', value: clean(quotation.phone), bold: false },
    { label: 'Email', value: clean(quotation.email), bold: false },
    { label: 'GSTIN', value: clean(quotation.gstNumber || quotation.gstin), bold: false }
  ].filter((row) => clean(row.value));
};

const drawLabeledDetailBlock = (doc, rows = [], x, y, width, options = {}) => {
  const pdfFont = getPdfFont(doc);
  const labelWidth = options.labelWidth || 88;
  const fontSize = options.fontSize || pdfTextSize.body;
  const lineGap = Number.isFinite(Number(options.lineGap)) ? Number(options.lineGap) : 2;
  let cursorY = y;

  rows.forEach((row) => {
    const labelText = clean(row?.label);
    const text = clean(row?.value);
    const inlineText = labelText ? `${labelText}: ${text}` : text;
    const rowFont = row?.bold ? pdfFont.bold : pdfFont.regular;
    const rowHeight = doc.font(rowFont)
      .fontSize(fontSize)
      .heightOfString(inlineText || ' ', { width, lineGap });

    doc.font(rowFont).fontSize(fontSize).fillColor('#111827')
      .text(inlineText, x, cursorY, { width, align: 'left', lineGap });

    cursorY += rowHeight + (options.rowGap ?? 0);
  });

  doc.y = cursorY;
};

const drawInlineLabelValue = (doc, label, value, x, y, width, options = {}) => {
  const pdfFont = getPdfFont(doc);
  const fontSize = options.fontSize || pdfTextSize.body;
  const lineGap = Number.isFinite(Number(options.lineGap)) ? Number(options.lineGap) : 0;
  const labelText = clean(label);
  const valueText = clean(value);
  const labelWidth = doc.font(pdfFont.bold).fontSize(fontSize).widthOfString(labelText);

  doc.font(pdfFont.bold).fontSize(fontSize).fillColor('#111827')
    .text(labelText, x, y, { width: labelWidth, align: 'left', lineBreak: false, lineGap });
  doc.font(pdfFont.regular).fontSize(fontSize).fillColor('#111827')
    .text(valueText, x + labelWidth, y, { width: Math.max(10, width - labelWidth), align: 'left', lineGap });
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

const getUploadRootCandidates = () => {
  const persistentUploadRoot = String(
    process.env.UPLOADS_ROOT
    || '/home/u610009593/uploads-skuas-crm'
  ).trim();
  return [
    persistentUploadRoot,
    '/home/u610009593/uploads-skuas-crm',
    String(process.env.UPLOADS_MIRROR_DIR || '').trim(),
    path.join(__dirname, '..', 'storage', 'uploads'),
    path.join(__dirname, 'uploads'),
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'public', 'uploads')
  ].filter(Boolean);
};

const resolveUploadAsset = (input = '', options = {}) => {
  const raw = clean(input);
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  const dirs = Array.isArray(options.rootDirs) && options.rootDirs.length
    ? [...new Set(options.rootDirs.map((dir) => String(dir || '').trim()).filter(Boolean))]
    : getUploadRootCandidates();
  const allowRemoteFetch = options.allowRemoteFetch !== false;
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
  if (allowRemoteFetch) {
    try {
      const url = new URL(raw);
      const fileName = path.basename(url.pathname || '');
      return fileName ? findFile(fileName) : '';
    } catch (_error) {
      if (fs.existsSync(raw)) return raw;
    }
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

const renderQuotationPdfHeader = (doc, settings = {}, companySettings = {}) => {
  const pdfFont = getPdfFont(doc);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const logoInput = companySettings.gstCompanyLogoUrl || settings.logo_url || '';
  const startY = doc.y;
  const logo = resolveUploadAsset(
    companySettings.gstCompanyLogoUrl
    || settings.logo_url
  );
  const companyName = clean(
    companySettings.gstCompanyName
    || companySettings.companyName
    || settings.company_name
    || 'SKUAS Pest Control Private Limited'
  );
  const companyTagline = clean(
    companySettings.aboutTagline
    || companySettings.companyTagline
    || settings.about_tagline
    || settings.aboutTagline
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
  const companyAlternatePhone = clean(companySettings.gstAlternatePhone || companySettings.nonGstAlternatePhone);
  const companyWebsite = clean(companySettings.companyWebsite || settings.website);
  const companyGst = clean(companySettings.companyGstNumber || companySettings.gstRegistrationNumber || settings.company_gst_number || settings.gstNumber);
  const companyDetailLines = [
    companyAddress,
    companyCityLine || companyPin ? `${companyCityLine}${companyPin ? ` - ${companyPin}` : ''}, India` : '',
    `Email: ${companyEmail || '-'}`,
    `Mobile: ${companyPhone ? `${companyPhone}${companyAlternatePhone ? ` | ${companyAlternatePhone}` : ''}` : (companyAlternatePhone || '-')}`,
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
  const taglineHeight = companyTagline ? 9.1 : 0;
  const headerBoxHeight = 11.2 + taglineHeight + (companyDetailLines.length * detailLineHeight);
  const [renewalLetterLogoWidth, renewalLetterLogoHeight] = renewalLetterLogoSize;
  const logoWidth = logo && showLogo ? renewalLetterLogoWidth : 0;
  const logoHeight = logo && showLogo ? renewalLetterLogoHeight : 0;
  const logoY = headerTopY + ((headerBoxHeight - logoHeight) / 2);

  if (logo && showLogo) {
    try { doc.image(logo, left, logoY, { fit: [logoWidth, logoHeight] }); } catch (_e) {}
  }

  doc.font(pdfFont.bold).fontSize(10.2).fillColor('#111827')
    .text(companyName, headerX, headerTopY, { width: width, align: 'left', lineBreak: false });
  if (companyTagline) {
    doc.font(pdfFont.regular).fontSize(8.4).fillColor('#475569')
      .text(companyTagline, headerX, headerTopY + 11.2, { width: headerWidth, align: 'left', lineBreak: false });
  }
  doc.font(pdfFont.regular).fontSize(8.1).fillColor('#475569');
  companyDetailLines.forEach((line) => {
    doc.text(line, headerX, doc.y + 1, { width: headerWidth, align: 'left', lineGap: 0 });
  });

  const headerBottomY = Math.max(doc.y + 8, 118);
  doc.y = startY;
  return { headerBottomY, headerHeight: headerBottomY - headerTopY };
};

const drawHeader = (doc, settings = {}, companySettings = {}) => {
  const { headerBottomY } = renderQuotationPdfHeader(doc, settings, companySettings);
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
    const availableHeight = h - (cellPaddingY * 2);
    const textY = y + cellPaddingY;
    doc
      .font(isHeader || options.bold ? pdfFont.bold : pdfFont.regular)
      .fontSize(fontSize)
      .fillColor(isHeader ? '#ffffff' : '#111827')
      .text(text, col.x + 4, textY, {
        width: textWidth,
        height: availableHeight,
        align: options.alignments?.[i] || (isHeader ? 'center' : 'left'),
        valign: options.verticalAlign === 'middle' ? 'center' : 'top',
        lineGap: 0,
        ellipsis: options.ellipsis === true
      });
  });
  doc.y = cursorY;
  return h;
};

const drawMergedSummaryRow = (doc, leftText, rightText, y, widths, options = {}) => {
  const pdfFont = getPdfFont(doc);
  const fontSize = options.fontSize || pdfTextSize.table;
  const borderColor = options.borderColor || '#111827';
  const paddingY = Number.isFinite(Number(options.paddingY)) ? Number(options.paddingY) : 4;
  const left = clean(leftText);
  const right = clean(rightText);
  const leftHeight = doc.font(options.bold ? pdfFont.bold : pdfFont.regular)
    .fontSize(fontSize)
    .heightOfString(left || ' ', { width: Math.max(8, widths.left - 8), lineGap: 0 });
  const rightHeight = doc.font(options.bold ? pdfFont.bold : pdfFont.regular)
    .fontSize(fontSize)
    .heightOfString(right || ' ', { width: Math.max(8, widths.right - 8), lineGap: 0 });
  const h = Math.max(options.minHeight || 22, Math.ceil(Math.max(leftHeight, rightHeight) + (paddingY * 2)));
  const fill = options.fillColor || '#ffffff';

  doc.rect(widths.x, y, widths.left, h).fillAndStroke(fill, borderColor);
  doc.rect(widths.x + widths.left, y, widths.right, h).fillAndStroke(fill, borderColor);

  doc.font(options.bold ? pdfFont.bold : pdfFont.regular)
    .fontSize(fontSize)
    .fillColor('#111827')
    .text(left, widths.x + 4, y + paddingY, {
      width: Math.max(8, widths.left - 8),
      align: options.leftAlign || 'left',
      lineGap: 0
    });
  doc.font(options.bold ? pdfFont.bold : pdfFont.regular)
    .fontSize(fontSize)
    .fillColor('#111827')
    .text(right, widths.x + widths.left + 4, y + paddingY, {
      width: Math.max(8, widths.right - 8),
      align: options.rightAlign || 'center',
      lineGap: 0
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

  drawInlineLabelValue(doc, 'Date: ', formatDate(quotation.quotation_date), left, doc.y, right - left, { fontSize: pdfTextSize.body });
  doc.y += doc.currentLineHeight(true) + 2;
  drawInlineLabelValue(doc, 'Ref: ', clean(quotation.quotation_number), left, doc.y, right - left, { fontSize: pdfTextSize.body });
  doc.y += doc.currentLineHeight(true);

  doc.moveDown(1);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.body).fillColor('#111827')
    .text('To,', left, doc.y, { width: right - left, align: 'left' });
  drawLabeledDetailBlock(
    doc,
    customerDetailLinesForQuotation(quotation),
    left,
    doc.y + 2,
    right - left,
    { fontSize: pdfTextSize.body, lineGap: 0, rowGap: 0 }
  );

  ensureSpace(40);
  doc.moveDown(0.35);
  const primaryColor = clean(templateSettings.primary_color || companySettings.brandingAccentColor || '#9F174D');
  const rateType = clean(quotation.rate_type || 'With GST');
  const isGstQuotation = !/^without\s+gst$/i.test(rateType);
  const serviceTitles = formatJoinedNames(items.map((item) => item?.service_title || item?.service_name || item?.pest_name));
  const title = `Quotation for ${serviceTitles || 'Pest Control Service'}`;
  doc.font(pdfFont.bold).fontSize(pdfTextSize.title).fillColor(primaryColor).text(title, left, doc.y, { width: right - left, align: 'center' });

  const opening = ownTextOrDefault(quotation, 'opening_paragraph', commonParagraphs.opening_paragraph);
  if (opening) {
    ensureSpace(60);
    doc.moveDown(0.3);
    drawParagraphBlock(doc, opening, left, doc.y, right - left, { align: 'justify', lineGap: 1.2 });
  }

  ensureSpace(48);
  doc.moveDown(sectionSpacing.beforeHeading);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.sectionHeading).fillColor(primaryColor).text('About Pest', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(sectionSpacing.afterHeading);
  const aboutPest = Array.from(new Set(
    items
      .map((item) => clean(item.about_pest))
      .filter(Boolean)
  )).join('\n\n');
  drawParagraphBlock(doc, aboutPest || '-', left, doc.y, right - left, { align: 'justify', lineGap: 1.2 });
  doc.moveDown(sectionSpacing.afterContent);

  ensureSpace(48);
  doc.moveDown(sectionSpacing.beforeHeading);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.sectionHeading).fillColor(primaryColor).text('What We Do?', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(sectionSpacing.afterHeading);
  const whatWeDo = Array.from(new Set(
    items
      .map((item) => clean(item.what_we_do))
      .filter(Boolean)
  )).join('\n\n');
  drawParagraphBlock(doc, whatWeDo || '-', left, doc.y, right - left, { align: 'justify', lineGap: 1.2 });
  doc.moveDown(sectionSpacing.afterContent);

  ensureSpace(70);
  doc.moveDown(sectionSpacing.beforeHeading);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.sectionHeading).fillColor(primaryColor).text('Recommendation', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(sectionSpacing.afterHeading);

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
  doc.moveDown(sectionSpacing.afterTable);

  ensureSpace(70);
  doc.moveDown(sectionSpacing.beforeHeading);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.sectionHeading).fillColor(primaryColor).text('Scope of Work:', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(sectionSpacing.afterHeading);

  const scopeTableWidth = right - left;
  const scopeNumberWidth = 34;
  const scopeServiceWidth = Math.round(scopeTableWidth * 0.19);
  const scopeAreaWidth = Math.round(scopeTableWidth * 0.17);
  const scopeMethodWidth = Math.round(scopeTableWidth * 0.29);
  const scopeFrequencyWidth = scopeTableWidth - scopeNumberWidth - scopeServiceWidth - scopeAreaWidth - scopeMethodWidth;
  const scopeCols = [
    { x: left, w: scopeNumberWidth },
    { x: left + scopeNumberWidth, w: scopeServiceWidth },
    { x: left + scopeNumberWidth + scopeServiceWidth, w: scopeAreaWidth },
    { x: left + scopeNumberWidth + scopeServiceWidth + scopeAreaWidth, w: scopeMethodWidth },
    { x: left + scopeNumberWidth + scopeServiceWidth + scopeAreaWidth + scopeMethodWidth, w: scopeFrequencyWidth }
  ];

  h = drawTableRow(doc, scopeCols, doc.y, ['Sr No', 'Service Name', 'Area Cover', 'Treatment Methodology', 'Frequency'], {
    isHeader: true,
    fontSize: pdfTextSize.table,
    borderColor: '#111827',
    minHeight: 18,
    paddingY: 4,
    verticalAlign: 'middle'
  });
  doc.y += h;

  items.forEach((item, index) => {
    const treatmentMethodology = clean(item.treatment_points || item.what_we_do || item.recommendation || '-');
    const rowVals = [
      String(index + 1),
      clean(item.service_name || item.service_title || '-'),
      clean(item.area_covered || quotation.premise_area_name || quotation.area_name || '-'),
      treatmentMethodology,
      clean(item.frequency || '-')
    ];
    const rowHeight = getRowHeight(doc, scopeCols, rowVals, pdfTextSize.table, 28, 8);
    ensureSpace(rowHeight + 2);
    h = drawTableRow(doc, scopeCols, doc.y, rowVals, {
      fontSize: pdfTextSize.table,
      borderColor: '#111827',
      minHeight: 28,
      paddingY: 4,
      verticalAlign: 'middle',
      alignments: ['center', 'left', 'center', 'left', 'center']
    });
    doc.y += h;
  });
  doc.moveDown(sectionSpacing.afterTable);

  ensureSpace(24);
  doc.moveDown(sectionSpacing.beforeHeading);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.sectionHeading).fillColor(primaryColor).text(title, left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(sectionSpacing.afterHeading);

  const serviceTableWidth = right - left;
  const serviceNumberWidth = 30;
  const serviceNameWidth = Math.round(serviceTableWidth * 0.28);
  const amountWithoutWidth = Math.round(serviceTableWidth * 0.34);
  const amountWithWidth = serviceTableWidth - serviceNumberWidth - serviceNameWidth - amountWithoutWidth;
  const serviceCols = [
    { x: left, w: serviceNumberWidth },
    { x: left + serviceNumberWidth, w: serviceNameWidth },
    { x: left + serviceNumberWidth + serviceNameWidth, w: amountWithoutWidth },
    { x: left + serviceNumberWidth + serviceNameWidth + amountWithoutWidth, w: amountWithWidth }
  ];

  const serviceHeadings = isGstQuotation
    ? ['#', 'Service', 'Amount without GST', 'Amount with GST']
    : ['#', 'Service', 'GST %', 'Total Amount'];
  h = drawTableRow(doc, serviceCols, doc.y, serviceHeadings, {
    isHeader: true,
    fontSize: pdfTextSize.table,
    borderColor: '#111827',
    minHeight: 15,
    paddingY: 3,
    verticalAlign: 'middle'
  });
  doc.y += h;

  items.forEach((item, index) => {
    const amountWithoutGst = toNumber(item.quantity, 1) * toNumber(item.rate_without_gst, 0);
    const gstAmount = toNumber(item.gst_amount, amountWithoutGst * (toNumber(item.gst_percentage, 0) / 100));
    const amountWithGst = amountWithoutGst + gstAmount;
    const rowVals = isGstQuotation
      ? [
          String(index + 1),
          clean(item.service_name || '-'),
          formatINR(amountWithoutGst),
          formatINR(amountWithGst)
        ]
      : [
          String(index + 1),
          clean(item.service_name || '-'),
          Number.isFinite(Number(item.gst_percentage)) ? `${Number(item.gst_percentage)}%` : clean(item.gst_percentage || '-'),
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
      alignments: ['center', 'left', 'center', 'center']
    });
    doc.y += h;
  });

  if (isGstQuotation && items.length) {
    const totalAmountWithGst = items.reduce((sum, item) => sum + toNumber(item.total_amount, toNumber(item.quantity, 1) * toNumber(item.rate_without_gst, 0) + toNumber(item.gst_amount, 0)), 0);
    const summaryTop = doc.y;
    const summaryHeight = drawMergedSummaryRow(
      doc,
      `Total Amount with GST: ${formatINR(totalAmountWithGst)}`,
      `Rupees ${numberToIndianWords(totalAmountWithGst)} Only/-`,
      summaryTop,
      {
        x: left,
        left: serviceNumberWidth + serviceNameWidth,
        right: serviceTableWidth - (serviceNumberWidth + serviceNameWidth)
      },
      {
        fontSize: pdfTextSize.table,
        borderColor: '#111827',
        minHeight: 22,
        paddingY: 4,
        bold: true,
        leftAlign: 'left',
        rightAlign: 'center'
      }
    );
    doc.y = summaryTop + summaryHeight;
  }
  doc.moveDown(sectionSpacing.afterTable);

  ensureSpace(28);
  doc.moveDown(sectionSpacing.beforeHeading);

  const closingFallback = hasOwnTextField(quotation, 'closing_paragraph') ? '' : [
    'We look forward to working with you and hope this is the beginning of a long and prosperous relationship.',
    'For any clarification, please feel free to contact me.'
  ].join('\n');
  const baseClosingText = ownTextOrDefault(
    quotation,
    'closing_paragraph',
    commonParagraphs.closing_paragraph || commonParagraphs.relationship_closing_paragraph || closingFallback
  );
  const closingText = !baseClosingText
    ? ''
    : /clarification/i.test(baseClosingText)
    ? baseClosingText
    : `${baseClosingText}\nFor any clarification, please feel free to contact me.`;
  const paymentTermsText = ownTextOrDefault(quotation, 'payment_terms', commonParagraphs.payment_terms);
  const showGstin = String(templateSettings.show_gstin ?? companySettings.show_gstin ?? '1') !== '0';
  const showPaymentDetailsInPdf = quotation.show_payment_details_in_pdf == null
    ? (quotation.showPaymentDetailsInPdf == null ? true : toBooleanFlag(quotation.showPaymentDetailsInPdf, true))
    : toBooleanFlag(quotation.show_payment_details_in_pdf, true);
  const bankDetails = resolveQuotationBankDetails(companySettings, showGstin);
  const paymentDetailsRows = [
    ['A/C Name', bankDetails.bankAccountName],
    ['Bank Name', bankDetails.bankName],
    ['A/C No', bankDetails.bankAccount],
    ['IFSC', bankDetails.bankIfsc],
    ['UPI ID', bankDetails.bankUpi]
  ].filter(([, value]) => clean(value));
  const paymentTermsBody = paymentTermsText ? cleanPaymentTerms(paymentTermsText) : '';
  if (paymentTermsBody) {
    ensureSpace(70);
    doc.moveDown(sectionSpacing.beforeHeading);
    doc.font(pdfFont.bold).fontSize(pdfTextSize.paymentHeading).fillColor(primaryColor).text('Payment Terms', left, doc.y, { width: right - left, align: 'left' });
    doc.moveDown(sectionSpacing.afterHeading);
    doc.font(pdfFont.regular).fontSize(pdfTextSize.paymentBody).fillColor('#111827')
      .text(paymentTermsBody, left, doc.y, { width: right - left, align: 'left', lineGap: 1 });
    doc.moveDown(0.45);
  }

  if (showPaymentDetailsInPdf && paymentDetailsRows.length) {
    ensureSpace(60);
    doc.moveDown(sectionSpacing.beforeHeading);
    doc.font(pdfFont.bold).fontSize(pdfTextSize.paymentHeading).fillColor(primaryColor).text('Payment Details', left, doc.y, { width: right - left, align: 'left' });
    doc.moveDown(sectionSpacing.afterHeading);
    drawLabeledDetailBlock(doc, paymentDetailsRows.map(([label, value]) => ({ label, value })), left, doc.y, right - left, {
      fontSize: pdfTextSize.paymentBody,
      lineGap: 1.2,
      rowGap: 2,
      labelWidth: 82
    });
    doc.moveDown(0.45);
  }

  if (closingText) {
    ensureSpace(44);
    doc.moveDown(0.25);
    doc.font(pdfFont.regular).fontSize(pdfTextSize.body).fillColor('#111827')
      .text(closingText, left, doc.y, { width: right - left, align: 'justify', lineGap: 1 });
    doc.moveDown(0.9);
  }

  ensureSpace(90);
  doc.moveDown(2.2);
  doc.font(pdfFont.regular).fontSize(pdfTextSize.signature).fillColor('#111827').text('Thanking you,', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(0.55);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.signature).text('Yours Truly,', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(0.3);
  doc.font(pdfFont.bold).fontSize(pdfTextSize.signature).text('For Skuas Pest Control Pvt Ltd', left, doc.y, { width: right - left, align: 'left' });
  doc.moveDown(0.28);
  [
    clean(quotation.sales_person || templateSettings.default_sales_person),
    clean(quotation.designation || templateSettings.default_designation),
    clean(quotation.mobile || templateSettings.default_mobile)
  ].filter(Boolean).forEach((line, index) => {
    const formattedLine = index === 2 ? `Mob: ${line}` : line;
    doc.font(pdfFont.regular).fontSize(pdfTextSize.signature).text(formattedLine, left, doc.y, { width: right - left, align: 'left' });
  });

  doc.end();
});

module.exports = {
  generateQuotationPdfBuffer,
  resolveUploadAsset,
  renderQuotationPdfHeader
};
