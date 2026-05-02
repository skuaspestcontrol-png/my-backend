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

const formatINR = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  const invoiceType = String(safeInvoice.invoiceType || '').trim().toUpperCase();
  const isNonGstInvoice = invoiceType === 'NON GST';

  const companyName = String(
    isNonGstInvoice
      ? (safeSettings.nonGstCompanyName || safeSettings.companyName || safeSettings.gstCompanyName || 'Your Company')
      : (safeSettings.gstCompanyName || safeSettings.companyName || 'Your Company')
  ).trim();

  const companyTagline = String(safeSettings.aboutTagline || '').trim();
  const companyAddress = isNonGstInvoice
    ? [
      String(safeSettings.nonGstBillingAddress || safeSettings.nonGstAddress || '').trim(),
      [safeSettings.nonGstCity, safeSettings.nonGstState, safeSettings.nonGstPincode]
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .join(', ')
    ].filter(Boolean).join('\n')
    : [
      String(safeSettings.gstBillingAddress || safeSettings.companyAddress || '').trim(),
      [safeSettings.gstCity || safeSettings.companyCity, safeSettings.gstState || safeSettings.companyState, safeSettings.gstPincode || safeSettings.companyPincode]
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .join(', ')
    ].filter(Boolean).join('\n');

  const companyPhone = String(
    isNonGstInvoice
      ? (safeSettings.nonGstPhone || '')
      : (safeSettings.gstPhone || safeSettings.companyMobile || '')
  ).trim();
  const companyEmail = String(
    isNonGstInvoice
      ? (safeSettings.nonGstEmail || '')
      : (safeSettings.gstEmail || safeSettings.companyEmail || '')
  ).trim();
  const companyGstin = isNonGstInvoice ? '' : String(safeSettings.companyGstNumber || '').trim();

  const customerName = String(
    safeInvoice.customerName || customer?.displayName || customer?.name || customer?.companyName || 'Customer'
  ).trim();
  const customerAddress = buildCustomerAddress(safeInvoice, customer);
  const servicePeriodText = buildServicePeriodText(safeInvoice);
  const logoUrl = String(
    isNonGstInvoice
      ? (safeSettings.nonGstCompanyLogoUrl || safeSettings.dashboardImageUrl || '')
      : (safeSettings.gstCompanyLogoUrl || safeSettings.dashboardImageUrl || '')
  ).trim();

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

  const salesperson = String(safeInvoice.salesperson || '-').trim() || '-';

  let resolvedIgst = isNonGstInvoice ? 0 : toNumber(safeInvoice.igstAmount, 0);
  let resolvedCgst = isNonGstInvoice ? 0 : toNumber(safeInvoice.cgstAmount, 0);
  let resolvedSgst = isNonGstInvoice ? 0 : toNumber(safeInvoice.sgstAmount, 0);
  if (!isNonGstInvoice && resolvedIgst === 0 && resolvedCgst === 0 && resolvedSgst === 0 && totalTax > 0) {
    const companyState = String(safeSettings.gstState || safeSettings.companyState || '').trim().toLowerCase();
    const supplyState = String(safeInvoice.placeOfSupply || '').trim().toLowerCase();
    const intraState = companyState && supplyState && supplyState.includes(companyState);
    if (intraState) {
      resolvedCgst = totalTax / 2;
      resolvedSgst = totalTax / 2;
    } else {
      resolvedIgst = totalTax;
    }
  }

  const paymentSplits = Array.isArray(safeInvoice.paymentSplits) ? safeInvoice.paymentSplits : [];

  const rowsHtml = itemRows.length > 0
    ? itemRows.map((row) => {
      return `
        <tr>
          <td class="cell cell-center">${row.index}</td>
          <td class="cell">
            <div class="item-name">${escapeHtml(row.name)}</div>
            ${row.description ? `<div class="item-meta">${escapeHtml(row.description)}</div>` : ''}
          </td>
          <td class="cell cell-center">${escapeHtml(row.sac || '-')}</td>
          <td class="cell cell-right">${escapeHtml(row.qty.toFixed(2))}</td>
          <td class="cell cell-right">${escapeHtml(formatINR(row.rate))}</td>
          <td class="cell cell-right">${escapeHtml(formatINR(row.total))}</td>
        </tr>
      `;
    }).join('')
    : `
      <tr>
        <td class="cell" colspan="6" style="text-align:center;color:#000000;">No items available</td>
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
      color: #000000;
      font-family: "Aptos", "Segoe UI", "Trebuchet MS", sans-serif;
    }
    .invoice-sheet {
      border: 1px solid #9e9e9e;
      overflow: hidden;
    }
    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      padding: 10px 12px;
      border-bottom: 1px solid #9e9e9e;
      align-items: start;
    }
    .left-company {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 10px;
      align-items: start;
    }
    .logo {
      width: 78px;
      height: 78px;
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
    .company-line {
      margin: 0;
      color: #000000;
      line-height: 1.4;
    }
    .company-name { font-size: 12px; font-weight: 700; }
    .company-tag { font-size: 10px; margin-top: 2px; }
    .company-text { font-size: 10px; margin-top: 2px; white-space: pre-line; }
    .invoice-meta-right {
      min-width: 230px;
      text-align: right;
      color: #000000;
    }
    .tax-title {
      margin: 0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .meta-line {
      margin: 3px 0 0;
      font-size: 10px;
      line-height: 1.35;
    }
    .party-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0;
      padding: 10px 12px;
      border-bottom: 1px solid #9e9e9e;
    }
    .party-card {
      padding: 0 8px 0 0;
      background: #ffffff;
    }
    .party-title {
      margin: 0;
      font-size: 10px;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: #000000;
      font-weight: 800;
    }
    .party-text {
      margin: 4px 0 0;
      font-size: 10px;
      line-height: 1.45;
      color: #000000;
      white-space: pre-line;
    }
    .items-wrap {
      padding: 10px 12px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #9e9e9e;
      table-layout: fixed;
    }
    .head {
      background: #f2f3f4;
      color: #000000;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 800;
      border: 1px solid #9e9e9e;
      padding: 5px 4px;
      text-align: center;
      vertical-align: middle;
    }
    .cell {
      border: 1px solid #9e9e9e;
      padding: 4px 4px;
      font-size: 8px;
      color: #000000;
      vertical-align: middle;
      overflow-wrap: anywhere;
    }
    .cell-right { text-align: right; }
    .cell-center { text-align: center; }
    .item-name { font-weight: 700; font-size: 8px; line-height: 1.3; }
    .item-meta { margin-top: 2px; color: #000000; font-size: 8px; line-height: 1.3; }
    .totals {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 10px;
      padding: 0 12px 12px;
      align-items: start;
    }
    .section-card {
      border: none;
      padding: 0;
      background: #ffffff;
      margin-bottom: 8px;
    }
    .section-card h4 {
      margin: 6px 0 0;
      font-size: 10px;
      color: #000000;
      font-weight: 700;
    }
    .section-card p {
      margin: 6px 0 0;
      font-size: 10px;
      line-height: 1.5;
      color: #000000;
      white-space: pre-line;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .meta-table td {
      padding: 4px 0;
      border-bottom: none;
      font-size: 10px;
      color: #000000;
    }
    .meta-table td:last-child {
      text-align: right;
      font-weight: 700;
    }
    .split-wrap {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .split-chip {
      border: 1px solid #9e9e9e;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 700;
      color: #000000;
      background: #f2f3f4;
    }
    .total-card {
      border: 1px solid #9e9e9e;
      overflow: hidden;
      background: #ffffff;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      border-bottom: 1px solid #9e9e9e;
      font-size: 10px;
      color: #000000;
    }
    .total-row:last-child { border-bottom: none; }
    .grand-row {
      background: #f2f3f4;
      font-size: 10px;
      font-weight: 800;
      color: #000000;
    }
    .footer {
      border-top: 1px solid #9e9e9e;
      padding: 10px 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      flex-wrap: wrap;
      background: #ffffff;
    }
    .footer-text {
      margin: 0;
      font-size: 10px;
      color: #000000;
      line-height: 1.5;
    }
    .footer-links {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .footer-link {
      font-size: 10px;
      color: #000000;
      text-decoration: none;
      font-weight: 700;
      border: 1px solid #9e9e9e;
      border-radius: 999px;
      padding: 5px 9px;
      background: #f2f3f4;
    }
    .subject-box {
      padding: 0 12px 8px;
      font-size: 10px;
      color: #000000;
    }
    .subject-box strong { color: #000000; }
    @media print {
      .invoice-sheet { border-radius: 0; }
    }
  </style>
</head>
<body>
  <main class="invoice-sheet">
    <header class="header">
      <div class="left-company">
        <div class="logo">
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Company logo" />` : ''}
        </div>
        <div>
          <p class="company-line company-name">${escapeHtml(companyName)}</p>
          ${companyTagline ? `<p class="company-line company-tag">${escapeHtml(companyTagline)}</p>` : ''}
          <p class="company-line company-text">${toMultilineHtml(companyAddress || '-')}</p>
          <p class="company-line company-text">Mobile: ${escapeHtml(companyPhone || '-')}</p>
          <p class="company-line company-text">E Mail Id: ${escapeHtml(companyEmail || '-')}</p>
          <p class="company-line company-text">Visit Us: ${escapeHtml(website || '-')}</p>
          <p class="company-line company-text">GST Details: ${escapeHtml(companyGstin || '')}</p>
        </div>
      </div>
      <div class="invoice-meta-right">
        <p class="tax-title">TAX Invoice</p>
        <p class="meta-line">Invoice #: ${escapeHtml(safeInvoice.invoiceNumber || '-')}</p>
        <p class="meta-line">Invoice Date: ${escapeHtml(formatDate(safeInvoice.date))}</p>
        <p class="meta-line">Salesperson: ${escapeHtml(salesperson)}</p>
      </div>
    </header>

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
            <th class="head" style="width:41%;">Service Description</th>
            <th class="head" style="width:12%;">HSN/SAC</th>
            <th class="head" style="width:10%;text-align:right;">Qty</th>
            <th class="head" style="width:15%;text-align:right;">Rate</th>
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
        <div class="total-row"><span>IGST</span><strong>${escapeHtml(formatINR(resolvedIgst))}</strong></div>
        <div class="total-row"><span>CGST</span><strong>${escapeHtml(formatINR(resolvedCgst))}</strong></div>
        <div class="total-row"><span>SGST</span><strong>${escapeHtml(formatINR(resolvedSgst))}</strong></div>
        <div class="total-row"><span>Withholding</span><strong>${escapeHtml(formatINR(-withholdingAmount))}</strong></div>
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
