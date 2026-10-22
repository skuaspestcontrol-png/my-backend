const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const frontend = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/InvoiceDashboard.jsx'), 'utf8');

// Execute the actual save calculations without starting the server or writing invoices.
function saveCalculation(source, marker, endMarker, balanceName) {
  const scope = source.indexOf(marker);
  assert.notEqual(scope, -1);
  const start = source.indexOf('const savedStatus =', scope);
  const end = source.indexOf(endMarker, start);
  assert(start > scope && end > start);
  return new Function('req', 'current', 'form', 'paymentReceivedEnabled', 'paymentReceivedTotal', 'amount', 'invoiceTotal',
    `${source.slice(start, end)}; return { status, balance: ${balanceName} };`);
}

const saves = {
  create: saveCalculation(server, "app.post('/api/invoices',", 'const invoiceDate =', 'balanceDue'),
  update: saveCalculation(server, "app.put('/api/invoices/:id',", 'const serviceScheduleDefaultTime =', 'nextBalanceDue'),
  frontend: saveCalculation(frontend, 'const handleSubmit =', 'if (!Number.isFinite(invoiceTotal)', 'computedBalance')
};

for (const [name, save] of Object.entries(saves)) {
  test(`${name}: saving new and legacy draft invoices issues them without a payment`, () => {
    for (const status of [undefined, '', 'DRAFT', ' draft ']) {
      for (const enabled of [false, true]) {
        const result = save({ body: { status } }, { status: 'DRAFT' }, { status, paymentReceivedEnabled: enabled }, enabled, 0, 5682, 5682);
        assert.deepEqual(result, { status: 'SENT', balance: 5682 });
      }
    }
  });

  test(`${name}: auto issuing preserves partial and full payment calculations`, () => {
    for (const [received, expectedStatus, expectedBalance] of [[100, 'SENT', 5582], [5682, 'PAID', 0]]) {
      const result = save({ body: { status: 'DRAFT' } }, { status: 'DRAFT' }, { status: 'DRAFT', paymentReceivedEnabled: true }, true, received, 5682, 5682);
      assert.deepEqual(result, { status: expectedStatus, balance: expectedBalance });
    }
  });

  test(`${name}: saving preserves paid and inactive invoice states`, () => {
    for (const status of ['PAID', 'CANCELLED', 'CANCELED', 'VOID', 'OVERDUE']) {
      const balance = status === 'PAID' ? 0 : 5682;
      const result = save({ body: { status } }, { status }, { status, paymentReceivedEnabled: false, balanceDue: balance }, false, 0, 5682, 5682);
      assert.deepEqual(result, { status, balance });
    }
  });
}
