const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

const round2 = (value) => Number((Number(value) || 0).toFixed(2));
const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const toDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const pad2 = (value) => String(value).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const normalizeText = (value) => String(value || '').trim();
const normalizeRole = (value) => normalizeText(value).toLowerCase();

const defaultCompany = {
  companyName: 'SKUAS Pest Control',
  phone: '9316666656',
  website: 'www.skuaspestcontrol.com'
};

const allowedSalaryType = new Set(['monthly', 'daily', 'hourly']);
const allowedPayrollStatus = new Set(['Draft', 'Generated', 'Paid', 'Hold']);
const allowedPaymentMode = new Set(['Cash', 'Bank transfer', 'UPI', 'Cheque']);

const defaultPayrollConfig = {
  weeklyOffDay: 0, // Sunday
  lateMarkGraceMinutes: 15,
  standardDailyHours: 8,
  workStartTime: '09:00'
};

const roleToPermissions = (rawRole) => {
  const role = normalizeRole(rawRole || 'employee');
  const isAdmin = role === 'admin';
  const isHr = role.includes('hr');
  const isAccountant = role.includes('account');
  const isEmployee = role.includes('employee') || role.includes('technician') || role.includes('sales') || role.includes('operations');
  return {
    role,
    canManageAll: isAdmin || isHr,
    canGenerate: isAdmin || isHr,
    canMarkPaid: isAdmin || isAccountant,
    canViewOwn: isEmployee || isAdmin || isHr || isAccountant
  };
};

const getRoleFromReq = (req) => {
  const fromHeader = normalizeText(req.headers['x-role'] || req.headers['x-portal-role'] || '');
  const fromQuery = normalizeText(req.query.role || '');
  return fromHeader || fromQuery || normalizeText(req.body?.role || '');
};

const getActorName = (req) => normalizeText(req.headers['x-user-name'] || req.headers['x-portal-user'] || req.query.userName || req.body?.actor || 'System');
const getActorEmployeeId = (req) => normalizeText(req.headers['x-user-id'] || req.headers['x-employee-id'] || req.query.userId || req.query.employeeId || req.body?.actorEmployeeId || '');
const normalizeWhatsappPhone = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return '';
};
const resolveEmailConfig = (settings = {}) => ({
  host: settings.smtpHost || process.env.SMTP_HOST || '',
  port: Math.max(1, Number(settings.smtpPort || process.env.SMTP_PORT || 587) || 587),
  secure: String(settings.smtpEncryption || '').toUpperCase() === 'SSL' || String(settings.smtpSecure || '').toLowerCase() === 'true',
  active: String(settings.smtpActive || 'Yes'),
  fromName: settings.smtpSenderName || settings.companyName || '',
  user: settings.smtpUser || process.env.SMTP_USER || '',
  pass: settings.smtpPass || process.env.SMTP_PASS || '',
  fromEmail: settings.smtpFromEmail || process.env.SMTP_FROM_EMAIL || settings.companyEmail || ''
});
const resolveWhatsappConfig = (settings = {}) => ({
  apiVersion: settings.whatsappApiVersion || process.env.WHATSAPP_API_VERSION || 'v23.0',
  phoneNumberId: settings.whatsappInstanceId || settings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: settings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || ''
});

const monthDateRange = (month, year) => {
  const m = Math.min(12, Math.max(1, toNumber(month, 1)));
  const y = Math.max(2000, toNumber(year, new Date().getFullYear()));
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return { month: m, year: y, start, end };
};

const listDatesInRange = (start, end) => {
  const list = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    list.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return list;
};

const buildMoneyWords = (amount) => {
  const n = Math.floor(Math.max(0, Number(amount) || 0));
  if (n === 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = (v) => {
    if (v < 10) return ones[v];
    if (v < 20) return teens[v - 10];
    const t = Math.floor(v / 10);
    const o = v % 10;
    return `${tens[t]}${o ? ` ${ones[o]}` : ''}`.trim();
  };
  const threeDigits = (v) => {
    const h = Math.floor(v / 100);
    const rem = v % 100;
    if (!h) return twoDigits(rem);
    return `${ones[h]} Hundred${rem ? ` ${twoDigits(rem)}` : ''}`.trim();
  };
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return `${parts.join(' ').trim()} Rupees Only`;
};

const normalizeHoliday = (raw = {}) => {
  const date = normalizeText(raw.date);
  const dateObj = toDateOnly(date);
  return {
    _id: normalizeText(raw._id || `HOL-${Date.now()}`),
    date: dateObj ? toDateKey(dateObj) : '',
    title: normalizeText(raw.title || raw.name || 'Company Holiday'),
    type: String(raw.type || 'paid').toLowerCase() === 'unpaid' ? 'unpaid' : 'paid',
    notes: normalizeText(raw.notes || ''),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const normalizeAdvance = (raw = {}) => {
  const amount = Math.max(0, toNumber(raw.amount, 0));
  const recoveredAmount = Math.max(0, toNumber(raw.recoveredAmount, 0));
  return {
    _id: normalizeText(raw._id || `ADV-${Date.now()}`),
    employeeId: normalizeText(raw.employeeId),
    amount,
    recoveredAmount: Math.min(amount, recoveredAmount),
    balanceAmount: round2(Math.max(0, amount - recoveredAmount)),
    monthlyDeduction: Math.max(0, toNumber(raw.monthlyDeduction, 0)),
    deductionMode: String(raw.deductionMode || 'partial').toLowerCase() === 'full' ? 'full' : 'partial',
    autoDeduct: raw.autoDeduct !== false,
    reason: normalizeText(raw.reason || ''),
    issuedDate: normalizeText(raw.issuedDate || new Date().toISOString().slice(0, 10)),
    status: normalizeText(raw.status || 'Open'),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const normalizeSalaryStructure = (raw = {}) => {
  const salaryTypeRaw = normalizeRole(raw.salaryType || 'monthly');
  const salaryType = allowedSalaryType.has(salaryTypeRaw) ? salaryTypeRaw : 'monthly';
  const allowances = {
    hra: toNumber(raw.allowances?.hra ?? raw.hra, 0),
    conveyance: toNumber(raw.allowances?.conveyance ?? raw.conveyance, 0),
    mobile: toNumber(raw.allowances?.mobile ?? raw.mobile, 0),
    bonus: toNumber(raw.allowances?.bonus ?? raw.bonus, 0),
    incentive: toNumber(raw.allowances?.incentive ?? raw.incentive, 0),
    other: toNumber(raw.allowances?.other ?? raw.other, 0)
  };
  const deductions = {
    leave: toNumber(raw.deductions?.leave ?? raw.leave, 0),
    late: toNumber(raw.deductions?.late ?? raw.late, 0),
    advance: toNumber(raw.deductions?.advance ?? raw.advance, 0),
    loan: toNumber(raw.deductions?.loan ?? raw.loan, 0),
    pf: toNumber(raw.deductions?.pf ?? raw.pf, 0),
    esi: toNumber(raw.deductions?.esi ?? raw.esi, 0),
    other: toNumber(raw.deductions?.other ?? raw.other, 0),
    latePerMark: toNumber(raw.deductions?.latePerMark ?? raw.latePerMark, 0)
  };
  return {
    _id: normalizeText(raw._id || `SAL-${Date.now()}`),
    employeeId: normalizeText(raw.employeeId),
    effectiveDate: normalizeText(raw.effectiveDate || new Date().toISOString().slice(0, 10)),
    salaryType,
    basicSalary: toNumber(raw.basicSalary, 0),
    dailyRate: toNumber(raw.dailyRate, 0),
    hourlyRate: toNumber(raw.hourlyRate, 0),
    allowances,
    deductions,
    notes: normalizeText(raw.notes || ''),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const toMinutes = (value) => {
  const raw = normalizeText(value);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
};

const attendanceStatus = (value) => normalizeRole(value || 'absent');

const isPaidLeaveType = (leaveType) => {
  const text = normalizeRole(leaveType);
  return text.includes('paid') || text.includes('casual') || text.includes('sick') || text.includes('earned');
};

const selectCurrentStructure = (structures, employeeId, monthEndDate) => {
  const items = structures
    .filter((entry) => normalizeText(entry.employeeId) === normalizeText(employeeId))
    .map((entry) => normalizeSalaryStructure(entry));
  if (items.length === 0) return null;
  const monthEnd = toDateOnly(monthEndDate);
  if (!monthEnd) return items[items.length - 1];
  items.sort((a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
  let chosen = items[0];
  items.forEach((entry) => {
    const eff = toDateOnly(entry.effectiveDate);
    if (eff && eff.getTime() <= monthEnd.getTime()) chosen = entry;
  });
  return chosen;
};

const writeAudit = ({ auditFile, readJsonFile, actor, action, payload }) => {
  const rows = readJsonFile(auditFile, []);
  rows.push({
    _id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actor: normalizeText(actor || 'System'),
    action: normalizeText(action || 'unknown'),
    payload: payload || {},
    createdAt: new Date().toISOString()
  });
  fs.writeFileSync(auditFile, JSON.stringify(rows, null, 2));
};

const summarizeAttendanceForPayroll = ({
  employeeId,
  month,
  year,
  attendance,
  holidays,
  weeklyOffDay,
  lateMarkGraceMinutes,
  workStartTime
}) => {
  const { start, end } = monthDateRange(month, year);
  const allDates = listDatesInRange(start, end);
  const employeeAttendanceByDate = new Map(
    (Array.isArray(attendance) ? attendance : [])
      .filter((entry) => normalizeText(entry.employeeId) === normalizeText(employeeId))
      .map((entry) => [normalizeText(entry.date), entry])
  );
  const holidaysByDate = new Map(
    (Array.isArray(holidays) ? holidays : []).map((entry) => [normalizeText(entry.date), normalizeHoliday(entry)])
  );

  let presentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let halfDays = 0;
  let weeklyOffDays = 0;
  let paidHolidayDays = 0;
  let unpaidHolidayDays = 0;
  let lateMarks = 0;

  const shiftStartMins = toMinutes(workStartTime || defaultPayrollConfig.workStartTime);

  allDates.forEach((dateObj) => {
    const key = toDateKey(dateObj);
    const holiday = holidaysByDate.get(key);
    const isWeeklyOff = dateObj.getDay() === weeklyOffDay;
    const att = employeeAttendanceByDate.get(key);
    const status = attendanceStatus(att?.status);

    if (holiday && holiday.type === 'paid') {
      paidHolidayDays += 1;
      return;
    }
    if (holiday && holiday.type === 'unpaid' && !att) {
      unpaidHolidayDays += 1;
      unpaidLeaveDays += 1;
      return;
    }
    if (!att && isWeeklyOff) {
      weeklyOffDays += 1;
      return;
    }

    if (!att) {
      unpaidLeaveDays += 1;
      return;
    }

    if (status === 'weekly-off') {
      weeklyOffDays += 1;
      return;
    }
    if (status === 'present') {
      presentDays += 1;
      const inMins = toMinutes(att.checkIn || '');
      if (inMins !== null && shiftStartMins !== null && inMins > (shiftStartMins + lateMarkGraceMinutes)) {
        lateMarks += 1;
      }
      return;
    }
    if (status === 'half-day') {
      halfDays += 1;
      const inMins = toMinutes(att.checkIn || '');
      if (inMins !== null && shiftStartMins !== null && inMins > (shiftStartMins + lateMarkGraceMinutes)) {
        lateMarks += 1;
      }
      return;
    }
    if (status === 'leave') {
      if (isPaidLeaveType(att.leaveType)) paidLeaveDays += 1;
      else unpaidLeaveDays += 1;
      return;
    }
    unpaidLeaveDays += 1;
  });

  const daysInMonth = allDates.length;
  const totalWorkingDays = Math.max(1, daysInMonth - weeklyOffDays - paidHolidayDays);
  return {
    month,
    year,
    daysInMonth,
    totalWorkingDays,
    presentDays: round2(presentDays),
    paidLeaveDays: round2(paidLeaveDays),
    unpaidLeaveDays: round2(unpaidLeaveDays),
    halfDays: round2(halfDays),
    weeklyOffDays: round2(weeklyOffDays),
    paidHolidayDays: round2(paidHolidayDays),
    unpaidHolidayDays: round2(unpaidHolidayDays),
    lateMarks: round2(lateMarks)
  };
};

const calcPayrollItem = ({
  employee,
  structure,
  attendanceSummary,
  advances,
  month,
  year,
  manualOverride
}) => {
  const baseSalary = Math.max(0, toNumber(structure?.basicSalary ?? employee?.salaryPerMonth ?? employee?.salary, 0));
  const salaryType = structure?.salaryType || 'monthly';
  const dailyRate = Math.max(0, toNumber(structure?.dailyRate, 0));
  const hourlyRate = Math.max(0, toNumber(structure?.hourlyRate, 0));

  const allowances = {
    hra: toNumber(structure?.allowances?.hra, 0),
    conveyance: toNumber(structure?.allowances?.conveyance, 0),
    mobile: toNumber(structure?.allowances?.mobile, 0),
    bonus: toNumber(structure?.allowances?.bonus, 0),
    incentive: toNumber(structure?.allowances?.incentive, 0),
    other: toNumber(structure?.allowances?.other, 0)
  };
  const fixedDeductions = {
    leave: toNumber(structure?.deductions?.leave, 0),
    late: toNumber(structure?.deductions?.late, 0),
    advance: toNumber(structure?.deductions?.advance, 0),
    loan: toNumber(structure?.deductions?.loan, 0),
    pf: toNumber(structure?.deductions?.pf, 0),
    esi: toNumber(structure?.deductions?.esi, 0),
    other: toNumber(structure?.deductions?.other, 0),
    latePerMark: toNumber(structure?.deductions?.latePerMark, 0)
  };
  const allowanceTotal = Object.values(allowances).reduce((sum, value) => sum + toNumber(value, 0), 0);

  let baseEarned = baseSalary;
  const perDaySalary = attendanceSummary.totalWorkingDays > 0
    ? round2(baseSalary / attendanceSummary.totalWorkingDays)
    : 0;
  const halfDayDeductionDays = round2(attendanceSummary.halfDays * 0.5);
  const leaveDeductionDays = round2(attendanceSummary.unpaidLeaveDays + halfDayDeductionDays);
  let leaveDeduction = round2(leaveDeductionDays * perDaySalary);

  if (salaryType === 'daily') {
    const paidDays = attendanceSummary.presentDays + attendanceSummary.paidLeaveDays + attendanceSummary.weeklyOffDays + attendanceSummary.paidHolidayDays + (attendanceSummary.halfDays * 0.5);
    baseEarned = round2((dailyRate || perDaySalary) * paidDays);
    leaveDeduction = 0;
  }
  if (salaryType === 'hourly') {
    const paidHours = (attendanceSummary.presentDays * defaultPayrollConfig.standardDailyHours) + (attendanceSummary.halfDays * (defaultPayrollConfig.standardDailyHours / 2));
    baseEarned = round2((hourlyRate || 0) * paidHours);
    leaveDeduction = 0;
  }

  const lateDeduction = round2(fixedDeductions.late + (attendanceSummary.lateMarks * fixedDeductions.latePerMark));

  const activeAdvances = (Array.isArray(advances) ? advances : [])
    .map((entry) => normalizeAdvance(entry))
    .filter((entry) => normalizeText(entry.employeeId) === normalizeText(employee?._id) && entry.balanceAmount > 0 && normalizeRole(entry.status) !== 'closed');

  const advanceBreakdown = [];
  let advanceSalaryDeduction = fixedDeductions.advance;
  activeAdvances.forEach((advance) => {
    const monthlyTarget = advance.deductionMode === 'full'
      ? advance.balanceAmount
      : (advance.monthlyDeduction > 0 ? advance.monthlyDeduction : advance.balanceAmount);
    const take = round2(Math.min(advance.balanceAmount, Math.max(0, monthlyTarget)));
    if (take <= 0) return;
    advanceSalaryDeduction += take;
    advanceBreakdown.push({
      advanceId: advance._id,
      issuedDate: advance.issuedDate,
      deductionAmount: take,
      balanceBefore: advance.balanceAmount,
      balanceAfter: round2(advance.balanceAmount - take)
    });
  });

  const deductionTotal = round2(
    leaveDeduction
    + lateDeduction
    + advanceSalaryDeduction
    + fixedDeductions.loan
    + fixedDeductions.pf
    + fixedDeductions.esi
    + fixedDeductions.other
  );

  const grossSalary = round2(baseEarned + allowanceTotal);
  const defaultNet = round2(grossSalary - deductionTotal);
  const adjustedNet = manualOverride?.enabled
    ? round2(toNumber(manualOverride.overrideNetSalary, defaultNet))
    : round2(defaultNet + toNumber(manualOverride?.adjustmentAmount, 0));

  return {
    _id: normalizeText(manualOverride?._id || `PAYITEM-${Date.now()}-${employee?._id || 'EMP'}`),
    payrollKey: `${year}-${pad2(month)}-${employee?._id || 'EMP'}`,
    month,
    year,
    employeeId: normalizeText(employee?._id),
    employeeCode: normalizeText(employee?.empCode),
    employeeName: [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim() || employee?.empCode || 'Employee',
    designation: normalizeText(employee?.roleName || employee?.role || ''),
    department: normalizeText(employee?.role || ''),
    salaryType,
    salaryStructureId: normalizeText(structure?._id),
    basicSalary: round2(baseSalary),
    perDaySalary,
    attendanceSummary,
    allowances: { ...allowances, total: round2(allowanceTotal) },
    deductions: {
      leaveDeduction: round2(leaveDeduction),
      lateComingDeduction: round2(lateDeduction),
      advanceSalaryDeduction: round2(advanceSalaryDeduction),
      loanDeduction: round2(fixedDeductions.loan),
      pf: round2(fixedDeductions.pf),
      esi: round2(fixedDeductions.esi),
      otherDeduction: round2(fixedDeductions.other),
      fixedLeaveDeduction: round2(fixedDeductions.leave),
      total: round2(deductionTotal)
    },
    grossSalary,
    netSalary: adjustedNet,
    computedNetSalary: defaultNet,
    manualAdjustmentAmount: round2(toNumber(manualOverride?.adjustmentAmount, 0)),
    manualAdjustmentReason: normalizeText(manualOverride?.adjustmentReason || ''),
    manualOverrideEnabled: !!manualOverride?.enabled,
    overrideNetSalary: manualOverride?.enabled ? round2(toNumber(manualOverride.overrideNetSalary, adjustedNet)) : null,
    paymentStatus: normalizeText(manualOverride?.paymentStatus || 'Pending'),
    payrollStatus: allowedPayrollStatus.has(normalizeText(manualOverride?.payrollStatus)) ? normalizeText(manualOverride?.payrollStatus) : 'Generated',
    isLocked: !!manualOverride?.isLocked,
    paidAt: manualOverride?.paidAt || '',
    paidBy: manualOverride?.paidBy || '',
    paymentMode: manualOverride?.paymentMode || '',
    transactionRef: manualOverride?.transactionRef || '',
    paymentRemarks: manualOverride?.paymentRemarks || '',
    advanceBreakdown,
    salaryInWords: buildMoneyWords(adjustedNet),
    createdAt: manualOverride?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const buildSalarySlipPdfBuffer = ({ item, company }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  const line = (y) => {
    doc.moveTo(42, y).lineTo(553, y).strokeColor('#d0d7e2').stroke();
  };
  const textValue = (label, value, x, y) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#4b5563').text(label, x, y, { continued: true });
    doc.font('Helvetica').fillColor('#111827').text(` ${value || '-'}`);
  };
  const amount = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text(company.companyName || defaultCompany.companyName, 42, 36);
  doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Phone: ${company.phone || defaultCompany.phone}  |  Website: ${company.website || defaultCompany.website}`, 42, 58);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('Salary Slip', 42, 84);
  doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`For ${pad2(item.month)}/${item.year}`, 42, 102);
  line(122);

  textValue('Employee Name:', item.employeeName, 42, 132);
  textValue('Employee ID:', item.employeeCode, 310, 132);
  textValue('Designation:', item.designation || '-', 42, 150);
  textValue('Department:', item.department || '-', 310, 150);
  textValue('Payment Status:', item.paymentStatus || 'Pending', 42, 168);
  textValue('Payroll Status:', item.payrollStatus || '-', 310, 168);
  line(192);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Attendance Summary', 42, 202);
  doc.font('Helvetica').fontSize(10).fillColor('#111827')
    .text(`Working Days: ${item.attendanceSummary.totalWorkingDays}`, 42, 220)
    .text(`Present: ${item.attendanceSummary.presentDays}`, 180, 220)
    .text(`Paid Leave: ${item.attendanceSummary.paidLeaveDays}`, 290, 220)
    .text(`Unpaid Leave: ${item.attendanceSummary.unpaidLeaveDays}`, 430, 220)
    .text(`Half Day: ${item.attendanceSummary.halfDays}`, 42, 238)
    .text(`Late Marks: ${item.attendanceSummary.lateMarks}`, 180, 238)
    .text(`Weekly Off: ${item.attendanceSummary.weeklyOffDays}`, 290, 238)
    .text(`Paid Holiday: ${item.attendanceSummary.paidHolidayDays}`, 430, 238);
  line(264);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Earnings', 42, 274);
  doc.font('Helvetica-Bold').text('Deductions', 310, 274);

  const earningsRows = [
    ['Basic Salary', item.basicSalary],
    ['HRA', item.allowances.hra],
    ['Conveyance', item.allowances.conveyance],
    ['Mobile Allowance', item.allowances.mobile],
    ['Bonus', item.allowances.bonus],
    ['Incentive', item.allowances.incentive],
    ['Other Allowance', item.allowances.other]
  ];
  const deductionRows = [
    ['Leave Deduction', item.deductions.leaveDeduction],
    ['Late Deduction', item.deductions.lateComingDeduction],
    ['Advance Deduction', item.deductions.advanceSalaryDeduction],
    ['Loan Deduction', item.deductions.loanDeduction],
    ['PF', item.deductions.pf],
    ['ESI', item.deductions.esi],
    ['Other Deduction', item.deductions.otherDeduction]
  ];
  const rowHeight = 18;
  for (let i = 0; i < Math.max(earningsRows.length, deductionRows.length); i += 1) {
    const y = 296 + (i * rowHeight);
    const left = earningsRows[i];
    const right = deductionRows[i];
    if (left) {
      doc.font('Helvetica').fontSize(9).fillColor('#111827').text(left[0], 42, y);
      doc.text(amount(left[1]), 225, y, { width: 70, align: 'right' });
    }
    if (right) {
      doc.font('Helvetica').fontSize(9).fillColor('#111827').text(right[0], 310, y);
      doc.text(amount(right[1]), 493, y, { width: 60, align: 'right' });
    }
  }

  const totalY = 296 + (Math.max(earningsRows.length, deductionRows.length) * rowHeight) + 8;
  line(totalY);
  doc.font('Helvetica-Bold').fontSize(10).text('Gross Salary', 42, totalY + 8);
  doc.text(amount(item.grossSalary), 225, totalY + 8, { width: 70, align: 'right' });
  doc.text('Total Deductions', 310, totalY + 8);
  doc.text(amount(item.deductions.total), 493, totalY + 8, { width: 60, align: 'right' });

  const netY = totalY + 32;
  line(netY);
  doc.rect(42, netY + 6, 511, 34).fillAndStroke('#ecfeff', '#bae6fd');
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Net Payable Salary: INR ${amount(item.netSalary)}`, 52, netY + 18);

  const wordsY = netY + 50;
  doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`In Words: ${item.salaryInWords}`, 42, wordsY, { width: 511 });
  doc.font('Helvetica').text(`Authorized Signature`, 430, wordsY + 36);
  doc.moveTo(425, wordsY + 52).lineTo(552, wordsY + 52).strokeColor('#94a3b8').stroke();

  doc.end();
});

const toCsv = (rows) => {
  const escape = (value) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };
  return rows.map((row) => row.map(escape).join(',')).join('\n');
};

function registerPayrollModule({
  app,
  readJsonFile,
  files,
  readSettings,
  serverOrigin
}) {
  const {
    employeesFile,
    attendanceFile,
    salaryStructuresFile,
    holidaysFile,
    advancesFile,
    payrollRunsFile,
    payrollItemsFile,
    salaryPaymentsFile,
    payrollAuditFile
  } = files;

  const getPayrollConfig = () => {
    const current = readJsonFile(payrollRunsFile, { config: defaultPayrollConfig, runs: [] });
    if (Array.isArray(current)) return { config: defaultPayrollConfig, runs: [] };
    return {
      config: { ...defaultPayrollConfig, ...(current.config || {}) },
      runs: Array.isArray(current.runs) ? current.runs : []
    };
  };

  const savePayrollConfigAndRuns = ({ config, runs }) => {
    fs.writeFileSync(payrollRunsFile, JSON.stringify({ config, runs }, null, 2));
  };

  const getItems = () => readJsonFile(payrollItemsFile, []);
  const saveItems = (rows) => fs.writeFileSync(payrollItemsFile, JSON.stringify(rows, null, 2));
  const getStructures = () => readJsonFile(salaryStructuresFile, []).map((entry) => normalizeSalaryStructure(entry));
  const saveStructures = (rows) => fs.writeFileSync(salaryStructuresFile, JSON.stringify(rows, null, 2));
  const getHolidays = () => readJsonFile(holidaysFile, []).map((entry) => normalizeHoliday(entry)).filter((entry) => entry.date);
  const saveHolidays = (rows) => fs.writeFileSync(holidaysFile, JSON.stringify(rows, null, 2));
  const getAdvances = () => readJsonFile(advancesFile, []).map((entry) => normalizeAdvance(entry)).filter((entry) => entry.employeeId);
  const saveAdvances = (rows) => fs.writeFileSync(advancesFile, JSON.stringify(rows, null, 2));
  const getPayments = () => readJsonFile(salaryPaymentsFile, []);
  const savePayments = (rows) => fs.writeFileSync(salaryPaymentsFile, JSON.stringify(rows, null, 2));

  const employeeLookup = () => {
    const employees = readJsonFile(employeesFile, []);
    const map = new Map();
    employees.forEach((entry) => {
      map.set(normalizeText(entry?._id), entry || {});
    });
    return map;
  };

  const enrichPayrollItemWithEmployee = (item, lookup) => {
    const employee = lookup.get(normalizeText(item?.employeeId));
    if (!employee) return item;
    const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
    return {
      ...item,
      employeeName: fullName || item.employeeName || employee.empCode || 'Employee',
      employeeCode: normalizeText(employee.empCode || item.employeeCode || ''),
      designation: normalizeText(employee.roleName || item.designation || ''),
      department: normalizeText(employee.role || item.department || ''),
      employeeDetails: {
        mobile: normalizeText(employee.mobile || ''),
        email: normalizeText(employee.emailId || employee.email || ''),
        bankName: normalizeText(employee.bankName || ''),
        bankNo: normalizeText(employee.bankNo || ''),
        ifsc: normalizeText(employee.ifsc || ''),
        city: normalizeText(employee.city || '')
      }
    };
  };

  const enrichPayrollItems = (rows) => {
    const lookup = employeeLookup();
    return (Array.isArray(rows) ? rows : []).map((entry) => enrichPayrollItemWithEmployee(entry, lookup));
  };

  const findItemById = (id) => {
    const rows = getItems();
    const match = rows.find((entry) => normalizeText(entry._id) === normalizeText(id));
    if (!match) return null;
    return enrichPayrollItemWithEmployee(match, employeeLookup());
  };

  const ensureAccess = (req, res, test, errorText = 'Permission denied') => {
    const role = getRoleFromReq(req);
    const perms = roleToPermissions(role);
    if (!test(perms)) {
      res.status(403).json({ error: errorText });
      return null;
    }
    return perms;
  };

  const getRequestIdentity = (req, perms) => {
    const safePerms = perms || roleToPermissions(getRoleFromReq(req));
    const ownOnly = !(safePerms.canManageAll || safePerms.canGenerate || safePerms.canMarkPaid);
    return {
      ownOnly,
      employeeId: getActorEmployeeId(req),
      actorName: getActorName(req)
    };
  };

  const ensureOwnIdentity = (identity, res) => {
    if (!identity.ownOnly) return true;
    if (!identity.employeeId) {
      res.status(403).json({ error: 'Missing employee identity. Please login again.' });
      return false;
    }
    return true;
  };

  const canAccessItem = (item, identity) => {
    if (!identity.ownOnly) return true;
    if (!identity.employeeId) return false;
    return normalizeText(item?.employeeId) === normalizeText(identity.employeeId);
  };

  app.get('/api/payroll/meta', (req, res) => {
    const { config } = getPayrollConfig();
    res.json({
      config,
      statuses: Array.from(allowedPayrollStatus),
      paymentModes: Array.from(allowedPaymentMode)
    });
  });

  app.post('/api/payroll/meta', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can update payroll settings');
    if (!perms) return;
    const { config, runs } = getPayrollConfig();
    const nextConfig = {
      ...config,
      weeklyOffDay: Math.min(6, Math.max(0, toNumber(req.body?.weeklyOffDay, config.weeklyOffDay))),
      lateMarkGraceMinutes: Math.max(0, toNumber(req.body?.lateMarkGraceMinutes, config.lateMarkGraceMinutes)),
      workStartTime: normalizeText(req.body?.workStartTime || config.workStartTime)
    };
    savePayrollConfigAndRuns({ config: nextConfig, runs });
    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'payroll_config_updated',
      payload: { nextConfig }
    });
    res.json({ message: 'Payroll settings updated', config: nextConfig });
  });

  app.get('/api/payroll/salary-structures', (req, res) => {
    const employeeId = normalizeText(req.query.employeeId || '');
    const rows = getStructures().filter((entry) => (employeeId ? entry.employeeId === employeeId : true));
    rows.sort((a, b) => `${a.employeeId}-${a.effectiveDate}`.localeCompare(`${b.employeeId}-${b.effectiveDate}`));
    res.json(rows);
  });

  app.post('/api/payroll/salary-structures', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can manage salary structures');
    if (!perms) return;
    const payload = normalizeSalaryStructure(req.body || {});
    if (!payload.employeeId) return res.status(400).json({ error: 'employeeId is required' });
    if (!payload.effectiveDate) return res.status(400).json({ error: 'effectiveDate is required' });
    if (payload.salaryType === 'monthly' && payload.basicSalary <= 0) return res.status(400).json({ error: 'basicSalary should be greater than zero' });
    if (payload.salaryType === 'daily' && payload.dailyRate <= 0) return res.status(400).json({ error: 'dailyRate should be greater than zero' });
    if (payload.salaryType === 'hourly' && payload.hourlyRate <= 0) return res.status(400).json({ error: 'hourlyRate should be greater than zero' });

    const rows = getStructures();
    const index = rows.findIndex((entry) => entry.employeeId === payload.employeeId && entry.effectiveDate === payload.effectiveDate);
    if (index >= 0) {
      rows[index] = {
        ...rows[index],
        ...payload,
        _id: rows[index]._id,
        updatedAt: new Date().toISOString()
      };
    } else {
      rows.push(payload);
    }
    saveStructures(rows);
    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'salary_structure_saved',
      payload
    });
    res.json(payload);
  });

  app.post('/api/payroll/salary-structures/sync-employees', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can sync salary structures');
    if (!perms) return;
    const updateExisting = req.body?.updateExisting === true;
    const employees = readJsonFile(employeesFile, []);
    const structures = getStructures();
    const byEmployee = new Map();
    structures.forEach((entry) => {
      const id = normalizeText(entry.employeeId);
      if (!id) return;
      const list = byEmployee.get(id) || [];
      list.push(entry);
      byEmployee.set(id, list);
    });

    const today = new Date().toISOString().slice(0, 10);
    let createdCount = 0;
    let updatedCount = 0;

    employees.forEach((employee) => {
      const employeeId = normalizeText(employee?._id);
      if (!employeeId) return;
      const list = byEmployee.get(employeeId) || [];
      const fallbackSalary = Math.max(0, toNumber(employee?.salaryPerMonth ?? employee?.salary, 0));
      if (list.length === 0) {
        structures.push(normalizeSalaryStructure({
          employeeId,
          effectiveDate: today,
          salaryType: 'monthly',
          basicSalary: fallbackSalary,
          allowances: { hra: 0, conveyance: 0, mobile: 0, bonus: 0, incentive: 0, other: 0 },
          deductions: { leave: 0, late: 0, advance: 0, loan: 0, pf: 0, esi: 0, other: 0, latePerMark: 0 },
          notes: 'Auto-created from Employee Master sync'
        }));
        createdCount += 1;
        return;
      }
      if (!updateExisting) return;
      list.sort((a, b) => String(a.effectiveDate || '').localeCompare(String(b.effectiveDate || '')));
      const latest = list[list.length - 1];
      const index = structures.findIndex((entry) => normalizeText(entry._id) === normalizeText(latest._id));
      if (index < 0) return;
      structures[index] = {
        ...structures[index],
        basicSalary: fallbackSalary > 0 ? fallbackSalary : structures[index].basicSalary,
        updatedAt: new Date().toISOString(),
        notes: normalizeText(structures[index].notes || 'Auto-synced from Employee Master')
      };
      updatedCount += 1;
    });

    saveStructures(structures);
    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'salary_structure_employee_master_sync',
      payload: { createdCount, updatedCount, updateExisting }
    });
    res.json({ message: 'Employee Master sync completed', createdCount, updatedCount });
  });

  app.get('/api/payroll/salary-structures/:employeeId/current', (req, res) => {
    const employeeId = normalizeText(req.params.employeeId);
    const date = normalizeText(req.query.date || new Date().toISOString().slice(0, 10));
    const selected = selectCurrentStructure(getStructures(), employeeId, date);
    if (!selected) return res.status(404).json({ error: 'Salary structure not found' });
    res.json(selected);
  });

  app.get('/api/payroll/holidays', (req, res) => {
    const month = toNumber(req.query.month, 0);
    const year = toNumber(req.query.year, 0);
    const rows = getHolidays();
    if (!month || !year) return res.json(rows);
    const startKey = `${year}-${pad2(month)}-01`;
    const end = monthDateRange(month, year).end;
    const endKey = toDateKey(end);
    res.json(rows.filter((entry) => entry.date >= startKey && entry.date <= endKey));
  });

  app.post('/api/payroll/holidays', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can manage holidays');
    if (!perms) return;
    const payload = normalizeHoliday(req.body || {});
    if (!payload.date) return res.status(400).json({ error: 'Valid holiday date is required' });
    const rows = getHolidays();
    const index = rows.findIndex((entry) => entry._id === payload._id || entry.date === payload.date);
    if (index >= 0) {
      rows[index] = { ...rows[index], ...payload, _id: rows[index]._id, updatedAt: new Date().toISOString() };
    } else {
      rows.push(payload);
    }
    saveHolidays(rows);
    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'holiday_saved',
      payload
    });
    res.json(payload);
  });

  app.delete('/api/payroll/holidays/:id', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can delete holidays');
    if (!perms) return;
    const id = normalizeText(req.params.id);
    const rows = getHolidays();
    const next = rows.filter((entry) => entry._id !== id);
    if (next.length === rows.length) return res.status(404).json({ error: 'Holiday not found' });
    saveHolidays(next);
    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'holiday_deleted',
      payload: { id }
    });
    res.json({ message: 'Holiday deleted' });
  });

  app.get('/api/payroll/advances', (req, res) => {
    const perms = roleToPermissions(getRoleFromReq(req));
    const identity = getRequestIdentity(req, perms);
    if (!ensureOwnIdentity(identity, res)) return;
    const employeeId = normalizeText(req.query.employeeId || '');
    const status = normalizeRole(req.query.status || '');
    const rows = getAdvances().filter((entry) => {
      if (identity.ownOnly && normalizeText(entry.employeeId) !== identity.employeeId) return false;
      if (employeeId && entry.employeeId !== employeeId) return false;
      if (status && normalizeRole(entry.status) !== status) return false;
      return true;
    });
    res.json(rows);
  });

  app.post('/api/payroll/advances', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can manage advance salary');
    if (!perms) return;
    const payload = normalizeAdvance(req.body || {});
    if (!payload.employeeId) return res.status(400).json({ error: 'employeeId is required' });
    if (payload.amount <= 0) return res.status(400).json({ error: 'amount should be greater than zero' });
    const rows = getAdvances();
    const index = rows.findIndex((entry) => entry._id === payload._id);
    if (index >= 0) rows[index] = { ...rows[index], ...payload, _id: rows[index]._id, updatedAt: new Date().toISOString() };
    else rows.push(payload);
    saveAdvances(rows);
    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'advance_saved',
      payload
    });
    res.json(payload);
  });

  const deleteAdvanceById = (req, res, idInput) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can delete advance salary');
    if (!perms) return;
    const id = normalizeText(idInput);
    if (!id) return res.status(400).json({ error: 'Advance id is required' });
    const rows = getAdvances();
    const current = rows.find((entry) => normalizeText(entry._id) === id);
    if (!current) return res.status(404).json({ error: 'Advance record not found' });
    const next = rows.filter((entry) => normalizeText(entry._id) !== id);
    saveAdvances(next);
    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'advance_deleted',
      payload: { id, employeeId: current.employeeId, amount: current.amount }
    });
    res.json({ message: 'Advance record deleted' });
  };

  app.delete('/api/payroll/advances/:id', (req, res) => {
    deleteAdvanceById(req, res, req.params.id);
  });

  // Compatibility route for environments/proxies where DELETE may be blocked.
  app.post('/api/payroll/advances/:id/delete', (req, res) => {
    deleteAdvanceById(req, res, req.params.id);
  });

  // Body-based compatibility route: { id: "ADV-..." }
  app.post('/api/payroll/advances/delete', (req, res) => {
    deleteAdvanceById(req, res, req.body?.id);
  });

  app.post('/api/payroll/calculate', (req, res) => {
    const employeeId = normalizeText(req.body?.employeeId);
    const month = toNumber(req.body?.month, 0);
    const year = toNumber(req.body?.year, 0);
    if (!employeeId || !month || !year) return res.status(400).json({ error: 'employeeId, month, year are required' });

    const employees = readJsonFile(employeesFile, []);
    const attendance = readJsonFile(attendanceFile, []);
    const employee = employees.find((entry) => normalizeText(entry._id) === employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const structures = getStructures();
    const holidays = getHolidays();
    const advances = getAdvances();
    const { config } = getPayrollConfig();
    const structure = selectCurrentStructure(structures, employeeId, `${year}-${pad2(month)}-31`) || normalizeSalaryStructure({
      employeeId,
      salaryType: 'monthly',
      basicSalary: toNumber(employee.salaryPerMonth ?? employee.salary, 0),
      effectiveDate: `${year}-${pad2(month)}-01`
    });
    const summary = summarizeAttendanceForPayroll({
      employeeId,
      month,
      year,
      attendance,
      holidays,
      weeklyOffDay: config.weeklyOffDay,
      lateMarkGraceMinutes: config.lateMarkGraceMinutes,
      workStartTime: config.workStartTime
    });
    const result = calcPayrollItem({
      employee,
      structure,
      attendanceSummary: summary,
      advances,
      month,
      year,
      manualOverride: req.body?.manualOverride || {}
    });
    res.json(result);
  });

  app.post('/api/payroll/generate', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canGenerate, 'Only Admin/HR can generate payroll');
    if (!perms) return;
    const month = toNumber(req.body?.month, 0);
    const year = toNumber(req.body?.year, 0);
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' });
    const selectedEmployeeIds = Array.isArray(req.body?.employeeIds)
      ? req.body.employeeIds.map((entry) => normalizeText(entry)).filter(Boolean)
      : [];
    const forceRegenerate = req.body?.forceRegenerate === true;

    const employees = readJsonFile(employeesFile, []);
    const attendance = readJsonFile(attendanceFile, []);
    const structures = getStructures();
    const holidays = getHolidays();
    const advances = getAdvances();
    const { config, runs } = getPayrollConfig();
    const items = getItems();

    const scope = selectedEmployeeIds.length > 0
      ? employees.filter((entry) => selectedEmployeeIds.includes(normalizeText(entry._id)))
      : employees;

    const generated = [];
    const skipped = [];

    scope.forEach((employee) => {
      const employeeId = normalizeText(employee._id);
      if (!employeeId) return;
      const existingIndex = items.findIndex((entry) => normalizeText(entry.employeeId) === employeeId && toNumber(entry.month, 0) === month && toNumber(entry.year, 0) === year);
      const existing = existingIndex >= 0 ? items[existingIndex] : null;
      if (existing && normalizeText(existing.payrollStatus) === 'Paid') {
        skipped.push({ employeeId, reason: 'Already paid and locked' });
        return;
      }
      if (existing && !forceRegenerate && normalizeText(existing.payrollStatus) !== 'Draft' && normalizeText(existing.payrollStatus) !== 'Hold') {
        skipped.push({ employeeId, reason: 'Payroll already generated. Use force regenerate before payment.' });
        return;
      }

      const structure = selectCurrentStructure(structures, employeeId, `${year}-${pad2(month)}-31`) || normalizeSalaryStructure({
        employeeId,
        salaryType: 'monthly',
        basicSalary: toNumber(employee.salaryPerMonth ?? employee.salary, 0),
        effectiveDate: `${year}-${pad2(month)}-01`
      });
      const attendanceSummary = summarizeAttendanceForPayroll({
        employeeId,
        month,
        year,
        attendance,
        holidays,
        weeklyOffDay: config.weeklyOffDay,
        lateMarkGraceMinutes: config.lateMarkGraceMinutes,
        workStartTime: config.workStartTime
      });

      const nextItem = calcPayrollItem({
        employee,
        structure,
        attendanceSummary,
        advances,
        month,
        year,
        manualOverride: existing || {}
      });

      if (existingIndex >= 0) items[existingIndex] = { ...existing, ...nextItem, _id: existing._id, createdAt: existing.createdAt || nextItem.createdAt };
      else items.push(nextItem);
      generated.push(nextItem);
    });

    saveItems(items);

    const run = {
      _id: `PRUN-${Date.now()}`,
      month,
      year,
      status: 'Generated',
      generatedCount: generated.length,
      skippedCount: skipped.length,
      selectedEmployeeCount: scope.length,
      createdAt: new Date().toISOString(),
      actor: getActorName(req)
    };
    runs.push(run);
    savePayrollConfigAndRuns({ config, runs });

    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'payroll_generated',
      payload: { month, year, generated: generated.length, skipped: skipped.length }
    });

    res.json({ message: 'Payroll generated', run, generated, skipped });
  });

  app.get('/api/payroll/runs', (req, res) => {
    const { runs } = getPayrollConfig();
    res.json([...runs].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
  });

  app.get('/api/payroll/items', (req, res) => {
    const perms = roleToPermissions(getRoleFromReq(req));
    const identity = getRequestIdentity(req, perms);
    if (!ensureOwnIdentity(identity, res)) return;
    const month = toNumber(req.query.month, 0);
    const year = toNumber(req.query.year, 0);
    const employeeId = normalizeText(req.query.employeeId || '');
    const department = normalizeRole(req.query.department || '');
    const paymentStatus = normalizeRole(req.query.paymentStatus || '');
    const payrollStatus = normalizeRole(req.query.payrollStatus || '');
    const search = normalizeRole(req.query.search || '');

    const rows = enrichPayrollItems(getItems()).filter((entry) => {
      if (identity.ownOnly && normalizeText(entry.employeeId) !== identity.employeeId) return false;
      if (month && toNumber(entry.month, 0) !== month) return false;
      if (year && toNumber(entry.year, 0) !== year) return false;
      if (employeeId && normalizeText(entry.employeeId) !== employeeId) return false;
      if (department && normalizeRole(entry.department) !== department) return false;
      if (paymentStatus && normalizeRole(entry.paymentStatus) !== paymentStatus) return false;
      if (payrollStatus && normalizeRole(entry.payrollStatus) !== payrollStatus) return false;
      if (search) {
        const searchText = `${entry.employeeName || ''} ${entry.employeeCode || ''}`.toLowerCase();
        if (!searchText.includes(search)) return false;
      }
      return true;
    });
    rows.sort((a, b) => `${b.year}-${pad2(b.month)}-${b.employeeName}`.localeCompare(`${a.year}-${pad2(a.month)}-${a.employeeName}`));
    res.json(rows);
  });

  app.get('/api/payroll/items/:id', (req, res) => {
    const perms = roleToPermissions(getRoleFromReq(req));
    const identity = getRequestIdentity(req, perms);
    if (!ensureOwnIdentity(identity, res)) return;
    const item = findItemById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Payroll item not found' });
    if (!canAccessItem(item, identity)) return res.status(403).json({ error: 'You can only view your own salary slip.' });
    res.json(item);
  });

  app.put('/api/payroll/items/:id', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll || p.canGenerate, 'Only Admin/HR can update payroll');
    if (!perms) return;
    const rows = getItems();
    const index = rows.findIndex((entry) => normalizeText(entry._id) === normalizeText(req.params.id));
    if (index === -1) return res.status(404).json({ error: 'Payroll item not found' });
    const current = rows[index];
    if (normalizeText(current.payrollStatus) === 'Paid' && !req.body?.unlock) {
      return res.status(400).json({ error: 'Salary slip is locked after payment. Unlock first.' });
    }

    const nextStatus = normalizeText(req.body?.payrollStatus || current.payrollStatus);
    const validStatus = allowedPayrollStatus.has(nextStatus) ? nextStatus : current.payrollStatus;
    const adjusted = {
      ...current,
      payrollStatus: validStatus,
      manualAdjustmentAmount: round2(toNumber(req.body?.manualAdjustmentAmount, current.manualAdjustmentAmount || 0)),
      manualAdjustmentReason: normalizeText(req.body?.manualAdjustmentReason || current.manualAdjustmentReason || ''),
      manualOverrideEnabled: req.body?.manualOverrideEnabled !== undefined ? !!req.body.manualOverrideEnabled : !!current.manualOverrideEnabled,
      overrideNetSalary: req.body?.overrideNetSalary !== undefined ? round2(toNumber(req.body.overrideNetSalary, current.overrideNetSalary || current.netSalary || 0)) : current.overrideNetSalary,
      paymentStatus: normalizeText(req.body?.paymentStatus || current.paymentStatus || 'Pending'),
      isLocked: req.body?.unlock ? false : current.isLocked,
      updatedAt: new Date().toISOString()
    };

    if (nextStatus === 'Hold') adjusted.paymentStatus = 'Hold';
    if (nextStatus === 'Paid') {
      adjusted.paymentStatus = 'Paid';
      adjusted.isLocked = true;
    }
    const computedNet = round2(toNumber(current.computedNetSalary, current.netSalary));
    if (adjusted.manualOverrideEnabled) adjusted.netSalary = round2(toNumber(adjusted.overrideNetSalary, adjusted.netSalary));
    else adjusted.netSalary = round2(computedNet + toNumber(adjusted.manualAdjustmentAmount, 0));
    adjusted.salaryInWords = buildMoneyWords(adjusted.netSalary);

    rows[index] = adjusted;
    saveItems(rows);
    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: req.body?.unlock ? 'payroll_item_unlocked' : 'payroll_item_updated',
      payload: { id: adjusted._id, changes: req.body || {} }
    });
    res.json(adjusted);
  });

  app.post('/api/payroll/items/:id/mark-paid', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canMarkPaid, 'Only Admin/Accountant can mark salary as paid');
    if (!perms) return;
    const mode = normalizeText(req.body?.paymentMode);
    if (!allowedPaymentMode.has(mode)) return res.status(400).json({ error: 'Invalid payment mode' });

    const items = getItems();
    const itemIndex = items.findIndex((entry) => normalizeText(entry._id) === normalizeText(req.params.id));
    if (itemIndex === -1) return res.status(404).json({ error: 'Payroll item not found' });
    const current = items[itemIndex];
    if (current.isLocked && normalizeText(current.payrollStatus) === 'Paid') {
      return res.status(400).json({ error: 'Salary already marked as paid and locked' });
    }
    const paidAt = normalizeText(req.body?.paymentDate || new Date().toISOString().slice(0, 10));
    const actor = getActorName(req);
    const next = {
      ...current,
      payrollStatus: 'Paid',
      paymentStatus: 'Paid',
      paymentMode: mode,
      paidAt,
      paidBy: actor,
      transactionRef: normalizeText(req.body?.transactionRef || ''),
      paymentRemarks: normalizeText(req.body?.remarks || ''),
      isLocked: true,
      updatedAt: new Date().toISOString()
    };
    items[itemIndex] = next;
    saveItems(items);

    const payments = getPayments();
    payments.push({
      _id: `SPAY-${Date.now()}`,
      payrollItemId: next._id,
      employeeId: next.employeeId,
      month: next.month,
      year: next.year,
      amount: next.netSalary,
      paymentMode: next.paymentMode,
      paymentDate: paidAt,
      transactionRef: next.transactionRef,
      remarks: next.paymentRemarks,
      createdAt: new Date().toISOString(),
      createdBy: actor
    });
    savePayments(payments);

    const advances = getAdvances();
    let advancesChanged = false;
    const breakdownById = new Map((next.advanceBreakdown || []).map((entry) => [normalizeText(entry.advanceId), toNumber(entry.deductionAmount, 0)]));
    const nextAdvances = advances.map((entry) => {
      const take = breakdownById.get(normalizeText(entry._id));
      if (!take || take <= 0) return entry;
      const recoveredAmount = round2(Math.min(entry.amount, toNumber(entry.recoveredAmount, 0) + take));
      advancesChanged = true;
      return {
        ...entry,
        recoveredAmount,
        balanceAmount: round2(Math.max(0, entry.amount - recoveredAmount)),
        status: recoveredAmount >= entry.amount ? 'Closed' : 'Open',
        updatedAt: new Date().toISOString()
      };
    });
    if (advancesChanged) saveAdvances(nextAdvances);

    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor,
      action: 'salary_marked_paid',
      payload: { payrollItemId: next._id, amount: next.netSalary, mode }
    });
    res.json(next);
  });

  app.get('/api/payroll/items/:id/slip/pdf', async (req, res) => {
    try {
      const perms = roleToPermissions(getRoleFromReq(req));
      const identity = getRequestIdentity(req, perms);
      if (!ensureOwnIdentity(identity, res)) return;
      const item = findItemById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Payroll item not found' });
      if (!canAccessItem(item, identity)) return res.status(403).json({ error: 'You can only view your own salary slip.' });
      const settings = readSettings ? (readSettings() || {}) : {};
      const company = {
        companyName: normalizeText(settings?.companyName || defaultCompany.companyName),
        phone: defaultCompany.phone,
        website: defaultCompany.website
      };
      const buffer = await buildSalarySlipPdfBuffer({ item, company });
      const safeName = `${normalizeText(item.employeeCode || item.employeeId || 'EMP')}_${item.year}_${pad2(item.month)}.pdf`.replace(/[^\w.-]+/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${String(req.query.download || '') === '1' ? 'attachment' : 'inline'}; filename="${safeName}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Failed to generate salary slip PDF:', error.message);
      res.status(500).json({ error: 'Could not generate salary slip PDF' });
    }
  });

  app.post('/api/payroll/items/:id/share-email', async (req, res) => {
    try {
      const perms = roleToPermissions(getRoleFromReq(req));
      const identity = getRequestIdentity(req, perms);
      if (!ensureOwnIdentity(identity, res)) return;
      const item = findItemById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Payroll item not found' });
      if (!canAccessItem(item, identity)) return res.status(403).json({ error: 'You can only share your own salary slip.' });

      const employees = readJsonFile(employeesFile, []);
      const employee = employees.find((entry) => normalizeText(entry?._id) === normalizeText(item.employeeId)) || null;
      const recipient = normalizeText(req.body?.to || employee?.emailId || employee?.email || '');
      if (!recipient) return res.status(400).json({ error: 'Recipient email is required' });

      const settings = readSettings ? (readSettings() || {}) : {};
      const mailConfig = resolveEmailConfig(settings);
      if (String(mailConfig.active || 'Yes').toLowerCase() !== 'yes') {
        return res.status(400).json({ error: 'Email sender is disabled in settings. Enable it first.' });
      }
      if (!mailConfig.host || !mailConfig.user || !mailConfig.pass || !mailConfig.fromEmail) {
        return res.status(400).json({ error: 'SMTP settings are incomplete. Configure host, user, pass and from email in Settings.' });
      }

      const company = {
        companyName: normalizeText(settings?.companyName || defaultCompany.companyName),
        phone: defaultCompany.phone,
        website: defaultCompany.website
      };
      const pdfBuffer = await buildSalarySlipPdfBuffer({ item, company });
      const fileName = `${normalizeText(item.employeeCode || item.employeeId || 'EMP')}_${item.year}_${pad2(item.month)}.pdf`.replace(/[^\w.-]+/g, '_');
      const subject = normalizeText(req.body?.subject || `Salary Slip ${pad2(item.month)}/${item.year} - ${item.employeeName}`);
      const message = normalizeText(req.body?.message || `Dear ${item.employeeName},\nPlease find attached your salary slip for ${pad2(item.month)}/${item.year}.\n\n${company.companyName}`);

      const transporter = nodemailer.createTransport({
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        auth: { user: mailConfig.user, pass: mailConfig.pass }
      });

      await transporter.sendMail({
        from: mailConfig.fromName
          ? `"${String(mailConfig.fromName).replace(/"/g, '\\"')}" <${mailConfig.fromEmail}>`
          : mailConfig.fromEmail,
        to: recipient,
        subject,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });

      writeAudit({
        auditFile: payrollAuditFile,
        readJsonFile,
        actor: getActorName(req),
        action: 'salary_slip_shared_email',
        payload: { payrollItemId: item._id, to: recipient }
      });

      res.json({ message: 'Salary slip email sent successfully', to: recipient });
    } catch (error) {
      console.error('Failed to share salary slip via email:', error.message);
      res.status(500).json({ error: 'Could not send salary slip email' });
    }
  });

  app.post('/api/payroll/items/:id/share-whatsapp', async (req, res) => {
    try {
      const perms = roleToPermissions(getRoleFromReq(req));
      const identity = getRequestIdentity(req, perms);
      if (!ensureOwnIdentity(identity, res)) return;
      const item = findItemById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Payroll item not found' });
      if (!canAccessItem(item, identity)) return res.status(403).json({ error: 'You can only share your own salary slip.' });

      const employees = readJsonFile(employeesFile, []);
      const employee = employees.find((entry) => normalizeText(entry?._id) === normalizeText(item.employeeId)) || null;
      const phone = normalizeWhatsappPhone(req.body?.phoneNumber || employee?.mobile || '');
      if (!phone) return res.status(400).json({ error: 'Valid WhatsApp phone number is required' });

      const settings = readSettings ? (readSettings() || {}) : {};
      const waConfig = resolveWhatsappConfig(settings);
      if (!waConfig.phoneNumberId || !waConfig.accessToken) {
        return res.status(400).json({ error: 'WhatsApp API settings are incomplete. Configure Phone Number ID and Access Token in Settings.' });
      }

      const company = {
        companyName: normalizeText(settings?.companyName || defaultCompany.companyName),
        phone: defaultCompany.phone,
        website: defaultCompany.website
      };
      const pdfBuffer = await buildSalarySlipPdfBuffer({ item, company });
      const fileName = `${normalizeText(item.employeeCode || item.employeeId || 'EMP')}_${item.year}_${pad2(item.month)}.pdf`.replace(/[^\w.-]+/g, '_');
      const graphBase = `https://graph.facebook.com/${waConfig.apiVersion}`;
      const shareLink = `${serverOrigin || 'http://localhost:5000'}/api/payroll/items/${item._id}/slip/pdf?download=1&role=Employee&userId=${encodeURIComponent(item.employeeId || '')}&userName=${encodeURIComponent(item.employeeName || '')}`;
      const caption = String(req.body?.message || `Salary slip for ${pad2(item.month)}/${item.year}\n${company.companyName}\n${shareLink}`).trim().slice(0, 1024);

      const mediaForm = new FormData();
      mediaForm.append('messaging_product', 'whatsapp');
      mediaForm.append('type', 'application/pdf');
      mediaForm.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), fileName);

      const uploadResponse = await fetch(`${graphBase}/${waConfig.phoneNumberId}/media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${waConfig.accessToken}`
        },
        body: mediaForm
      });
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('WhatsApp payroll media upload failed:', errorText);
        return res.status(502).json({ error: 'Could not upload salary slip to WhatsApp API' });
      }
      const uploadJson = await uploadResponse.json();
      const mediaId = uploadJson?.id;
      if (!mediaId) return res.status(502).json({ error: 'WhatsApp media upload did not return media id' });

      const sendDocResponse = await fetch(`${graphBase}/${waConfig.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${waConfig.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'document',
          document: {
            id: mediaId,
            filename: fileName,
            caption
          }
        })
      });
      if (!sendDocResponse.ok) {
        const errorText = await sendDocResponse.text();
        console.error('WhatsApp payroll document send failed:', errorText);
        return res.status(502).json({ error: 'Could not send salary slip on WhatsApp' });
      }
      const sendDocJson = await sendDocResponse.json();

      writeAudit({
        auditFile: payrollAuditFile,
        readJsonFile,
        actor: getActorName(req),
        action: 'salary_slip_shared_whatsapp',
        payload: { payrollItemId: item._id, to: phone }
      });

      res.json({ message: 'Salary slip sent on WhatsApp successfully', phone, whatsappResponse: sendDocJson });
    } catch (error) {
      console.error('Failed to share salary slip on WhatsApp:', error.message);
      res.status(500).json({ error: 'Could not send salary slip on WhatsApp' });
    }
  });

  app.get('/api/payroll/dashboard', (req, res) => {
    const perms = roleToPermissions(getRoleFromReq(req));
    const identity = getRequestIdentity(req, perms);
    if (!ensureOwnIdentity(identity, res)) return;
    const now = new Date();
    const month = toNumber(req.query.month, now.getMonth() + 1);
    const year = toNumber(req.query.year, now.getFullYear());
    const rows = enrichPayrollItems(getItems()).filter((entry) => {
      if (identity.ownOnly && normalizeText(entry.employeeId) !== identity.employeeId) return false;
      return toNumber(entry.month, 0) === month && toNumber(entry.year, 0) === year;
    });
    const sum = (list, mapFn) => round2(list.reduce((acc, item) => acc + toNumber(mapFn(item), 0), 0));
    const paidRows = rows.filter((entry) => normalizeRole(entry.paymentStatus) === 'paid');
    const pendingRows = rows.filter((entry) => normalizeRole(entry.paymentStatus) !== 'paid');
    const holdRows = rows.filter((entry) => normalizeRole(entry.payrollStatus) === 'hold');
    const totalAllowances = sum(rows, (item) => item.allowances?.total || 0);
    const totalDeductions = sum(rows, (item) => item.deductions?.total || 0);
    const totalMonthlyPayroll = sum(rows, (item) => item.netSalary || 0);
    const paidAmount = sum(paidRows, (item) => item.netSalary || 0);
    const pendingAmount = sum(pendingRows, (item) => item.netSalary || 0);
    const advances = getAdvances().filter((entry) => (identity.ownOnly ? normalizeText(entry.employeeId) === identity.employeeId : true));
    const advanceBalance = sum(advances, (item) => item.balanceAmount || 0);

    const allItems = enrichPayrollItems(getItems()).filter((entry) => (identity.ownOnly ? normalizeText(entry.employeeId) === identity.employeeId : true));
    const monthlyMap = new Map();
    allItems.forEach((entry) => {
      const key = `${entry.year}-${pad2(entry.month)}`;
      monthlyMap.set(key, round2((monthlyMap.get(key) || 0) + toNumber(entry.netSalary, 0)));
    });
    const monthWiseChart = Array.from(monthlyMap.entries())
      .map(([key, value]) => ({ key, total: value }))
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12);

    const deptMap = new Map();
    rows.forEach((entry) => {
      const key = normalizeText(entry.department || 'Unassigned') || 'Unassigned';
      deptMap.set(key, round2((deptMap.get(key) || 0) + toNumber(entry.netSalary, 0)));
    });
    const departmentWiseExpense = Array.from(deptMap.entries()).map(([department, total]) => ({ department, total }));

    res.json({
      month,
      year,
      cards: {
        totalMonthlyPayroll,
        paidSalaryAmount: paidAmount,
        pendingSalaryAmount: pendingAmount,
        employeesOnHold: holdRows.length,
        totalDeductions,
        totalAllowances,
        advanceSalaryBalance: advanceBalance
      },
      monthWiseChart,
      departmentWiseExpense
    });
  });

  app.get('/api/payroll/reports', (req, res) => {
    const perms = roleToPermissions(getRoleFromReq(req));
    const identity = getRequestIdentity(req, perms);
    if (!ensureOwnIdentity(identity, res)) return;
    const month = toNumber(req.query.month, 0);
    const year = toNumber(req.query.year, 0);
    const employeeId = normalizeText(req.query.employeeId || '');
    const type = normalizeRole(req.query.type || 'monthly');
    const format = normalizeRole(req.query.format || 'json');

    const rows = enrichPayrollItems(getItems()).filter((entry) => {
      if (identity.ownOnly && normalizeText(entry.employeeId) !== identity.employeeId) return false;
      if (month && toNumber(entry.month, 0) !== month) return false;
      if (year && toNumber(entry.year, 0) !== year) return false;
      if (employeeId && normalizeText(entry.employeeId) !== employeeId) return false;
      return true;
    });

    const deductionRows = rows.map((entry) => ({
      employeeCode: entry.employeeCode,
      employeeName: entry.employeeName,
      month: entry.month,
      year: entry.year,
      leaveDeduction: round2(entry.deductions?.leaveDeduction || 0),
      lateDeduction: round2(entry.deductions?.lateComingDeduction || 0),
      advanceDeduction: round2(entry.deductions?.advanceSalaryDeduction || 0),
      loanDeduction: round2(entry.deductions?.loanDeduction || 0),
      pf: round2(entry.deductions?.pf || 0),
      esi: round2(entry.deductions?.esi || 0),
      other: round2(entry.deductions?.otherDeduction || 0),
      totalDeduction: round2(entry.deductions?.total || 0)
    }));
    const advanceRows = getAdvances()
      .filter((entry) => (identity.ownOnly ? normalizeText(entry.employeeId) === identity.employeeId : true))
      .map((entry) => ({
      employeeId: entry.employeeId,
      amount: entry.amount,
      recoveredAmount: entry.recoveredAmount,
      balanceAmount: entry.balanceAmount,
      monthlyDeduction: entry.monthlyDeduction,
      status: entry.status,
      issuedDate: entry.issuedDate
    }));

    const reportPayload = {
      monthlyPayrollReport: rows,
      employeeWiseSalaryReport: rows,
      deductionReport: deductionRows,
      advanceSalaryReport: advanceRows
    };

    const key = (
      type === 'employee-wise' ? 'employeeWiseSalaryReport'
        : type === 'deduction' ? 'deductionReport'
          : type === 'advance' ? 'advanceSalaryReport'
            : 'monthlyPayrollReport'
    );
    const selectedRows = reportPayload[key];
    if (format === 'excel' || format === 'csv') {
      const headers = Object.keys(selectedRows[0] || { message: 'No data' });
      const csv = toCsv([headers, ...selectedRows.map((row) => headers.map((h) => row[h]))]);
      const fileName = `payroll_${type}_${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(csv);
    }
    if (format === 'pdf') {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const fileName = `payroll_${type}_${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(Buffer.concat(chunks));
      });
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('SKUAS Pest Control - Payroll Report');
      doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Type: ${type} | Month: ${month || 'All'} | Year: ${year || 'All'} | Generated: ${new Date().toLocaleString()}`);
      doc.moveDown(0.6);
      const headers = Object.keys(selectedRows[0] || { message: 'No data' });
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text(headers.join(' | '));
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(8).fillColor('#111827');
      selectedRows.slice(0, 300).forEach((row) => {
        const line = headers.map((keyName) => String(row[keyName] ?? '')).join(' | ');
        doc.text(line, { width: 530 });
      });
      doc.end();
      return;
    }
    res.json({ type, rows: selectedRows });
  });

  app.post('/api/payroll/seed-sample', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can seed payroll sample data');
    if (!perms) return;
    const employees = readJsonFile(employeesFile, []);
    if (employees.length === 0) return res.status(400).json({ error: 'No employees found for seeding' });

    const structures = getStructures();
    const existingEmpSet = new Set(structures.map((entry) => normalizeText(entry.employeeId)));
    const seeds = [];
    employees.forEach((emp, index) => {
      if (existingEmpSet.has(normalizeText(emp._id))) return;
      seeds.push(normalizeSalaryStructure({
        employeeId: emp._id,
        effectiveDate: `${new Date().getFullYear()}-01-01`,
        salaryType: 'monthly',
        basicSalary: toNumber(emp.salaryPerMonth ?? emp.salary, 0),
        allowances: {
          hra: 1200 + (index * 100),
          conveyance: 800,
          mobile: 500,
          bonus: 0,
          incentive: 0,
          other: 0
        },
        deductions: {
          leave: 0,
          late: 0,
          advance: 0,
          loan: 0,
          pf: 0,
          esi: 0,
          other: 0,
          latePerMark: 100
        }
      }));
    });
    if (seeds.length > 0) saveStructures([...structures, ...seeds]);

    const holidays = getHolidays();
    const year = new Date().getFullYear();
    const holidaySamples = [
      { date: `${year}-01-26`, title: 'Republic Day', type: 'paid' },
      { date: `${year}-08-15`, title: 'Independence Day', type: 'paid' }
    ];
    const holidayDateSet = new Set(holidays.map((entry) => entry.date));
    const nextHolidays = [...holidays];
    holidaySamples.forEach((entry) => {
      if (!holidayDateSet.has(entry.date)) nextHolidays.push(normalizeHoliday(entry));
    });
    saveHolidays(nextHolidays);

    const advances = getAdvances();
    if (advances.length === 0 && employees[0]) {
      advances.push(normalizeAdvance({
        employeeId: employees[0]._id,
        amount: 5000,
        monthlyDeduction: 1000,
        deductionMode: 'partial',
        reason: 'Emergency advance',
        issuedDate: new Date().toISOString().slice(0, 10),
        status: 'Open'
      }));
      saveAdvances(advances);
    }

    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'payroll_seed_sample',
      payload: { salaryStructuresCreated: seeds.length }
    });
    res.json({
      message: 'Payroll sample data seeded',
      salaryStructuresCreated: seeds.length,
      holidaysCount: nextHolidays.length
    });
  });

  app.get('/api/payroll/audit', (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can view payroll audit');
    if (!perms) return;
    const rows = readJsonFile(payrollAuditFile, []);
    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json(rows.slice(0, 500));
  });
}

module.exports = {
  registerPayrollModule
};
