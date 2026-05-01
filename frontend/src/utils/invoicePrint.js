import {
  defaultInvoiceFieldSettings,
  normalizeInvoiceFieldSettings,
  normalizeInvoiceTemplate
} from './invoicePreferences';

const templateThemes = {
  classic: {
    accent: '#d92d20',
    accentSoft: '#fef2f2',
    accentText: '#7f1d1d',
    border: '#f1d4d2',
    heading: '#111111',
    muted: '#6b7280',
    tableHead: '#fff5f5'
  },
  clean: {
    accent: '#9F174D',
    accentSoft: '#FDF2F8',
    accentText: '#831843',
    border: '#E5E7EB',
    heading: '#111827',
    muted: '#64748b',
    tableHead: '#FCE7F3'
  },
  executive: {
    accent: '#111827',
    accentSoft: '#f3f4f6',
    accentText: '#111827',
    border: '#d1d5db',
    heading: '#111827',
    muted: '#4b5563',
    tableHead: '#f9fafb'
  }
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatINR = (value) => `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value) => {
  if (!value) return '-';
  const raw = String(value).trim();
  const plain = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plain) return `${plain[3]}/${plain[2]}/${plain[1]}`;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const toMultilineHtml = (value) => escapeHtml(String(value || '').trim()).replace(/\n/g, '<br/>');

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const buildCompanyAddress = (settings = {}) => {
  const line1 = String(settings.companyAddress || '').trim();
  const line2 = [settings.companyCity, settings.companyState, settings.companyPincode]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join(', ');
  return [line1, line2].filter(Boolean).join('\n');
};

const buildCustomerAddress = (invoice = {}, customer = null) => {
  const direct = String(invoice.billingAddressText || '').trim();
  if (direct) return direct;

  if (!customer) return '';
  const customerName = customer.displayName || customer.name || customer.companyName || invoice.customerName || '';
  const line1 = customer.billingAddress || customer.billingStreet1 || '';
  const line2 = customer.billingStreet2 || '';
  const area = customer.billingArea || '';
  const statePin = [customer.billingState || customer.state || '', customer.billingPincode || customer.pincode || '']
    .filter(Boolean)
    .join(' ');
  return [customerName, line1, line2, area, statePin].filter(Boolean).join('\n');
};

const buildServicePeriodText = (invoice = {}) => {
  if (invoice.servicePeriod) return String(invoice.servicePeriod);
  if (invoice.servicePeriodStart || invoice.servicePeriodEnd) {
    const start = invoice.servicePeriodStart ? formatDate(invoice.servicePeriodStart) : 'NA';
    const end = invoice.servicePeriodEnd ? formatDate(invoice.servicePeriodEnd) : 'NA';
    return `${start} to ${end}`;
  }
  return '';
};

const buildItemRows = (invoice = {}) => {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  return items.map((line, index) => {
    const qty = toNumber(line.quantity, 0);
    const rate = toNumber(line.rate, 0);
    const tax = toNumber(line.taxRate, 0);
    const base = qty * rate;
    const lineTax = (base * tax) / 100;
    const total = base + lineTax;

    return {
      index: index + 1,
      name: String(line.itemName || '').trim() || `Item ${index + 1}`,
      description: String(line.description || '').trim(),
      sac: String(line.sac || '').trim(),
      qty,
      rate,
      tax,
      total
    };
  });
};

const withProtocol = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

export const buildInvoicePrintHtml = ({
  invoice,
  customer,
  settings,
  template,
  invoiceFieldSettings,
  autoPrint
}) => {
  const safeInvoice = invoice || {};
  const safeSettings = settings || {};
  const fieldConfig = {
    ...defaultInvoiceFieldSettings,
    ...normalizeInvoiceFieldSettings(invoiceFieldSettings)
  };
  const activeTemplate = normalizeInvoiceTemplate(template);
  const theme = templateThemes[activeTemplate] || templateThemes.classic;

  const companyName = String(safeSettings.companyName || 'Your Company').trim();
  const companyAddress = buildCompanyAddress(safeSettings);
  const customerName = String(
    safeInvoice.customerName || customer?.displayName || customer?.name || customer?.companyName || 'Customer'
  ).trim();
  const customerAddress = buildCustomerAddress(safeInvoice, customer);
  const servicePeriodText = buildServicePeriodText(safeInvoice);
  const logoUrl = String(safeSettings.gstCompanyLogoUrl || safeSettings.dashboardImageUrl || '').trim();

  const itemRows = buildItemRows(safeInvoice);
  const subtotal = toNumber(safeInvoice.subtotal, itemRows.reduce((sum, row) => sum + row.qty * row.rate, 0));
  const totalTax = toNumber(safeInvoice.totalTax, 0);
  const withholdingAmount = toNumber(safeInvoice.withholdingAmount, 0);
  const roundOff = toNumber(safeInvoice.roundOff, 0);
  const totalAmount = toNumber(safeInvoice.total ?? safeInvoice.amount, subtotal + totalTax - withholdingAmount + roundOff);
  const paymentReceived = toNumber(safeInvoice.paymentReceivedTotal, 0);
  const balanceDue = toNumber(safeInvoice.balanceDue, totalAmount - paymentReceived);

  const website = withProtocol(safeSettings.companyWebsite);
  const reviewLink = withProtocol(safeSettings.googleReviewLink);
  const showWebsite = fieldConfig.showCompanyWebsite && website;
  const showReviewLink = fieldConfig.showGoogleReviewLink && reviewLink;

  const contactLines = [
    safeSettings.companyEmail ? `Email: ${safeSettings.companyEmail}` : '',
    safeSettings.companyMobile ? `Mobile: ${safeSettings.companyMobile}` : ''
  ].filter(Boolean);

  const paymentSplits = Array.isArray(safeInvoice.paymentSplits) ? safeInvoice.paymentSplits : [];

  const rowsHtml = itemRows.length > 0
    ? itemRows.map((row) => {
      const descriptionParts = [row.description, row.sac ? `SAC: ${row.sac}` : ''].filter(Boolean);
      return `
        <tr>
          <td class="cell cell-center">${row.index}</td>
          <td class="cell">
            <div class="item-name">${escapeHtml(row.name)}</div>
            ${descriptionParts.length > 0 ? `<div class="item-meta">${escapeHtml(descriptionParts.join(' | '))}</div>` : ''}
          </td>
          <td class="cell cell-right">${escapeHtml(row.qty.toFixed(2))}</td>
          <td class="cell cell-right">${escapeHtml(formatINR(row.rate))}</td>
          <td class="cell cell-right">${escapeHtml(row.tax.toFixed(2))}%</td>
          <td class="cell cell-right">${escapeHtml(formatINR(row.total))}</td>
        </tr>
      `;
    }).join('')
    : `
      <tr>
        <td class="cell" colspan="6" style="text-align:center;color:${theme.muted};">No items available</td>
      </tr>
    `;

  const paymentSummaryHtml = fieldConfig.showPaymentSummary
    ? `
      <section class="section-card">
        <h4>Payment Summary</h4>
        <table class="meta-table">
          <tbody>
            <tr><td>Total Amount</td><td class="meta-value">${escapeHtml(formatINR(totalAmount))}</td></tr>
            <tr><td>Amount Received</td><td class="meta-value">${escapeHtml(formatINR(paymentReceived))}</td></tr>
            <tr><td>Balance Due</td><td class="meta-value">${escapeHtml(formatINR(Math.max(balanceDue, 0)))}</td></tr>
          </tbody>
        </table>
        ${paymentSplits.length > 0 ? `
          <div class="split-wrap">
            ${paymentSplits.map((split) => {
              const mode = split?.mode || 'Payment';
              const depositTo = split?.depositTo || 'Account';
              const amount = formatINR(toNumber(split?.amount, 0));
              return `<span class="split-chip">${escapeHtml(mode)} | ${escapeHtml(depositTo)} | ${escapeHtml(amount)}</span>`;
            }).join('')}
          </div>
        ` : ''}
      </section>
    `
    : '';

  const notesHtml = fieldConfig.showCustomerNotes && String(safeInvoice.customerNotes || '').trim()
    ? `
      <section class="section-card">
        <h4>Customer Notes</h4>
        <p>${toMultilineHtml(safeInvoice.customerNotes)}</p>
      </section>
    `
    : '';

  const termsHtml = fieldConfig.showTermsAndConditions && String(safeInvoice.termsAndConditions || '').trim()
    ? `
      <section class="section-card">
        <h4>Terms & Conditions</h4>
        <p>${toMultilineHtml(safeInvoice.termsAndConditions)}</p>
      </section>
    `
    : '';

  const maybeAutoPrintScript = autoPrint
    ? `
      <script>
        window.addEventListener('load', function () {
          setTimeout(function () {
            window.print();
          }, 220);
        });
      </script>
    `
    : '';

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${escapeHtml(safeInvoice.invoiceNumber || '')}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #ffffff;
      color: #111827;
      font-family: "Aptos", "Segoe UI", "Trebuchet MS", sans-serif;
    }
    .invoice-sheet {
      border: 1px solid ${theme.border};
      border-radius: 14px;
      overflow: hidden;
    }
    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      padding: 18px;
      background: linear-gradient(140deg, ${theme.accentSoft} 0%, #ffffff 75%);
      border-bottom: 1px solid ${theme.border};
    }
    .company-title {
      margin: 0;
      font-size: 26px;
      letter-spacing: -0.02em;
      color: ${theme.heading};
      font-weight: 800;
    }
    .company-sub {
      margin: 6px 0 0;
      font-size: 12px;
      color: ${theme.muted};
      line-height: 1.45;
    }
    .logo {
      width: 108px;
      height: 108px;
      border-radius: 14px;
      border: 1px solid ${theme.border};
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .invoice-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      border-top: 1px solid ${theme.border};
      border-bottom: 1px solid ${theme.border};
    }
    .meta-block {
      padding: 12px 16px;
      border-right: 1px solid ${theme.border};
    }
    .meta-block:last-child { border-right: none; }
    .meta-label {
      margin: 0;
      font-size: 11px;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: ${theme.muted};
      font-weight: 800;
    }
    .meta-value {
      margin: 6px 0 0;
      font-size: 15px;
      color: ${theme.heading};
      font-weight: 700;
    }
    .party-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid ${theme.border};
    }
    .party-card {
      border: 1px solid ${theme.border};
      border-radius: 10px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .party-title {
      margin: 0;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${theme.accentText};
      font-weight: 800;
    }
    .party-text {
      margin: 6px 0 0;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      white-space: pre-line;
    }
    .items-wrap {
      padding: 14px 16px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid ${theme.border};
      border-radius: 10px;
      overflow: hidden;
    }
    .head {
      background: ${theme.tableHead};
      color: #111827;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 800;
      border-bottom: 1px solid ${theme.border};
      padding: 10px 8px;
      text-align: left;
    }
    .cell {
      border-bottom: 1px solid ${theme.border};
      padding: 10px 8px;
      font-size: 12px;
      color: #111827;
      vertical-align: top;
    }
    .cell-right { text-align: right; }
    .cell-center { text-align: center; }
    .item-name { font-weight: 700; }
    .item-meta { margin-top: 3px; color: ${theme.muted}; font-size: 11px; }
    .totals {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 14px;
      padding: 0 16px 16px;
      align-items: start;
    }
    .section-card {
      border: 1px solid ${theme.border};
      border-radius: 10px;
      padding: 10px 12px;
      background: #ffffff;
      margin-bottom: 10px;
    }
    .section-card h4 {
      margin: 0;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: ${theme.accentText};
      font-weight: 800;
    }
    .section-card p {
      margin: 8px 0 0;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      white-space: pre-line;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .meta-table td {
      padding: 6px 0;
      border-bottom: 1px dashed ${theme.border};
      font-size: 12px;
      color: #1f2937;
    }
    .meta-table td:last-child {
      text-align: right;
      font-weight: 700;
    }
    .split-wrap {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .split-chip {
      border: 1px solid ${theme.border};
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 10px;
      font-weight: 700;
      color: #1f2937;
      background: ${theme.accentSoft};
    }
    .total-card {
      border: 1px solid ${theme.border};
      border-radius: 10px;
      overflow: hidden;
      background: #ffffff;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 12px;
      border-bottom: 1px solid ${theme.border};
      font-size: 12px;
      color: #1f2937;
    }
    .total-row:last-child { border-bottom: none; }
    .grand-row {
      background: ${theme.accentSoft};
      font-size: 14px;
      font-weight: 800;
      color: ${theme.heading};
    }
    .footer {
      border-top: 1px solid ${theme.border};
      padding: 12px 16px 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
      background: #ffffff;
    }
    .footer-text {
      margin: 0;
      font-size: 11px;
      color: ${theme.muted};
      line-height: 1.5;
    }
    .footer-links {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .footer-link {
      font-size: 11px;
      color: ${theme.accent};
      text-decoration: none;
      font-weight: 700;
      border: 1px solid ${theme.border};
      border-radius: 999px;
      padding: 6px 10px;
      background: ${theme.accentSoft};
    }
    .subject-box {
      padding: 0 16px 12px;
      font-size: 12px;
      color: #1f2937;
    }
    .subject-box strong { color: ${theme.heading}; }
    @media print {
      .invoice-sheet { border-radius: 0; }
    }
  </style>
</head>
<body>
  <main class="invoice-sheet">
    <header class="header">
      <div>
        <h1 class="company-title">${escapeHtml(companyName)}</h1>
        <p class="company-sub">
          ${toMultilineHtml(companyAddress || 'Address not configured in Settings')}
          ${fieldConfig.showCompanyGst && safeSettings.companyGstNumber ? `<br/>GSTIN: ${escapeHtml(safeSettings.companyGstNumber)}` : ''}
          ${contactLines.length > 0 ? `<br/>${escapeHtml(contactLines.join(' | '))}` : ''}
        </p>
      </div>
      <div class="logo">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Company logo" />` : `<span style="font-size:11px;color:${theme.muted};font-weight:700;">No Logo</span>`}
      </div>
    </header>

    <section class="invoice-meta">
      <div class="meta-block">
        <p class="meta-label">Invoice Number</p>
        <p class="meta-value">${escapeHtml(safeInvoice.invoiceNumber || '-')}</p>
      </div>
      <div class="meta-block">
        <p class="meta-label">Invoice Date</p>
        <p class="meta-value">${escapeHtml(formatDate(safeInvoice.date))}</p>
      </div>
      <div class="meta-block">
        <p class="meta-label">Due Date</p>
        <p class="meta-value">${escapeHtml(formatDate(safeInvoice.dueDate))}</p>
      </div>
      <div class="meta-block">
        <p class="meta-label">Status</p>
        <p class="meta-value">${escapeHtml(String(safeInvoice.status || 'DRAFT').toUpperCase())}</p>
      </div>
    </section>

    <section class="party-grid">
      <div class="party-card">
        <p class="party-title">Bill To</p>
        <p class="party-text">${toMultilineHtml(customerAddress || customerName)}</p>
      </div>
      <div class="party-card">
        <p class="party-title">Invoice Details</p>
        <p class="party-text">
          Customer: ${escapeHtml(customerName)}
          <br/>Terms: ${escapeHtml(safeInvoice.terms || '-')}
          <br/>Place of Supply: ${escapeHtml(safeInvoice.placeOfSupply || '-')}
          ${fieldConfig.showServicePeriod && servicePeriodText ? `<br/>Service Period: ${escapeHtml(servicePeriodText)}` : ''}
        </p>
      </div>
    </section>

    ${fieldConfig.showSubject && String(safeInvoice.subject || '').trim()
      ? `<section class="subject-box"><strong>Subject:</strong> ${escapeHtml(safeInvoice.subject)}</section>`
      : ''}

    <section class="items-wrap">
      <table class="items-table">
        <thead>
          <tr>
            <th class="head" style="width:7%;">#</th>
            <th class="head" style="width:45%;">Item</th>
            <th class="head" style="width:10%;text-align:right;">Qty</th>
            <th class="head" style="width:13%;text-align:right;">Rate</th>
            <th class="head" style="width:10%;text-align:right;">Tax</th>
            <th class="head" style="width:15%;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </section>

    <section class="totals">
      <div>
        ${paymentSummaryHtml}
        ${notesHtml}
        ${termsHtml}
      </div>
      <div class="total-card">
        <div class="total-row"><span>Sub Total</span><strong>${escapeHtml(formatINR(subtotal))}</strong></div>
        <div class="total-row"><span>Total Tax</span><strong>${escapeHtml(formatINR(totalTax))}</strong></div>
        <div class="total-row"><span>Withholding</span><strong>- ${escapeHtml(formatINR(withholdingAmount))}</strong></div>
        <div class="total-row"><span>Round Off</span><strong>${escapeHtml(formatINR(roundOff))}</strong></div>
        <div class="total-row grand-row"><span>Grand Total</span><strong>${escapeHtml(formatINR(totalAmount))}</strong></div>
        <div class="total-row"><span>Balance Due</span><strong>${escapeHtml(formatINR(Math.max(balanceDue, 0)))}</strong></div>
      </div>
    </section>

    <footer class="footer">
      <p class="footer-text">
        This is a system generated invoice.
        ${showWebsite ? `<br/>Website: ${escapeHtml(website)}` : ''}
      </p>
      <div class="footer-links">
        ${showWebsite ? `<a class="footer-link" href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">Visit Website</a>` : ''}
        ${showReviewLink ? `<a class="footer-link" href="${escapeHtml(reviewLink)}" target="_blank" rel="noopener noreferrer">Leave Google Review</a>` : ''}
      </div>
    </footer>
  </main>
  ${maybeAutoPrintScript}
</body>
</html>
  `;
};
