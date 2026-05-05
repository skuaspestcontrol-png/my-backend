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

const resolveUploadAsset = (input = '') => {
  const raw = clean(input);
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  const uploadsDir = String(process.env.UPLOADS_DIR || process.env.PERSISTENT_UPLOADS_DIR || '').trim() || path.join(__dirname, '..', 'storage', 'uploads');
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
  const showPage = String(settings.show_page_number || '1') !== '0';
  const footerText = clean(settings.footer_text);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const y = doc.page.height - 24;
  if (footerText) {
    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(footerText, left, y, { width: right - left - 120, align: 'left' });
  }
  if (showPage) {
    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(`Page ${doc.page.number}`, right - 120, y, { width: 120, align: 'right' });
  }
};

const drawHeader = (doc, settings = {}, quotation = {}) => {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const logo = resolveUploadAsset(settings.logo_url);
  const logoW = Math.max(30, toNumber(settings.logo_width, 90));
  const logoH = Math.max(24, toNumber(settings.logo_height, 70));
  const align = clean(settings.header_alignment || 'left').toLowerCase();
  const lineColor = clean(settings.header_line_color || '#9F174D');

  let logoX = left;
  if (align === 'center') logoX = left + (width - logoW) / 2;
  if (align === 'right') logoX = right - logoW;

  const showLogo = String(settings.show_logo || '1') !== '0';
  if (logo && showLogo) {
    try { doc.image(logo, logoX, 30, { width: logoW, height: logoH }); } catch (_e) {}
  }

  doc.font('Helvetica-Bold').fontSize(Math.max(12, toNumber(settings.heading_font_size, 14))).fillColor('#111827')
    .text(clean(settings.company_name || 'SKUAS Pest Control Private Limited'), left, 30, { width, align });

  doc.font('Helvetica').fontSize(Math.max(9, toNumber(settings.body_font_size, 10))).fillColor('#374151');
  const addr = clean(settings.company_address);
  if (addr) doc.text(addr, left, doc.y + 1, { width, align });
  const contacts = [clean(settings.phone), clean(settings.email), clean(settings.website)].filter(Boolean).join(' | ');
  if (contacts) doc.text(contacts, left, doc.y + 1, { width, align });
  if (String(settings.show_gstin || '1') !== '0' && clean(settings.gstin)) doc.text(`GSTIN: ${clean(settings.gstin)}`, left, doc.y + 1, { width, align });

  doc.font('Helvetica').fontSize(10).fillColor('#111827')
    .text(`Date: ${formatDate(quotation.quotation_date)}`, right - 220, 32, { width: 220, align: 'right' })
    .text(`Ref: ${clean(quotation.quotation_number)}`, right - 220, doc.y + 3, { width: 220, align: 'right' });

  const lineY = Math.max(doc.y + 10, 114);
  doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(1).strokeColor(lineColor).stroke();
  doc.y = lineY + 10;
};

const getRowHeight = (doc, cols, textList, fontSize = 9, minHeight = 22) => {
  doc.font('Helvetica').fontSize(fontSize);
  let max = minHeight;
  cols.forEach((col, i) => {
    const text = String(textList[i] ?? '');
    const h = doc.heightOfString(text, { width: Math.max(6, col.w - 8) }) + 8;
    if (h > max) max = h;
  });
  return max;
};

const drawTableRow = (doc, cols, y, values, options = {}) => {
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
    doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor('#111827')
      .text(String(values[i] ?? ''), col.x + 4, y + 4, { width: col.w - 8, height: h - 8 });
  });
  return h;
};

const generateQuotationPdfBuffer = ({ quotation = {}, items = [], templateSettings = {}, commonParagraphs = {} }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 30, bottom: 34, left: 44, right: 44 }, bufferPages: true });
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
    drawHeader(doc, templateSettings, quotation);
  };
  const ensureSpace = (needed = 40) => {
    if (doc.y + needed > usableBottom()) newPage();
  };

  drawHeader(doc, templateSettings, quotation);

  doc.font('Helvetica').fontSize(10).fillColor('#111827')
    .text('To,')
    .text(clean(quotation.customer_name || quotation.company_name || 'Customer'))
    .text(clean(quotation.address || '-'));

  ensureSpace(40);
  doc.moveDown(0.4);
  const title = items.length > 1
    ? 'Quotation for Pest Control Services'
    : `Quotation for ${clean(items[0]?.service_name || 'Pest Control Service')}`;
  doc.font('Helvetica-Bold').fontSize(Math.max(13, toNumber(templateSettings.heading_font_size, 14))).fillColor(clean(templateSettings.primary_color || '#9F174D')).text(title);

  const opening = clean(quotation.opening_paragraph || commonParagraphs.opening_paragraph);
  if (opening) {
    ensureSpace(60);
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(Math.max(9, toNumber(templateSettings.body_font_size, 10))).fillColor('#111827').text(opening, { align: 'justify' });
  }

  ensureSpace(48);
  doc.moveDown(0.7);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(clean(templateSettings.primary_color || '#9F174D')).text('SERVICE SUMMARY');
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
    fontSize: Math.max(8, toNumber(templateSettings.table_font_size, 9)),
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

    const rowHeight = getRowHeight(doc, serviceCols, rowVals, 8.4, 32);
    ensureSpace(rowHeight + 2);
    h = drawTableRow(doc, serviceCols, doc.y, rowVals, {
      fontSize: 8.4,
      borderColor: clean(templateSettings.border_color || '#cbd5e1'),
      minHeight: 32
    });
    doc.y += h;
  });

  ensureSpace(70);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(clean(templateSettings.primary_color || '#9F174D')).text('RECOMMENDATION TABLE');
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
    fontSize: Math.max(8, toNumber(templateSettings.table_font_size, 9)),
    borderColor: clean(templateSettings.border_color || '#cbd5e1'),
    minHeight: 24
  });
  doc.y += h;

  items.forEach((item, index) => {
    const recText = clean(item.recommendation || item.what_we_do || '-');
    const rowVals = [String(index + 1), clean(item.service_name || '-'), clean(item.infestation_level || '-'), '', recText];
    const rowHeight = Math.max(54, getRowHeight(doc, recCols, rowVals, 8.2, 54));
    ensureSpace(rowHeight + 2);
    const y = doc.y;
    h = drawTableRow(doc, recCols, y, rowVals, {
      fontSize: 8.2,
      borderColor: clean(templateSettings.border_color || '#cbd5e1'),
      minHeight: 54
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
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#111827').text(label, sumX, doc.y, { width: 110 });
    doc.text(value, sumX + 110, doc.y - 10, { width: 90, align: 'right' });
    doc.moveDown(0.2);
  };
  line('Subtotal', `₹ ${formatINR(subtotal)}`);
  line('GST', `₹ ${formatINR(gstTotal)}`);
  line('Round Off', `₹ ${formatINR(roundOff)}`);
  line('Grand Total', `₹ ${formatINR(grand)}`, true);
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(10).text('Amount in words');
  doc.font('Helvetica').fontSize(9).text(amountInWords(grand));

  const blocks = [
    ['Payment Terms', clean(quotation.payment_terms || commonParagraphs.payment_terms)],
    ['Warranty', clean(quotation.warranty_note || commonParagraphs.warranty_paragraph)],
    ['Disclaimer', clean(quotation.disclaimer || commonParagraphs.disclaimer_paragraph)],
    ['Closing', clean(quotation.closing_paragraph || commonParagraphs.closing_paragraph || commonParagraphs.relationship_closing_paragraph)]
  ].filter(([, txt]) => txt);

  blocks.forEach(([titleText, body]) => {
    ensureSpace(70);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(clean(templateSettings.primary_color || '#9F174D')).text(titleText);
    doc.font('Helvetica').fontSize(9.2).fillColor('#111827').text(body, { align: 'justify' });
  });

  ensureSpace(90);
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text('Yours Truly,');
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
