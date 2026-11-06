import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPortalDate as date, formatPortalTime as time, formatPortalDateTime as stamp, formatPortalReviewValue as review, formatPortalValue as cell } from './portalDateTime.js';
import { formatIndiaDateTime, formatIndiaTime } from './indiaTime.js';
import { formatServiceScheduleDate, formatServiceScheduleTime, buildContractWindow } from './serviceScheduleBuilder.js';

test('calendar dates use DD-MM-YYYY, including unambiguous existing display values', () => {
  for (const v of ['2026-11-06','06/11/2026','6-11-2026','06-11-2026']) assert.equal(date(v),'06-11-2026');
  assert.equal(date('2028-02-29'),'29-02-2028');
  assert.equal(date('2026-01-01'),'01-01-2026');
});
test('calendar dates do not roll over or shift with the host time zone', () => {
  const initial = process.env.TZ;
  try { for (const zone of ['America/Los_Angeles','Pacific/Kiritimati','UTC','Asia/Kolkata']) {
    process.env.TZ = zone;
    assert.equal(date('2026-11-06'),'06-11-2026');
    assert.equal(stamp('2026-11-06T09:05'),'06-11-2026 09:05 AM');
  }} finally { if (initial === undefined) delete process.env.TZ; else process.env.TZ = initial; }
});
test('timestamp instants use India time and handle midnight year rollover', () => {
  assert.equal(stamp('2026-11-06T00:00:00Z'),'06-11-2026 05:30 AM');
  assert.equal(stamp('2026-12-31T20:00:00Z'),'01-01-2027 01:30 AM');
  assert.equal(stamp('2026-11-06T09:45:00+05:30'),'06-11-2026 09:45 AM');
  assert.equal(stamp(new Date('2026-11-06T06:30:00Z')),'06-11-2026 12:00 PM');
  assert.equal(stamp(Date.parse('2026-11-06T06:30:00Z')),'06-11-2026 12:00 PM');
});
test('wall-clock times use zero-padded hours and uppercase AM/PM', () => {
  for (const [v,expected] of [['00:00','12:00 AM'],['12:00','12:00 PM'],['13:07','01:07 PM'],['9:05','09:05 AM'],['9:05 am','09:05 AM'],['12:30 am','12:30 AM'],['12:30 PM','12:30 PM'],['9 PM','09:00 PM'],['09:05:32','09:05 AM']]) assert.equal(time(v),expected,v);
  assert.equal(stamp('2026-11-06 09:05 PM'),'06-11-2026 09:05 PM');
});
test('empty and invalid dates/times never invent a date or default appointment', () => {
  for (const v of [null,undefined,'','invalid','2026-02-29','2026-02-30T08:00:00Z','31/11/2026']) assert.equal(date(v),'-',String(v));
  for (const v of [null,undefined,'','invalid','24:00','12:60','00:30 PM','13:30 AM','09:30:99']) assert.equal(time(v),'-',String(v));
  assert.equal(date('', 'No date'),'No date');assert.equal(time('', '--'),'--');
  assert.equal(stamp('2026-11-06'),'06-11-2026');
});
test('review and generic table formatting preserves ordinary text, numbers and inputs', () => {
  assert.equal(review('2026-11-06'),'06-11-2026');assert.equal(review('17:05'),'05:05 PM');
  assert.equal(review('ONE_TIME'),'ONE_TIME');assert.equal(review(1500),'1500');
  const input={date:'2026-11-06',time:'17:05'};assert.strictEqual(cell(input),input);assert.equal(input.date,'2026-11-06');
  for(const v of [1500,0,null,undefined,'','2026','1500.00','Thermal fogging'])assert.strictEqual(cell(v),v);
});
test('existing shared India and service-schedule formatters use the portal convention', () => {
  assert.equal(formatIndiaDateTime('2026-11-06T00:00:00Z'),'06-11-2026 05:30 AM');
  assert.equal(formatIndiaTime('13:05'),'01:05 PM');
  assert.equal(formatIndiaDateTime(null, {}, 'Missing'),'Missing');
  assert.equal(formatServiceScheduleDate('2026-11-06'),'06-11-2026');
  assert.equal(formatServiceScheduleTime('09:05'),'09:05 AM');
  const window=buildContractWindow('2026-11-06','single_time');
  assert.equal(window.contractStartDate,'2026-11-06');assert.equal(window.contractEndDate,'2026-11-06');assert.equal(window.renewalDate,'2026-11-07');
});
