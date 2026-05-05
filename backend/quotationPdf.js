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
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatINR = (value) => toNumber(value, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const resolveUploadAsset = (input = '') => {
  const raw = clean(input);
  if (!raw) return '';
  if (raw.startsWith('data:image/')) return raw;
  const uploadsDir = String(process.env.UPLOADS_DIR || process.env.PERSISTENT_UPLOADS_DIR || '').trim() || path.join(__dirname, '..', 'storage', 'uploads');
  const dirs = [uploadsDir, path.join(__dirname, 'uploads'), path.join(__dirname, '..', 'uploads')];

  const tryFile = (name) => {
    const safeName = decodeURIComponent(String(name || '').trim());
    if (!safeName) return '';
    for (const dir of dirs) {
      const candidate = path.join(dir, path.basename(safeName));
      if (fs.existsSync(candidate)) return candidate;
    }
    return '';
  };

  if (raw.startsWith('/uploads/')) {
    const local = tryFile(raw.split('/uploads/')[1]);
    if (local) return local;
  }
  if (raw.includes('/uploads/')) {
    const local = tryFile(raw.split('/uploads/').pop());
    if (local) return local;
  }
  if (fs.existsSync(raw)) return raw;
  return '';
};

const amountInWords = (amount) => {
  const n = Math.floor(Math.max(0, toNumber(amount, 0)));
  if (n === 0) return 'Zero Rupees Only';
  return `${n.toLocaleString('en-IN')} Rupees Only`;
};

const drawHeader = (doc, settings, quotation) => {
  const pageWidth = doc.page.width;
  const left = 44;
  const right = pageWidth - 44;
  const logo = resolveUploadAsset(settings.logo_url);
  const logoW = Math.max(30, toNumber(settings.logo_width, 90));
  const logoH = Math.max(24, toNumber(settings.logo_height, 70));
  const align = clean(settings.header_alignment || 'left').toLowerCase();
  const lineColor = clean(settings.header_line_color || '#9F174D');

  let logoX = left;
  if (align === 'center') logoX = (pageWidth - logoW) / 2;
  if (align === 'right') logoX = right - logoW;

  if (logo && String(settings.show_logo || '1') !== '0') {
    try { doc.image(logo, logoX, 36, { width: logoW, height: logoH }); } catch (_e) {}
  }

  const companyBlockY = 36;
  const companyX = left;
  const companyW = right - left;
  doc.font('Helvetica-Bold').fontSize(Math.max(12, toNumber(settings.heading_font_size, 14))).fillColor('#111827')
    .text(clean(settings.company_name || 'SKUAS Pest Control Private Limited'), companyX, companyBlockY, { width: companyW, align });
  doc.font('Helvetica').fontSize(Math.max(9, toNumber(settings.body_font_size, 10))).fillColor('#374151')
    .text(clean(settings.company_address), companyX, doc.y + 2, { width: companyW, align });
  const contact = [clean(settings.phone), clean(settings.email), clean(settings.website)].filter(Boolean).join(' | ');
  if (contact) doc.text(contact, companyX, doc.y + 2, { width: companyW, align });
  if (String(settings.show_gstin || '1') !== '0' && clean(settings.gstin)) doc.text(`GSTIN: ${clean(settings.gstin)}`, companyX, doc.y + 2, { width: companyW, align });

  const topRightY = 40;
  const boxW = 220;
  doc.font('Helvetica').fontSize(10).fillColor('#111827')
    .text(`Date: ${formatDate(quotation.quotation_date)}`, right - boxW, topRightY, { width: boxW, align: 'right' })
    .text(`Ref: ${clean(quotation.quotation_number)}`, right - boxW, doc.y + 4, { width: boxW, align: 'right' });

  const lineY = Math.max(doc.y + 12, 120);
  doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(1).strokeColor(lineColor).stroke();
  doc.y = lineY + 12;
};

const drawTableRow = (doc, cols, y, h, values, opt = {}) => {
  doc.lineWidth(0.7).strokeColor(opt.borderColor || '#d1d5db');
  let x = cols[0].x;
  const rowW = cols[cols.length - 1].x + cols[cols.length - 1].w - cols[0].x;
  doc.rect(x, y, rowW, h).stroke();
  for (let i = 1; i < cols.length; i += 1) {
    doc.moveTo(cols[i].x, y).lineTo(cols[i].x, y + h).stroke();
  }
  cols.forEach((col, index) => {
    const val = String(values[index] ?? '');
    doc.font(opt.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opt.fontSize || 9).fillColor('#111827')
      .text(val, col.x + 4, y + 4, { width: col.w - 8, height: h - 8, ellipsis: true });
  });
};

const generateQuotationPdfBuffer = ({ quotation, items = [], templateSettings = {}, commonParagraphs = {} }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 34, bottom: 34, left: 44, right: 44 } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  drawHeader(doc, templateSettings, quotation);

  doc.font('Helvetica').fontSize(10).fillColor('#111827')
    .text('To,')
    .text(clean(quotation.customer_name || quotation.company_name || 'Customer'))
    .text(clean(quotation.address || '-'));

  doc.moveDown(0.6);
  const title = items.length > 1 ? 'Quotation for Pest Control Services' : `Quotation for ${clean(items[0]?.service_name || 'Pest Control Service')}`;
  doc.font('Helvetica-Bold').fontSize(Math.max(13, toNumber(templateSettings.heading_font_size, 14))).fillColor(clean(templateSettings.primary_color || '#9F174D')).text(title);

  const opening = clean(quotation.opening_paragraph || commonParagraphs.opening_paragraph);
  if (opening) {
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(Math.max(9, toNumber(templateSettings.body_font_size, 10))).fillColor('#111827').text(opening, { align: 'justify' });
  }

  doc.moveDown(0.8);
  const left = 44;
  const cols = [
    { x: left, w: 34 },
    { x: left + 34, w: 190 },
    { x: left + 224, w: 90 },
    { x: left + 314, w: 90 },
    { x: left + 404, w: 108 }
  ];

  let y = doc.y;
  drawTableRow(doc, cols, y, 24, ['#', 'Service', 'Frequency', 'GST %', 'Amount'], { bold: true, fontSize: Math.max(8, toNumber(templateSettings.table_font_size, 9)), borderColor: clean(templateSettings.border_color || '#cbd5e1') });
  y += 24;

  items.forEach((item, index) => {
    const rowH = 58;
    if (y + rowH > doc.page.height - 140) {
      doc.addPage();
      drawHeader(doc, templateSettings, quotation);
      y = doc.y;
      drawTableRow(doc, cols, y, 24, ['#', 'Service', 'Frequency', 'GST %', 'Amount'], { bold: true, fontSize: 8, borderColor: clean(templateSettings.border_color || '#cbd5e1') });
      y += 24;
    }

    const details = [
      clean(item.service_name),
      clean(item.about_pest),
      clean(item.what_we_do),
      `Contract: ${formatDate(item.contract_start_date || quotation.contract_start_date)} to ${formatDate(item.contract_end_date || quotation.contract_end_date)}`
    ].filter(Boolean).join('\n');

    drawTableRow(
      doc,
      cols,
      y,
      rowH,
      [
        String(index + 1),
        details,
        clean(item.frequency || '-'),
        `${toNumber(item.gst_percentage, 0)}%`,
        `₹ ${formatINR(item.total_amount)}`
      ],
      { fontSize: 8.5, borderColor: clean(templateSettings.border_color || '#cbd5e1') }
    );
    y += rowH;
  });

  const subtotal = toNumber(quotation.subtotal_without_gst, 0);
  const gstTotal = toNumber(quotation.gst_total, 0);
  const roundOff = toNumber(quotation.round_off, 0);
  const grand = toNumber(quotation.grand_total, subtotal + gstTotal + roundOff);

  y += 10;
  const sumX = 320;
  const sumW = 192;
  const line = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#111827').text(label, sumX, y, { width: 110 });
    doc.text(value, sumX + 110, y, { width: 82, align: 'right' });
    y += 18;
  };

  line('Subtotal', `₹ ${formatINR(subtotal)}`);
  line('GST', `₹ ${formatINR(gstTotal)}`);
  line('Round Off', `₹ ${formatINR(roundOff)}`);
  line('Grand Total', `₹ ${formatINR(grand)}`, true);

  doc.moveTo(sumX, y - 2).lineTo(sumX + sumW, y - 2).lineWidth(1).strokeColor('#d1d5db').stroke();
  y += 4;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f2937').text('Amount in words', sumX, y, { width: sumW });
  doc.font('Helvetica').fontSize(9).text(amountInWords(grand), sumX, y + 14, { width: sumW });

  let tailY = Math.max(y + 44, doc.y + 24);
  const blocks = [
    ['Payment Terms', clean(quotation.payment_terms || commonParagraphs.payment_terms)],
    ['Warranty', clean(quotation.warranty_note || commonParagraphs.warranty_paragraph)],
    ['Disclaimer', clean(quotation.disclaimer || commonParagraphs.disclaimer_paragraph)],
    ['Closing', clean(quotation.closing_paragraph || commonParagraphs.closing_paragraph || commonParagraphs.relationship_closing_paragraph)]
  ].filter(([, text]) => text);

  blocks.forEach(([titleText, body]) => {
    if (tailY > doc.page.height - 140) {
      doc.addPage();
      drawHeader(doc, templateSettings, quotation);
      tailY = doc.y;
    }
    doc.font('Helvetica-Bold').fontSize(10).fillColor(clean(templateSettings.primary_color || '#9F174D')).text(titleText, 44, tailY);
    tailY = doc.y + 2;
    doc.font('Helvetica').fontSize(9.4).fillColor('#111827').text(body, 44, tailY, { width: 520, align: 'justify' });
    tailY = doc.y + 8;
  });

  const signatureY = Math.min(doc.page.height - 110, Math.max(tailY + 6, doc.y + 8));
  doc.font('Helvetica').fontSize(10).fillColor('#111827').text('Yours Truly,', 44, signatureY);
  doc.text('For Skuas Pest Control Pvt Ltd', 44, doc.y + 2);

  if (String(templateSettings.show_signature || '1') !== '0') {
    const signature = resolveUploadAsset(templateSettings.signature_image_url);
    if (signature) {
      try { doc.image(signature, 44, doc.y + 2, { width: 90, height: 42 }); } catch (_e) {}
    }
  }
  doc.text(clean(quotation.sales_person || templateSettings.default_sales_person), 44, signatureY + 58);
  doc.text(clean(quotation.designation || templateSettings.default_designation), 44, doc.y + 1);
  doc.text(clean(quotation.mobile || templateSettings.default_mobile), 44, doc.y + 1);

  if (String(templateSettings.show_page_number || '1') !== '0') {
    const pageText = `Page ${doc.bufferedPageRange().count}`;
    doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(pageText, 44, doc.page.height - 30, { width: 520, align: 'right' });
  }

  doc.end();
});

module.exports = {
  generateQuotationPdfBuffer
};
