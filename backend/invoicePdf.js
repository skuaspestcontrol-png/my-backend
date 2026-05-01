const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const BRAND = {
  primary: '#0f766e',
  accent: '#2563eb',
  text: '#111827',
  muted: '#374151',
  border: '#E5E7EB',
  soft: '#F9FAFB',
  success: '#16A34A',
  warning: '#F97316',
  danger: '#EF4444'
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clean = (value) => String(value ?? '').trim();

const formatINR = (value, currencySymbol = '₹') => {
  const n = toNumber(value, 0);
  return `${currencySymbol}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value, format = 'DD/MM/YYYY') => {
  const raw = clean(value);
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  if (String(format || '').toUpperCase() === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
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

const safeImage = (doc, imgPath, x, y, fit) => {
  if (!imgPath) return false;
  try {
    doc.image(imgPath, x, y, { fit, align: 'center', valign: 'center' });
    return true;
  } catch (_error) {
    return false;
  }
};

const drawRoundedRect = (doc, x, y, w, h, radius = 8, borderColor = BRAND.border, fillColor = null, lineWidth = 1) => {
  doc.save();
  doc.lineWidth(lineWidth);
  if (fillColor) {
    doc.fillColor(fillColor).roundedRect(x, y, w, h, radius).fill();
  }
  doc.strokeColor(borderColor).roundedRect(x, y, w, h, radius).stroke();
  doc.restore();
};

const textCell = (doc, text, x, y, w, h, options = {}) => {
  const {
    size = 9,
    font = 'Helvetica',
    color = BRAND.text,
    align = 'left',
    padX = 6,
    padY = 5,
    lineGap = 1
  } = options;
  doc.font(font).fontSize(size).fillColor(color).text(String(text || ''), x + padX, y + padY, {
    width: w - (padX * 2),
    height: h - (padY * 2),
    align,
    lineGap
  });
};

const deriveTaxMode = ({ invoiceType, placeOfSupply, companyState }) => {
  const nonGst = clean(invoiceType).toUpperCase() === 'NON GST';
  if (nonGst) return 'NON_GST';
  if (!clean(placeOfSupply) || !clean(companyState)) return 'IGST';
  return clean(placeOfSupply).toLowerCase() === clean(companyState).toLowerCase() ? 'CGST_SGST' : 'IGST';
};

const resolveCompany = (settings = {}, invoice = {}) => {
  const isNonGst = clean(invoice.invoiceType).toUpperCase() === 'NON GST';
  const invoiceTemplateSettings = settings.invoiceTemplateSettings && typeof settings.invoiceTemplateSettings === 'object'
    ? settings.invoiceTemplateSettings
    : {};

  const company = {
    name: clean((isNonGst ? settings.nonGstCompanyName : settings.gstCompanyName) || settings.companyName) || 'SKUAS Pest Control',
    tagline: clean(settings.aboutTagline),
    address: clean((isNonGst ? settings.nonGstBillingAddress : settings.gstBillingAddress) || settings.companyAddress),
    city: clean((isNonGst ? settings.nonGstCity : settings.gstCity) || settings.companyCity),
    state: clean((isNonGst ? settings.nonGstState : settings.gstState) || settings.companyState),
    pincode: clean((isNonGst ? settings.nonGstPincode : settings.gstPincode) || settings.companyPincode),
    phone: clean((isNonGst ? settings.nonGstPhone : settings.gstPhone) || settings.companyMobile),
    email: clean((isNonGst ? settings.nonGstEmail : settings.gstEmail) || settings.companyEmail),
    website: clean(settings.companyWebsite),
    gst: clean(settings.companyGstNumber || settings.gstRegistrationNumber),
    logo: parseLocalAsset((isNonGst ? settings.nonGstCompanyLogoUrl : settings.gstCompanyLogoUrl) || settings.dashboardImageUrl),
    signature: parseLocalAsset(settings.gstDigitalSignatureUrl || invoiceTemplateSettings.signatureUrl || ''),
    bankName: clean((isNonGst ? settings.nonGstBankName : settings.gstBankName) || invoiceTemplateSettings.bankName),
    bankAccountNumber: clean((isNonGst ? settings.nonGstBankAccountNumber : settings.gstBankAccountNumber) || invoiceTemplateSettings.accountNumber),
    bankIfsc: clean((isNonGst ? settings.nonGstBankIfsc : settings.gstBankIfsc) || invoiceTemplateSettings.ifscCode),
    bankBranch: clean((isNonGst ? settings.nonGstBankBranch : settings.gstBankBranch)),
    bankUpiId: clean((isNonGst ? settings.nonGstBankUpiId : settings.gstBankUpiId) || invoiceTemplateSettings.upiId),
    qrCode: parseLocalAsset((isNonGst ? settings.nonGstBankQrUrl : settings.gstBankQrUrl) || invoiceTemplateSettings.qrCodeUrl || ''),
    termsGst: clean(settings.gstTermsAndConditions || invoiceTemplateSettings.termsConditions),
    termsNonGst: clean(settings.nonGstTermsAndConditions || invoiceTemplateSettings.termsConditions),
    footerText: clean(invoiceTemplateSettings.footerText || 'This is a computer-generated invoice.'),
    thankYouText: clean(invoiceTemplateSettings.thankYouText || 'Thank you for your business')
  };

  company.compactAddress = [
    company.address,
    [company.city, company.state, company.pincode].filter(Boolean).join(', ')
  ].filter(Boolean).join(', ');

  return company;
};

const resolveBillTo = (invoice = {}, customer = {}) => {
  const title = clean(customer.billingAttention)
    || clean(invoice.customerName)
    || clean(customer.displayName)
    || clean(customer.companyName)
    || clean(customer.name)
    || 'Customer';

  const lines = [
    clean(customer.billingAddress || customer.billingStreet1 || invoice.billingAddressText),
    clean(customer.billingStreet2),
    clean(customer.billingArea),
    [clean(customer.billingCity || customer.city), clean(customer.billingState || customer.state), clean(customer.billingPincode || customer.pincode)]
      .filter(Boolean)
      .join(', ')
  ].filter(Boolean);

  return {
    title,
    companyName: clean(customer.companyName),
    lines,
    gst: clean(customer.gstNumber),
    mobile: clean(customer.mobileNumber || customer.workPhone),
    whatsapp: clean(customer.whatsappNumber),
    email: clean(customer.emailId || customer.email)
  };
};

const resolveServiceLocation = (invoice = {}, customer = {}) => {
  const lines = [
    clean(invoice.serviceAddress || customer.shippingAddress || customer.shippingStreet1 || customer.billingAddress),
    clean(invoice.serviceArea || customer.shippingArea || customer.billingArea),
    [clean(invoice.serviceCity || customer.shippingCity || customer.city), clean(invoice.serviceState || customer.shippingState || customer.state), clean(invoice.servicePincode || customer.shippingPincode || customer.pincode)]
      .filter(Boolean)
      .join(', ')
  ].filter(Boolean);

  return {
    contactPerson: clean(invoice.contactPerson || customer.shippingAttention || customer.billingAttention),
    lines
  };
};

const invoiceItems = (invoice = {}) => {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  return items.map((item, index) => {
    const qty = toNumber(item.quantity, 0);
    const rate = toNumber(item.rate, 0);
    const discount = toNumber(item.discount, 0);
    const lineTaxRate = toNumber(item.taxRate, 0);
    const rawAmount = toNumber(item.amount, qty * rate);
    const taxable = Math.max(0, rawAmount - discount);
    const taxAmount = toNumber(item.taxAmount, (taxable * lineTaxRate) / 100);
    return {
      srNo: index + 1,
      description: clean(item.itemName || item.name) || `Service ${index + 1}`,
      longDescription: clean(item.description),
      sac: clean(item.sac || item.hsnSac || item.hsn),
      qty,
      rate,
      discount,
      lineTaxRate,
      taxable,
      taxAmount,
      totalAmount: taxable + taxAmount
    };
  });
};

const getServiceDetails = (invoice = {}) => {
  return {
    serviceType: clean(invoice.serviceType || invoice.type || invoice.subject),
    pestIssue: clean(invoice.pestIssue || invoice.issueType),
    contractType: clean(invoice.contractType || invoice.planType),
    frequency: clean(invoice.serviceFrequency || invoice.frequency),
    serviceDate: clean(invoice.serviceDate || invoice.date),
    technician: clean(invoice.technicianName),
    salesPerson: clean(invoice.salesperson),
    leadSource: clean(invoice.leadSource)
  };
};

const getTotals = (invoice = {}, rows = []) => {
  const subtotalCalc = rows.reduce((sum, r) => sum + r.taxable, 0);
  const taxCalc = rows.reduce((sum, r) => sum + r.taxAmount, 0);
  const subtotal = toNumber(invoice.subtotal, subtotalCalc);
  const totalTax = toNumber(invoice.totalTax, taxCalc);
  const discount = toNumber(invoice.totalDiscount, Math.max(0, rows.reduce((sum, r) => sum + r.discount, 0)));
  const taxableAmount = Math.max(0, subtotal - discount);
  const roundOff = toNumber(invoice.roundOff, 0);
  const grandTotal = toNumber(invoice.total, taxableAmount + totalTax + roundOff);
  const amountPaid = toNumber(invoice.amountPaid, Math.max(0, grandTotal - toNumber(invoice.balanceDue, grandTotal)));
  const balanceDue = toNumber(invoice.balanceDue, Math.max(0, grandTotal - amountPaid));
  return { subtotal, discount, taxableAmount, totalTax, roundOff, grandTotal, amountPaid, balanceDue };
};

const pageBottomY = (doc) => doc.page.height - doc.page.margins.bottom;

const generateInvoicePdfBuffer = async ({ invoice = {}, customer = {}, settings = {} }) => {
  const templateSettings = settings.invoiceTemplateSettings && typeof settings.invoiceTemplateSettings === 'object'
    ? settings.invoiceTemplateSettings
    : {};

  const showFields = {
    showCompanyGst: settings?.invoiceFieldSettings?.showCompanyGst !== false,
    showCompanyWebsite: settings?.invoiceFieldSettings?.showCompanyWebsite !== false,
    showSubject: settings?.invoiceFieldSettings?.showSubject !== false,
    showServicePeriod: settings?.invoiceFieldSettings?.showServicePeriod !== false,
    showTermsAndConditions: settings?.invoiceFieldSettings?.showTermsAndConditions !== false,
    showCustomerNotes: settings?.invoiceFieldSettings?.showCustomerNotes !== false,
    showPaymentSummary: settings?.invoiceFieldSettings?.showPaymentSummary !== false,
    showAmountInWords: templateSettings.showAmountInWords !== false,
    showBankDetails: templateSettings.showBankDetails !== false,
    showQr: templateSettings.showQrCode === true,
    showSignature: templateSettings.showSignature !== false,
    showServiceLocation: templateSettings.showServiceLocation !== false,
    showContractDetails: templateSettings.showContractDetails !== false,
    showTechnician: templateSettings.showTechnician !== false,
    showSalesPerson: templateSettings.showSalesPerson !== false,
    showHsnSac: templateSettings.showHsnSac !== false,
    showDiscount: templateSettings.showDiscount === true,
    showTax: templateSettings.showTax !== false,
    showAmountPaid: templateSettings.showAmountPaid !== false,
    showBalanceDue: templateSettings.showBalanceDue !== false
  };

  const company = resolveCompany(settings, invoice);
  const billTo = resolveBillTo(invoice, customer);
  const serviceLocation = resolveServiceLocation(invoice, customer);
  const details = getServiceDetails(invoice);
  const rows = invoiceItems(invoice);
  const totals = getTotals(invoice, rows);

  const taxMode = deriveTaxMode({
    invoiceType: invoice.invoiceType,
    placeOfSupply: invoice.placeOfSupply,
    companyState: company.state
  });

  const currencySymbol = clean(templateSettings.currencySymbol) || '₹';
  const dateFormat = clean(templateSettings.dateFormat) || 'DD/MM/YYYY';
  const isPaid = totals.balanceDue <= 0;
  const isPartial = totals.amountPaid > 0 && totals.balanceDue > 0;
  const isOverdue = !isPaid && clean(invoice.dueDate) && new Date(invoice.dueDate).getTime() < Date.now();
  const paymentStatus = isPaid ? 'Paid' : (isOverdue ? 'Overdue' : (isPartial ? 'Partial' : 'Pending'));
  const statusTone = isPaid
    ? { bg: '#DCFCE7', fg: BRAND.success }
    : isOverdue
      ? { bg: '#FEE2E2', fg: BRAND.danger }
      : { bg: '#FFEDD5', fg: BRAND.warning };

  const termsText = clean(
    templateSettings.termsConditions
    || (taxMode === 'NON_GST' ? company.termsNonGst : company.termsGst)
    || 'Payment due as per invoice terms. Service warranty applicable as agreed.'
  );

  const noteText = clean(invoice.customerNotes || settings.customerNotesDefault || '');

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margin: 28,
    bufferPages: true,
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

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentW = right - left;
    let y = doc.page.margins.top;

    const drawFooter = (pageNumber, totalPages) => {
      const footerY = pageBottomY(doc) - 34;
      doc.save();
      doc.moveTo(left, footerY - 8).lineTo(right, footerY - 8).lineWidth(0.8).strokeColor(BRAND.border).stroke();
      doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.muted).text(company.thankYouText, left, footerY, { width: contentW * 0.6 });
      doc.text(company.footerText || 'This is a computer-generated invoice.', left, footerY + 11, { width: contentW * 0.7 });
      doc.text(`Page ${pageNumber} of ${totalPages}`, right - 92, footerY + 11, { width: 92, align: 'right' });
      doc.restore();
    };

    const ensureSpace = (h) => {
      const reserveFooter = 46;
      if (y + h <= pageBottomY(doc) - reserveFooter) return;
      doc.addPage();
      y = doc.page.margins.top;
      drawHeaderLine();
      drawItemsHeader();
    };

    const drawHeaderLine = () => {
      doc.save();
      doc.moveTo(left, y).lineTo(right, y).lineWidth(2).strokeColor(clean(templateSettings.primaryColor) || BRAND.primary).stroke();
      doc.restore();
      y += 8;
    };

    drawHeaderLine();

    const logoW = 72;
    const logoH = 58;
    const leftColW = contentW * 0.58;
    const rightColW = contentW - leftColW;

    if (templateSettings.showLogo !== false) {
      drawRoundedRect(doc, left, y, logoW, logoH, 8, BRAND.border, '#fff', 1);
      const ok = safeImage(doc, company.logo, left + 4, y + 4, [logoW - 8, logoH - 8]);
      if (!ok) textCell(doc, 'LOGO', left, y, logoW, logoH, { size: 9, color: BRAND.muted, align: 'center' });
    }

    const companyX = left + (templateSettings.showLogo === false ? 0 : logoW + 10);
    doc.font('Helvetica-Bold').fontSize(17).fillColor(BRAND.text).text(company.name, companyX, y + 1, { width: leftColW - (companyX - left) });

    let companyInfoY = y + 22;
    if (templateSettings.showTagline !== false && company.tagline) {
      doc.font('Helvetica').fontSize(9.5).fillColor(BRAND.muted).text(company.tagline, companyX, companyInfoY, { width: leftColW - (companyX - left) });
      companyInfoY = doc.y + 2;
    }

    const companyLines = [
      company.compactAddress,
      [company.phone ? `Phone: ${company.phone}` : '', company.email ? `Email: ${company.email}` : ''].filter(Boolean).join(' | '),
      showFields.showCompanyWebsite && company.website ? `Website: ${company.website}` : '',
      showFields.showCompanyGst && company.gst ? `GSTIN: ${company.gst}` : ''
    ].filter(Boolean);

    companyLines.forEach((line) => {
      doc.font('Helvetica').fontSize(8.7).fillColor(BRAND.text).text(line, companyX, companyInfoY, { width: leftColW - (companyX - left) });
      companyInfoY = doc.y + 1;
    });

    const invBoxX = left + leftColW + 8;
    const invBoxW = rightColW - 8;
    drawRoundedRect(doc, invBoxX, y, invBoxW, 92, 10, BRAND.border, '#fff', 1);

    doc.font('Helvetica-Bold').fontSize(20).fillColor(clean(templateSettings.accentColor) || BRAND.accent).text('INVOICE', invBoxX + 10, y + 8, { width: invBoxW - 20, align: 'right' });

    const hdrRows = [
      ['Invoice #', clean(invoice.invoiceNumber) || '-'],
      ['Invoice Date', formatDate(invoice.date, dateFormat)],
      ['Due Date', formatDate(invoice.dueDate, dateFormat)]
    ];

    let my = y + 34;
    hdrRows.forEach(([k, v]) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(BRAND.muted).text(k, invBoxX + 10, my, { width: 72 });
      doc.font('Helvetica').fontSize(8.7).fillColor(BRAND.text).text(`: ${v}`, invBoxX + 80, my, { width: invBoxW - 90 });
      my += 13;
    });

    const badgeW = 74;
    drawRoundedRect(doc, invBoxX + invBoxW - badgeW - 10, y + 68, badgeW, 18, 9, statusTone.bg, statusTone.bg, 0);
    textCell(doc, paymentStatus.toUpperCase(), invBoxX + invBoxW - badgeW - 10, y + 68, badgeW, 18, {
      size: 8,
      font: 'Helvetica-Bold',
      color: statusTone.fg,
      align: 'center',
      padY: 4
    });

    y += 104;

    const cardGap = 8;
    const cardW = (contentW - cardGap) / 2;
    const billCardH = 118;

    drawRoundedRect(doc, left, y, cardW, billCardH, 10, BRAND.border, '#fff', 1);
    textCell(doc, 'BILL TO', left + 1, y + 1, cardW - 2, 16, { size: 9, font: 'Helvetica-Bold', color: BRAND.primary });

    const billLines = [
      billTo.title,
      billTo.companyName,
      ...billTo.lines,
      billTo.mobile ? `Phone: ${billTo.mobile}` : '',
      billTo.whatsapp ? `WhatsApp: ${billTo.whatsapp}` : '',
      billTo.email ? `Email: ${billTo.email}` : '',
      templateSettings.showCustomerGst !== false && billTo.gst ? `GSTIN: ${billTo.gst}` : ''
    ].filter(Boolean);

    textCell(doc, billLines.join('\n'), left + 2, y + 16, cardW - 4, billCardH - 18, { size: 8.5, lineGap: 1 });

    if (showFields.showServiceLocation) {
      drawRoundedRect(doc, left + cardW + cardGap, y, cardW, billCardH, 10, BRAND.border, '#fff', 1);
      textCell(doc, 'SERVICE LOCATION', left + cardW + cardGap + 1, y + 1, cardW - 2, 16, { size: 9, font: 'Helvetica-Bold', color: BRAND.primary });
      const locLines = [
        ...serviceLocation.lines,
        serviceLocation.contactPerson ? `Contact: ${serviceLocation.contactPerson}` : ''
      ].filter(Boolean);
      textCell(doc, locLines.length ? locLines.join('\n') : '-', left + cardW + cardGap + 2, y + 16, cardW - 4, billCardH - 18, { size: 8.5, lineGap: 1 });
    }

    y += billCardH + 8;

    if (showFields.showContractDetails) {
      const detailH = 56;
      ensureSpace(detailH + 4);
      drawRoundedRect(doc, left, y, contentW, detailH, 10, BRAND.border, BRAND.soft, 1);

      const detailCells = [
        ['Service Type', details.serviceType || '-'],
        ['Pest Issue', details.pestIssue || '-'],
        ['Contract Type', details.contractType || '-'],
        ['Frequency', details.frequency || '-'],
        ['Service Date', details.serviceDate ? formatDate(details.serviceDate, dateFormat) : '-'],
        [showFields.showTechnician ? 'Technician' : 'Sales Person', showFields.showTechnician ? (details.technician || '-') : (details.salesPerson || '-')],
        [showFields.showSalesPerson ? 'Sales Person' : 'Lead Source', showFields.showSalesPerson ? (details.salesPerson || '-') : (details.leadSource || '-')],
        ['Lead Source', details.leadSource || '-']
      ];

      const cols = 4;
      const cw = contentW / cols;
      detailCells.forEach(([k, v], idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const cx = left + (col * cw);
        const cy = y + (row * 26);
        textCell(doc, k, cx, cy, cw, 12, { size: 7.6, font: 'Helvetica-Bold', color: BRAND.muted, padY: 3 });
        textCell(doc, v, cx, cy + 10, cw, 14, { size: 8.5, font: 'Helvetica' });
      });

      y += detailH + 8;
    }

    const tableX = left;
    const tableW = contentW;

    const columns = [
      { key: 'srNo', label: 'S.No', width: 32, align: 'center' },
      { key: 'description', label: 'Description / Service Name', width: showFields.showHsnSac ? 178 : 212, align: 'left' },
      ...(showFields.showHsnSac ? [{ key: 'sac', label: 'HSN/SAC', width: 58, align: 'center' }] : []),
      { key: 'qty', label: 'Qty', width: 40, align: 'right' },
      { key: 'rate', label: 'Unit Price', width: 62, align: 'right' },
      ...(showFields.showDiscount ? [{ key: 'discount', label: 'Discount', width: 58, align: 'right' }] : []),
      ...(showFields.showTax ? [
        { key: 'taxRate', label: 'Tax %', width: 44, align: 'right' },
        { key: 'taxAmount', label: 'Tax Amt', width: 62, align: 'right' }
      ] : []),
      { key: 'amount', label: 'Amount', width: 74, align: 'right' }
    ];

    const usedW = columns.reduce((sum, c) => sum + c.width, 0);
    const adjust = tableW - usedW;
    if (adjust !== 0) columns[1].width += adjust;

    const drawItemsHeader = () => {
      let cx = tableX;
      columns.forEach((c) => {
        drawRoundedRect(doc, cx, y, c.width, 22, 0, BRAND.border, BRAND.soft, 1);
        textCell(doc, c.label, cx, y, c.width, 22, { size: 8, font: 'Helvetica-Bold', align: c.align, color: '#1f2937', padY: 6 });
        cx += c.width;
      });
      y += 22;
    };

    drawItemsHeader();

    const safeRows = rows.length ? rows : [{ srNo: 1, description: 'General Service', longDescription: '', sac: '-', qty: 1, rate: 0, discount: 0, lineTaxRate: 0, taxAmount: 0, totalAmount: 0 }];

    safeRows.forEach((row) => {
      const mainDesc = row.longDescription ? `${row.description}\n${row.longDescription}` : row.description;
      const descCol = columns.find((c) => c.key === 'description');
      const textH = doc.heightOfString(mainDesc || '-', { width: (descCol?.width || 160) - 10, lineGap: 1 });
      const rowH = Math.max(24, textH + 10);
      ensureSpace(rowH + 2);

      const data = {
        srNo: String(row.srNo),
        description: mainDesc || '-',
        sac: row.sac || '-',
        qty: row.qty.toFixed(2),
        rate: formatINR(row.rate, currencySymbol),
        discount: formatINR(row.discount, currencySymbol),
        taxRate: `${row.lineTaxRate.toFixed(2)}%`,
        taxAmount: formatINR(row.taxAmount, currencySymbol),
        amount: formatINR(row.totalAmount, currencySymbol)
      };

      let cx = tableX;
      columns.forEach((c) => {
        drawRoundedRect(doc, cx, y, c.width, rowH, 0, BRAND.border, '#fff', 1);
        textCell(doc, data[c.key], cx, y, c.width, rowH, {
          size: c.key === 'description' ? 8.6 : 8.2,
          align: c.align,
          font: c.key === 'description' ? 'Helvetica-Bold' : 'Helvetica'
        });
        cx += c.width;
      });
      y += rowH;
    });

    y += 8;

    const leftW = Math.floor(contentW * 0.56);
    const rightW = contentW - leftW - 8;

    const wordsLines = [];
    if (showFields.showAmountInWords) wordsLines.push(`Amount in Words: ${amountToWords(totals.grandTotal)}`);

    if (showFields.showBankDetails) {
      wordsLines.push('', 'Payment Details:');
      wordsLines.push(`Bank Name: ${company.bankName || '-'}`);
      wordsLines.push(`Account Holder: ${clean(templateSettings.accountHolderName || company.name) || '-'}`);
      wordsLines.push(`Account Number: ${company.bankAccountNumber || '-'}`);
      wordsLines.push(`IFSC Code: ${company.bankIfsc || '-'}`);
      if (company.bankUpiId) wordsLines.push(`UPI ID: ${company.bankUpiId}`);
      if (clean(templateSettings.paymentInstruction)) wordsLines.push(`Note: ${clean(templateSettings.paymentInstruction)}`);
    }

    if (showFields.showTermsAndConditions) {
      wordsLines.push('', 'Terms & Conditions:');
      wordsLines.push(...termsText.split(/\n+/).filter(Boolean));
      const warranty = clean(templateSettings.warrantyNote || 'Service warranty is applicable as per agreed terms.');
      const disclaimer = clean(templateSettings.serviceDisclaimer || 'Chemical treatment effectiveness depends on site hygiene and maintenance.');
      wordsLines.push(warranty);
      wordsLines.push(disclaimer);
    }

    if (showFields.showCustomerNotes && noteText) {
      wordsLines.push('', `Customer Note: ${noteText}`);
    }

    const leftText = wordsLines.join('\n');
    const leftH = Math.max(138, doc.heightOfString(leftText || '-', { width: leftW - 14, lineGap: 1 }) + 14);

    const summaryRows = [
      ['Subtotal', formatINR(totals.subtotal, currencySymbol)],
      ['Discount', formatINR(totals.discount, currencySymbol)],
      ['Taxable Amount', formatINR(totals.taxableAmount, currencySymbol)]
    ];

    if (showFields.showTax) {
      if (taxMode === 'CGST_SGST') {
        const half = totals.totalTax / 2;
        summaryRows.push(['CGST', formatINR(half, currencySymbol)]);
        summaryRows.push(['SGST', formatINR(half, currencySymbol)]);
      } else if (taxMode === 'IGST') {
        summaryRows.push(['IGST', formatINR(totals.totalTax, currencySymbol)]);
      } else {
        summaryRows.push(['Tax', formatINR(0, currencySymbol)]);
      }
    }

    summaryRows.push(['Round Off', formatINR(totals.roundOff, currencySymbol)]);
    summaryRows.push(['Grand Total', formatINR(totals.grandTotal, currencySymbol)]);
    if (showFields.showAmountPaid) summaryRows.push(['Amount Paid', formatINR(totals.amountPaid, currencySymbol)]);
    if (showFields.showBalanceDue) summaryRows.push(['Balance Due', formatINR(totals.balanceDue, currencySymbol)]);

    const summaryH = Math.max(leftH, summaryRows.length * 22 + 70);
    ensureSpace(summaryH + 8);

    drawRoundedRect(doc, left, y, leftW, leftH, 10, BRAND.border, '#fff', 1);
    textCell(doc, leftText || '-', left + 2, y + 2, leftW - 4, leftH - 4, { size: 8.5, lineGap: 1 });

    drawRoundedRect(doc, left + leftW + 8, y, rightW, summaryH, 10, BRAND.border, '#fff', 1);

    let sy = y + 8;
    summaryRows.forEach(([k, v]) => {
      const isGrand = k === 'Grand Total';
      drawRoundedRect(doc, left + leftW + 16, sy, rightW - 16, 20, 0, BRAND.border, isGrand ? '#ECFDF5' : '#fff', 1);
      textCell(doc, k, left + leftW + 20, sy, rightW * 0.54, 20, { size: 8.7, font: isGrand ? 'Helvetica-Bold' : 'Helvetica' });
      textCell(doc, v, left + leftW + (rightW * 0.5), sy, rightW * 0.46 - 14, 20, { size: 8.7, font: isGrand ? 'Helvetica-Bold' : 'Helvetica', align: 'right' });
      sy += 20;
    });

    if (showFields.showQr && company.qrCode) {
      safeImage(doc, company.qrCode, left + leftW + 18, sy + 6, [56, 56]);
    }

    if (showFields.showSignature) {
      const signY = y + summaryH - 52;
      if (company.signature) safeImage(doc, company.signature, left + leftW + rightW - 110, signY - 16, [88, 32]);
      textCell(doc, `For ${company.name}`, left + leftW + 16, signY, rightW - 22, 14, { align: 'right', size: 8, font: 'Helvetica-Bold' });
      textCell(doc, 'Authorized Signature', left + leftW + 16, signY + 20, rightW - 22, 14, { align: 'right', size: 8.2 });
    }

    y += Math.max(leftH, summaryH) + 10;

    ensureSpace(36);
    drawRoundedRect(doc, left, y, contentW, 30, 8, BRAND.border, BRAND.soft, 1);
    textCell(doc, company.thankYouText, left + 2, y + 2, contentW - 4, 12, { size: 9, font: 'Helvetica-Bold', align: 'center', color: BRAND.primary });

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      drawFooter(i + 1, range.count);
    }

    doc.end();
  });
};

module.exports = {
  generateInvoicePdfBuffer,
  formatINR,
  formatDate
};
