import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRupees, formatRupeeAmount } from './currencyDisplay.js';

test('whole-rupee display hides floating-point residue and uses Indian grouping', () => {
  assert.equal(formatRupees(357986.47000000003), '₹3,57,986');
  assert.equal(formatRupees('357986.47000000003'), '₹3,57,986');
  assert.equal(formatRupees(12345678.9), '₹1,23,45,679');
  assert.equal(formatRupees(123456.5), '₹1,23,457');
  assert.equal(formatRupees(-123456.5), '-₹1,23,457');
});

test('zero, sub-rupee credits and invalid display amounts are stable', () => {
  for (const value of [0, -0, 0.49, -0.49, null, undefined, '', NaN, Infinity]) {
    assert.equal(formatRupees(value), '₹0');
  }
  assert.equal(formatRupeeAmount(357986.47), '3,57,986');
});

test('display formatting never changes source amounts or subsequent calculations', () => {
  const invoice = Object.freeze({ subtotal: 357986.47000000003, tax: 64437.5646 });
  const total = invoice.subtotal + invoice.tax;
  formatRupees(invoice.subtotal);
  formatRupees(total);
  assert.equal(invoice.subtotal, 357986.47000000003);
  assert.equal(invoice.subtotal + invoice.tax, total);
});
