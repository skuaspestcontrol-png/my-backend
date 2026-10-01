const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  __test__: {
    summarizeAttendanceForPayroll,
    calcPayrollItem,
    normalizePayrollRecord,
    isEditablePayrollRecord,
    buildAttendanceSummaryOptions,
    createWhatsAppSalarySlipAttachment
  }
} = require('../payrollModule');

const employee = {
  _id: 'EMP-1',
  empCode: 'EMP-1',
  firstName: 'Test',
  lastName: 'Employee',
  role: 'Technician'
};

const monthlyStructure = {
  salaryType: 'monthly',
  basicSalary: 15000,
  allowances: {},
  deductions: {}
};

const summarize = (attendance, config = {}) => summarizeAttendanceForPayroll(buildAttendanceSummaryOptions({
  employeeId: employee._id,
  month: 9,
  year: 2026,
  attendance,
  holidays: [],
  config: {
    weeklyOffDay: 0,
    lateMarkGraceMinutes: 15,
    workStartTime: '09:30',
    workEndTime: '17:30',
    standardDailyHours: 8,
    ...config
  }
}));

const weeklyOffAttendance = (date, checkIn, checkOut, workingHours) => ({
  employeeId: employee._id,
  date,
  status: 'present',
  checkIn,
  checkOut,
  workingHours
});

test('monthly weekly-off earning uses day equivalents, not raw hours', () => {
  const summary = summarize([
    weeklyOffAttendance('2026-09-06', '09:30', '17:30', 8),
    weeklyOffAttendance('2026-09-13', '09:30', '17:30', 8),
    weeklyOffAttendance('2026-09-20', '09:30', '17:30', 8),
    weeklyOffAttendance('2026-09-27', '09:30', '17:30', 8)
  ]);
  const item = calcPayrollItem({
    employee,
    structure: monthlyStructure,
    attendanceSummary: summary,
    advances: [],
    month: 9,
    year: 2026
  });

  assert.equal(summary.weeklyOffPayableDays, 4);
  assert.equal(item.weeklyOffWorkEarning, 2000);
  assert.equal(item.grossSalary, 17000);
});

test('default weekly-off OT follows normal late-adjusted shift end', () => {
  const exactHalfDay = summarize([weeklyOffAttendance('2026-09-06', '09:30', '13:30', 4)]);
  assert.equal(exactHalfDay.weeklyOffPayableDays, 0.5);

  const belowHalfDay = summarize([weeklyOffAttendance('2026-09-06', '09:30', '13:20', 3.83)]);
  assert.equal(belowHalfDay.weeklyOffPayableDays, 0);

  const fullDay = summarize([weeklyOffAttendance('2026-09-06', '09:30', '20:00', 10.5)]);
  assert.equal(fullDay.weeklyOffPayableDays, 1);
  assert.equal(fullDay.overtimeHours, 2.5);

  const lateDay = summarize([weeklyOffAttendance('2026-09-06', '10:00', '20:00', 10)]);
  assert.equal(lateDay.weeklyOffPayableDays, 1);
  assert.equal(lateDay.overtimeHours, 2);
});

test('salary slip WhatsApp attachment creates public pdf copy for link providers', () => {
  const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'salary-slip-whatsapp-'));
  const sourcePdf = path.join(uploadRoot, 'source.pdf');
  const pdfBytes = Buffer.from('%PDF-1.4\n% test salary slip\n');
  fs.writeFileSync(sourcePdf, pdfBytes);

  const attachment = createWhatsAppSalarySlipAttachment({
    absolutePath: sourcePdf,
    fileName: '../EMP-8438 2026 09.pdf',
    origin: 'https://crm.skuaspestcontrol.com/',
    uploadRoot
  });

  assert.match(attachment.fileName, /^EMP-8438_2026_09\.pdf$/);
  assert.match(attachment.attachmentFileName, /^whatsapp-salary-slip-\d+-EMP-8438_2026_09\.pdf$/);
  assert.equal(attachment.attachmentUrl.endsWith('.pdf'), true);
  assert.equal(attachment.attachmentUrl.includes('/uploads/whatsapp-salary-slip-'), true);
  assert.equal(fs.readFileSync(attachment.attachmentPath).slice(0, 5).toString('latin1'), '%PDF-');
  assert.equal(fs.readFileSync(attachment.attachmentPath).equals(pdfBytes), true);
  assert.equal(path.dirname(attachment.attachmentPath), path.resolve(uploadRoot));
});

test('custom standardDailyHours and workEndTime are propagated', () => {
  const config = {
    workStartTime: '09:00',
    workEndTime: '18:00',
    standardDailyHours: 9
  };

  const fullDay = summarize([weeklyOffAttendance('2026-09-06', '09:00', '18:00', 9)], config);
  assert.equal(fullDay.weeklyOffPayableDays, 1);
  assert.equal(fullDay.overtimeHours, 0);

  const halfDay = summarize([weeklyOffAttendance('2026-09-06', '09:00', '13:30', 4.5)], config);
  assert.equal(halfDay.weeklyOffPayableDays, 0.5);

  const belowHalfDay = summarize([weeklyOffAttendance('2026-09-06', '09:00', '13:20', 4.33)], config);
  assert.equal(belowHalfDay.weeklyOffPayableDays, 0);

  const overtimeDay = summarize([weeklyOffAttendance('2026-09-06', '09:00', '20:00', 11)], config);
  assert.equal(overtimeDay.weeklyOffPayableDays, 1);
  assert.equal(overtimeDay.overtimeHours, 2);
  const item = calcPayrollItem({
    employee,
    structure: monthlyStructure,
    attendanceSummary: overtimeDay,
    advances: [],
    month: 9,
    year: 2026
  });
  assert.equal(item.overtimeRate, 111.12);
  assert.equal(item.overtimeEarning, 222.24);

  const lateOvertimeDay = summarize([weeklyOffAttendance('2026-09-06', '10:00', '20:00', 10)], config);
  assert.equal(lateOvertimeDay.weeklyOffPayableDays, 1);
  assert.equal(lateOvertimeDay.overtimeHours, 1);
});

test('daily and hourly salaries do not receive monthly weekly-off day-equivalent earning', () => {
  const summary = summarize([weeklyOffAttendance('2026-09-06', '09:30', '20:00', 10.5)]);

  const daily = calcPayrollItem({
    employee,
    structure: { ...monthlyStructure, salaryType: 'daily', dailyRate: 1000, overtimeRate: 125 },
    attendanceSummary: summary,
    advances: [],
    month: 9,
    year: 2026
  });
  assert.equal(daily.weeklyOffWorkEarning, 0);
  assert.equal(daily.overtimeEarning, 312.5);

  const hourly = calcPayrollItem({
    employee,
    structure: { ...monthlyStructure, salaryType: 'hourly', hourlyRate: 100, overtimeRate: 125 },
    attendanceSummary: summary,
    advances: [],
    month: 9,
    year: 2026
  });
  assert.equal(hourly.weeklyOffWorkEarning, 0);
  assert.equal(hourly.overtimeEarning, 312.5);
});

test('only unlocked Draft and Hold payroll rows are editable during cache reconciliation', () => {
  assert.equal(isEditablePayrollRecord({ payrollStatus: 'Draft' }), true);
  assert.equal(isEditablePayrollRecord({ payrollStatus: 'Hold' }), true);
  assert.equal(isEditablePayrollRecord({ payrollStatus: 'Generated' }), false);
  assert.equal(isEditablePayrollRecord({ payrollStatus: 'Paid' }), false);
  assert.equal(isEditablePayrollRecord({ payrollStatus: 'Draft', isLocked: true }), false);
});

test('legacy sundayWorkEarning keeps historical label while new weekly-off snapshots use new label', () => {
  const legacy = normalizePayrollRecord({
    payrollKey: 'LEGACY',
    month: 9,
    year: 2026,
    basicSalary: 15000,
    sundayWorkEarning: 2454.38,
    attendanceSummary: { daysInMonth: 30, sundayNormalEarningHours: 39.27 }
  });
  assert.equal(legacy.usesLegacySundayWorkEarning, true);
  assert.equal(legacy.weeklyOffWorkEarningLabel, 'Sunday Work Earning');
  assert.equal(legacy.weeklyOffWorkEarning, 2454.38);

  const current = normalizePayrollRecord({
    payrollKey: 'CURRENT',
    month: 9,
    year: 2026,
    basicSalary: 15000,
    weeklyOffWorkEarning: 2000,
    attendanceSummary: { daysInMonth: 30, weeklyOffPayableDays: 4 }
  });
  assert.equal(current.usesLegacySundayWorkEarning, false);
  assert.equal(current.weeklyOffWorkEarningLabel, 'Weekly-Off Work Earning');
  assert.equal(current.weeklyOffWorkEarning, 2000);
});
