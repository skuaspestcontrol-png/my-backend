const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

function routeBlock(method, route) {
  const start = source.indexOf(`app.${method}('${route}'`);
  assert.notEqual(start, -1, `${method.toUpperCase()} ${route} route not found`);
  const nextRoute = source.indexOf('\napp.', start + 1);
  return source.slice(start, nextRoute === -1 ? source.length : nextRoute);
}

test('renewal convert-contract uses one locked MySQL transaction before JSON shadow write', () => {
  const block = routeBlock('post', '/api/renewals/:id/convert-contract');

  assert.match(block, /await conn\.beginTransaction\(\)/);
  assert.match(block, /FOR UPDATE/);
  assert.match(block, /readLockedSettingsForNumbering\(conn\)/);
  assert.match(block, /syncInvoiceToMysqlOnConnection\(conn, newInvoice, \{ ensureSchema: false \}\)/);
  assert.match(block, /persistLockedSettingsForNumbering\(conn, lockedSettings, newInvoice\.invoiceNumber, newInvoice\.invoiceType\)/);
  assert.match(block, /UPDATE renewals[\s\S]+converted_contract_id[\s\S]+WHERE renewal_id = \? AND \(converted_contract_id IS NULL OR converted_contract_id = ''\)/);
  assert.match(block, /await conn\.commit\(\)/);
  assert.match(block, /await conn\.rollback\(\)/);

  const commitIndex = block.indexOf('await conn.commit()');
  const shadowIndex = block.indexOf('readJsonFile(invoicesFile');
  assert.ok(commitIndex > -1 && shadowIndex > commitIndex, 'JSON shadow write must happen only after commit');
});

test('sensitive renewal routes require explicit renewal authorization', () => {
  const expected = [
    ['post', '/api/renewals/audit/classify', 'requireRenewalAdminAccess'],
    ['post', '/api/renewals/sync', 'requireRenewalAdminAccess'],
    ['post', '/api/renewals/:id/assign', 'requireRenewalManagerAccess'],
    ['post', '/api/renewals/:id/edit', 'requireRenewalRecordAccess'],
    ['delete', '/api/renewals/:id', 'requireRenewalAdminAccess'],
    ['post', '/api/renewals/:id/followup', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/generate-letter', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/mark-done', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/decline', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/convert-contract', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals', 'requireRenewalManagerAccess'],
    ['put', '/api/renewals/:id', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/send-reminder', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/send-whatsapp', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/quotation', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/convert-invoice', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/assign-technician', 'requireRenewalManagerAccess']
  ];

  for (const [method, route, guard] of expected) {
    assert.match(routeBlock(method, route), new RegExp(`${guard}\\(req, res`), `${method.toUpperCase()} ${route} missing ${guard}`);
  }
});
