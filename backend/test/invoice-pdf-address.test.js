const test = require('node:test');
const assert = require('node:assert/strict');
const PDFDocument = require('pdfkit');
const { generateInvoicePdfBuffer } = require('../invoicePdf');

const companyName = 'SAMPLE COMMUNICATION PRIVATE LIMITED';
const street = '2ND FLOOR, TOWER-1, OFFICE NO. 5A, STELLAR IT PARK, C-25,Gautambuddha Nagar';
const billingText = `${companyName}\n${street}\nSector 62\nUttar Pradesh 201309`;
const shippingText = `Site Contact\n${street}\nSector 62\nUttar Pradesh 201309`;

async function render({ invoice = {}, customer = {} } = {}) {
  const records = [];
  const original = PDFDocument.prototype.text;
  PDFDocument.prototype.text = function (text, x, y, options) {
    const record = { text: String(text), x, y };
    const result = original.call(this, text, x, y, options);
    record.bottom = this.y;
    records.push(record);
    return result;
  };
  try {
    const buffer = await generateInvoicePdfBuffer({
      invoice: {
        invoiceNumber: 'PREVIEW/001', customerName: companyName, invoiceType: 'NON GST',
        date: '2026-11-15', items: [{ itemName: 'General Pest Control', quantity: 1, rate: 3500 }],
        billingAddressText: billingText, shippingAddressText: shippingText, ...invoice
      },
      customer: { name: companyName, billingAttention: companyName, ...customer },
      settings: { companyName: 'Preview Pest Control' }
    });
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    return records;
  } finally {
    PDFDocument.prototype.text = original;
  }
}

test('invoice PDF preserves every comma and line of the saved billing and shipping addresses', async () => {
  const records = await render({ customer: { billingStreet1: 'Old short address', shippingStreet1: 'Old shipping address' } });
  assert(records.some(({ text }) => text === `${street}\nSector 62\nUttar Pradesh 201309`));
  assert(records.some(({ text }) => text === shippingText));
  assert(!records.some(({ text }) => text.includes('Uttar, Uttar Pradesh')));
  assert(!records.some(({ text }) => text.includes('Old short address') || text.includes('Old shipping address')));
});

test('single-line comma-separated invoice addresses are not truncated', async () => {
  const address = 'Office 8, Tower B, Third Floor, Tech Park, Sector 61, Noida, Uttar Pradesh 201301';
  const records = await render({ invoice: { billingAddressText: address } });
  assert(records.some(({ text }) => text === address));
});

test('billing and shipping keep their own complete saved locations even when initial lines match', async () => {
  const common = `${companyName}\nOffice 1\nBusiness Park`;
  const bill = `${common}\nNorth Wing, Delhi\nDelhi 110001`;
  const ship = `${common}\nSouth Wing, Noida\nUttar Pradesh 201309`;
  const records = await render({ invoice: { billingAddressText: bill, shippingAddressText: ship } });
  assert(records.some(({ text }) => text === bill.split('\n').slice(1).join('\n')));
  assert(records.some(({ text }) => text === ship.split('\n').slice(1).join('\n')));
});

test('legacy invoices without address snapshots still use structured customer addresses and GSTIN', async () => {
  const records = await render({
    invoice: { invoiceType: 'GST', billingAddressText: '', shippingAddressText: '' },
    customer: {
      billingStreet1: 'Office 11, Tower A', billingStreet2: 'Business Park', billingArea: 'Sector 62',
      billingCity: 'Noida', billingState: 'Uttar Pradesh', billingPincode: '201309', gstNumber: '09ABCDE1234F1Z5',
      shippingStreet1: 'Warehouse 9', shippingArea: 'Industrial Estate', shippingCity: 'Delhi',
      shippingState: 'Delhi', shippingPincode: '110001'
    }
  });
  assert(records.some(({ text }) => text.includes('Office 11, Tower A') && text.includes('Business Park') && text.includes('Noida, Uttar Pradesh, 201309') && text.includes('GSTIN: 09ABCDE1234F1Z5')));
  assert(records.some(({ text }) => text.includes('Warehouse 9') && text.includes('Delhi, Delhi, 110001')));
});

test('long addresses and wrapped company names stay above the subject and service table', async () => {
  const title = `${companyName} CORPORATE FACILITIES AND TECHNOLOGY SERVICES DIVISION`;
  const address = Array.from({ length: 9 }, (_, index) => `Address line ${index + 1}, Building ${index + 1}, Detailed business location`).join('\n');
  const records = await render({
    invoice: { customerName: title, billingAddressText: `${title}\n${address}`, shippingAddressText: address },
    customer: { billingAttention: title }
  });
  const subject = records.find(({ text }) => text === 'Subject :');
  const bodies = records.filter(({ text }) => text === address);
  assert.equal(bodies.length, 2);
  for (const body of bodies) {
    const heading = records.find(({ text, x }) => text === title && x === body.x);
    assert(heading && body.y >= heading.bottom, 'address starts after the wrapped heading');
    assert(subject.y >= body.bottom + 4, 'subject stays below the full address');
  }
  assert(records.find(({ text }) => text === 'Sr No').y > subject.y);
});
