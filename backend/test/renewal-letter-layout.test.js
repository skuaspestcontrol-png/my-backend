const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Writable } = require('node:stream');
const PDFDocument = require('pdfkit');
const { formatDate, amountToWords } = require('../invoicePdf');

// Exercise the real route's drawing code without starting the server or touching a database.
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const start = source.indexOf('    const doc = new PDFDocument', source.indexOf("app.post('/api/renewals/:id/generate-letter'"));
const drawing = source.slice(start, source.indexOf('    doc.end();', start) + '    doc.end();'.length);
const helper = (name) => {
  const index = source.indexOf(`const ${name} =`);
  return new Function(`${source.slice(index, source.indexOf('\n};', index) + 3)}; return ${name};`)();
};
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function render(overrides = {}) {
  const fragments = [], rectangles = [], chunks = [];
  let page = 0;
  class Document extends PDFDocument {
    constructor(options) { super(options); this.on('pageAdded', () => { page += 1; }); }
    _fragment(text, x, y, options) {
      if (text) fragments.push({ text, x, y, page, align: options.align, font: this._font.name,
        height: (this._font.ascender - this._font.descender) * this._fontSize / 1000,
        width: this.widthOfString(text), wordSpacing: options.wordSpacing || 0, characterSpacing: options.characterSpacing || 0 });
      return super._fragment(text, x, y, options);
    }
    rect(x, y, w, h) { rectangles.push({ x, y, w, h, page }); return super.rect(x, y, w, h); }
  }
  const sink = new Writable({ write(chunk, encoding, done) { chunks.push(chunk); done(); } });
  const renewal = { renewalId: 'QA-REN-204', customerName: 'QA Customer', address: '45 QA Road Delhi 110048',
    serviceType: 'QA Cockroach Control', proposedAmount: 11800, assignedSalesPersonName: 'QA Salesperson', ...overrides };
  const context = {
    PDFDocument: Document, fs: { createWriteStream: () => sink, existsSync: () => false }, path,
    __dirname: path.join(__dirname, '..'), process: { env: {}, cwd: () => __dirname }, fullPath: 'unused.pdf', settings: {},
    renewal, letterDate: '2026-11-01', renewalDisplayId: 'QA/REN/204', salespersonEmployee: null,
    letterDates: { previousEnd: new Date(2026, 10, 4), start: new Date(2026, 10, 5), end: new Date(2027, 10, 4), duration: '12 months' },
    formatDate, amountToWords, parseDateOnly: helper('parseDateOnly'), sanitizePdfAddress: helper('sanitizePdfAddress'),
    formatCompanyPhoneLine: helper('formatCompanyPhoneLine'), resolveGstCompanyLogoPath: () => ({ path: '' }),
    loadCustomersForContext: async () => [], toNumber: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    console: { info() {}, error: console.error }
  };
  await new AsyncFunction(...Object.keys(context), `${drawing}\nawait new Promise((resolve, reject) => {stream.on('finish', resolve);stream.on('error', reject);});`)(...Object.values(context));
  const buffer = Buffer.concat(chunks);
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  return { fragments, rectangles, pages: page + 1 };
}
const textOf = (result) => result.fragments.map(part => part.text).join('').replace(/\s+/g, ' ');
const checkCells = ({ fragments, rectangles }) => {
  for (const part of fragments) {
    const cell = rectangles.find(rect => rect.page === part.page && part.x >= rect.x && part.x < rect.x + rect.w
      && part.y >= rect.y && part.y < rect.y + rect.h);
    if (!cell) continue;
    assert(part.y + part.height <= cell.y + cell.h + 0.5, `Text crosses cell bottom: ${part.text}`);
    assert(part.x + part.width <= cell.x + cell.w + 0.5, `Text crosses cell right edge: ${part.text}`);
  }
};

test('opening paragraphs retain natural spaces, left alignment and bold address', async () => {
  const result = await render();
  assert.match(textOf(result), /110048\. We value our association/);
  assert(result.fragments.some(part => part.font.includes('Bold') && part.text.includes('110048.')));
  assert(result.fragments.every(part => part.align !== 'justify' && part.wordSpacing === 0 && part.characterSpacing === 0));
  checkCells(result);
});

test('long address and company name wrap before the next paragraph', async () => {
  const result = await render({ customerName: 'QA International Research and Manufacturing Company '.repeat(4), address: 'QA Building, Industrial Research Campus, '.repeat(160) + 'Delhi 110048' });
  assert(result.pages > 1);
  const lastOpening = result.fragments.find(part => part.text.includes('complete satisfaction.'));
  const contract = result.fragments.find(part => part.text.startsWith('Your current contract'));
  assert(lastOpening && contract);
  assert(contract.page > lastOpening.page || contract.y >= lastOpening.y + lastOpening.height);
  assert.match(textOf(result), /110048\. We value/);
  checkCells(result);
});

test('long service cells grow without overlapping totals or payment terms', async () => {
  const result = await render({ serviceType: 'QA Commercial inspection and preventive pest management '.repeat(12) });
  assert(result.pages <= 4);
  assert.match(textOf(result), /Total Price with GST \(In Words\) = 11,800\/-/);
  assert.match(textOf(result), /Payment Terms and Other Conditions:/);
  checkCells(result);
});

test('many services paginate with repeated headings and preserve each service and amount', async () => {
  const items = Array.from({ length: 22 }, (_, index) => ({ itemName: `QA Service ${index + 1} for inspection and preventive treatment at designated commercial premises`, quantity: 1, rate: 1000, taxRate: 18 }));
  const result = await render({ sourceInvoiceItems: items, proposedAmount: 0 });
  assert(result.pages > 1 && result.pages <= 5);
  const text = textOf(result);
  for (let index = 1; index <= 22; index += 1) assert(text.includes(`QA Service ${index} for`));
  assert.match(text, /25,960\/-/);
  for (let page = 1; page < result.pages - 1; page += 1) assert(result.fragments.some(part => part.page === page && part.text === 'Service Name'));
  checkCells(result);
});

test('oversized single cells continue on another page without losing the last word', async () => {
  const result = await render({ serviceType: 'QA Preventive inspection and pest management '.repeat(100) + 'ENDMARKER' });
  assert(result.pages > 2 && result.pages < 20);
  assert.equal((textOf(result).match(/ENDMARKER/g) || []).length, 2); // Contract paragraph and service table.
  checkCells(result);
});

test('GST and non-GST totals, identifiers and dates stay unchanged', async () => {
  for (const nonGst of [false, true]) {
    const result = await render({ sourceInvoice: { invoiceType: nonGst ? 'NON GST' : 'GST', totalTax: nonGst ? 0 : 1800 }, proposedAmount: nonGst ? 10000 : 11800 });
    const text = textOf(result);
    assert.match(text, /Renewal ID: QA\/REN\/204/);
    assert.match(text, /04\/Nov\/2026/);
    assert.match(text, /05\/Nov\/2026 to 04\/Nov\/2027/);
    assert(text.includes(nonGst ? 'Total Price without GST (In Words) = 10,000/-' : 'Total Price with GST (In Words) = 11,800/-'));
    checkCells(result);
  }
});

test('long letters keep closing paragraphs and the complete sign-off on the same page', async () => {
  const result = await render({ serviceType: 'QA Integrated ' + 'commercial pest management, kitchen sanitation and warehouse monitoring with preventive perimeter inspection, '.repeat(5) + 'treatment' });
  const closing = result.fragments.find(part => part.text.startsWith('We look forward'));
  const clarification = result.fragments.find(part => part.text.startsWith('For any clarification'));
  const signoff = result.fragments.find(part => part.text === 'Thanking you,');
  const contact = result.fragments.find(part => part.text.startsWith('Mob:'));
  assert(closing && clarification && signoff && contact);
  assert.equal(closing.page, clarification.page);
  assert.equal(closing.page, signoff.page);
  assert.equal(closing.page, contact.page);
  assert(clarification.y >= closing.y + closing.height + 4);
  assert(contact.y + contact.height <= 841.89 - 45);
  checkCells(result);
});
