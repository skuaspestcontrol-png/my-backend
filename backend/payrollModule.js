const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { syncPayrollJsonFilesToMysql } = require('./lib/autoMigrate');
const { normalizeIndianMobileNumber } = require('./lib/phone');
const { renderQuotationPdfHeader } = require('./quotationPdf');
const { sendEmailMessage, normalizeEmailSettings } = require('./services/email.service');

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
  website: 'www.skuaspestcontrol.com',
  email: '',
  address: ''
};
const uploadsRootDir = normalizeText(
  process.env.UPLOADS_ROOT
  || process.env.UPLOADS_DIR
  || process.env.UPLOADS_ROOT_DIR
  || '/home/u610009593/uploads-skuas-crm'
);
const uploadSearchDirs = [
  uploadsRootDir,
  path.join(__dirname, '..', 'storage', 'uploads'),
  path.join(process.cwd(), 'uploads'),
  path.join(__dirname, 'public', 'uploads'),
  path.join(__dirname, '..', 'public', 'uploads')
].filter(Boolean);

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
  const digits = normalizeIndianMobileNumber(raw);
  if (/^\d{10}$/.test(digits)) return `91${digits}`;
  return '';
};
const resolveWhatsappConfig = (settings = {}) => ({
  apiVersion: settings.whatsappApiVersion || process.env.WHATSAPP_API_VERSION || 'v23.0',
  phoneNumberId: settings.whatsappInstanceId || settings.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  accessToken: settings.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || ''
});

const resolveCompanyDetails = (settings = {}) => {
  const logoCandidates = [
    settings?.gstCompanyLogoUrl,
    settings?.gstCompanyLogo,
    settings?.gstLogoUrl,
    settings?.gstLogo,
    settings?.gstBrandingLogoUrl,
    settings?.nonGstCompanyLogoUrl,
    settings?.dashboardImageUrl,
    settings?.logoUrl,
    settings?.logo_url,
    settings?.logo,
  ].map((value) => normalizeText(value)).filter(Boolean);

  return {
    companyName: normalizeText(
      settings?.gstCompanyName
      || settings?.companyName
      || defaultCompany.companyName
    ),
    tagline: normalizeText(
      settings?.aboutTagline
      || settings?.companyTagline
      || ''
    ),
    phone: normalizeText(
      settings?.gstPhone
      || settings?.companyPhone
      || settings?.companyMobile
      || settings?.phone
      || settings?.mobile
      || defaultCompany.phone
    ),
    alternatePhone: normalizeText(
      settings?.gstAlternatePhone
      || settings?.companyAlternatePhone
      || settings?.nonGstPhone
      || settings?.nonGstAlternatePhone
      || settings?.alternatePhone
      || defaultCompany.alternatePhone
    ),
    website: normalizeText(
      settings?.companyWebsite
      || settings?.website
      || defaultCompany.website
    ),
    email: normalizeText(
      settings?.gstEmail
      || settings?.companyEmail
      || settings?.email
      || defaultCompany.email
    ),
    address: normalizeText(
      settings?.gstBillingAddress
      || settings?.companyAddress
      || settings?.address
      || defaultCompany.address
    ),
    city: normalizeText(settings?.gstCity || settings?.companyCity || ''),
    state: normalizeText(settings?.gstState || settings?.companyState || ''),
    pincode: normalizeText(settings?.gstPincode || settings?.companyPincode || ''),
    gstin: normalizeText(settings?.gstin || settings?.gstNumber || settings?.companyGstNumber || ''),
    logoUrl: logoCandidates[0] || '',
    logoCandidates
  };
};

const tryResolveLocalUploadPath = (rawUrl) => {
  const text = normalizeText(rawUrl);
  if (!text) return '';
  if (/^data:image\//i.test(text)) return '';
  let normalized = text;
  try {
    if (/^https?:\/\//i.test(text)) {
      const parsed = new URL(text);
      normalized = `${parsed.pathname || ''}${parsed.search || ''}`;
    }
  } catch (_e) {}
  const cleanPath = normalized.split('?')[0].split('#')[0];
  const decodedPath = (() => {
    try { return decodeURIComponent(cleanPath); } catch (_e) { return cleanPath; }
  })();
  const uploadsToken = '/uploads/';
  const candidates = new Set([text, decodedPath, cleanPath]);
  const addUploadCandidates = (rawFilePart) => {
    const filePart = normalizeText(rawFilePart).replace(/^\/+/, '');
    if (!filePart) return;
    const decodedFilePart = (() => {
      try { return decodeURIComponent(filePart); } catch (_e) { return filePart; }
    })();
    uploadSearchDirs.forEach((dir) => {
      candidates.add(path.join(dir, decodedFilePart));
      candidates.add(path.join(dir, path.basename(decodedFilePart)));
    });
  };
  const normalizedUploadPath = decodedPath.replace(/^\/?uploads\/?/i, '');
  addUploadCandidates(normalizedUploadPath);
  addUploadCandidates(path.basename(decodedPath || cleanPath || text));
  const uploadsIndex = decodedPath.toLowerCase().indexOf(uploadsToken);
  if (uploadsIndex >= 0) {
    addUploadCandidates(decodedPath.slice(uploadsIndex + uploadsToken.length));
  }
  return Array.from(candidates).find((candidate) => {
    try { return candidate && fs.existsSync(candidate); } catch (_e) { return false; }
  }) || '';
};

const resolveUploadPath = (logoUrl) => {
  if (!logoUrl) return null;
  const fs = require('fs');
  const path = require('path');

  const persistentUploadRoot = String(process.env.UPLOADS_ROOT || '/home/u610009593/uploads-skuas-crm').trim();
  const searchDirs = [
    persistentUploadRoot,
    path.join(__dirname, '..', 'storage', 'uploads'),
    path.join(process.cwd(), 'uploads'),
    path.join(__dirname, 'public', 'uploads'),
    path.join(__dirname, '..', 'public', 'uploads')
  ].filter(Boolean);

  const raw = String(logoUrl).trim();
  const basename = path.basename(raw.split('?')[0] || '');
  const candidates = [];

  if (/^data:image\//i.test(raw)) return null;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const pathname = String(parsed.pathname || '').trim();
      if (pathname) candidates.push(pathname);
      if (basename) candidates.push(basename);
    } catch (_error) {
      if (basename) candidates.push(basename);
    }
  } else {
    candidates.push(raw);
    if (basename && basename !== raw) candidates.push(basename);
  }

  for (const candidateRaw of candidates) {
    let cleaned = String(candidateRaw || '').trim();
    if (!cleaned) continue;
    cleaned = cleaned.replace(/^https?:\/\/[^/]+\/uploads\//, '/uploads/');
    if (cleaned.startsWith('/uploads/')) cleaned = cleaned.replace(/^\/uploads\//, '');
    if (cleaned.startsWith('uploads/')) cleaned = cleaned.replace(/^uploads\//, '');
    for (const dir of searchDirs) {
      const candidate = path.join(dir, cleaned);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
};

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
  const employeeName = normalizeText(raw.employeeName || raw.employee_name || raw.name || '');
  const employeeCode = normalizeText(raw.employeeCode || raw.employee_code || raw.empCode || '');
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
    employeeName,
    employeeCode,
    effectiveDate: normalizeText(raw.effectiveDate || new Date().toISOString().slice(0, 10)),
    salaryType,
    basicSalary: toNumber(raw.basicSalary, 0),
    dailyRate: toNumber(raw.dailyRate, 0),
    hourlyRate: toNumber(raw.hourlyRate, 0),
    overtimeRate: toNumber(raw.overtimeRate ?? raw.otRate, 0),
    bankName: normalizeText(raw.bankName || ''),
    accountNumber: normalizeText(raw.accountNumber || ''),
    ifsc: normalizeText(raw.ifsc || ''),
    upiId: normalizeText(raw.upiId || ''),
    pan: normalizeText(raw.pan || ''),
    aadhaar: normalizeText(raw.aadhaar || ''),
    joiningDate: normalizeText(raw.joiningDate || raw.dateOfJoining || ''),
    allowances,
    deductions,
    notes: normalizeText(raw.notes || ''),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const normalizePayrollRecord = (raw = {}) => {
  const month = Math.min(12, Math.max(1, toNumber(raw.month, 0)));
  const year = Math.max(2000, toNumber(raw.year, new Date().getFullYear()));
  const payrollKey = normalizeText(raw.payrollKey || raw.payroll_key || raw._id || `${year}-${pad2(month)}-${raw.employeeId || 'EMP'}`);
  return {
    _id: normalizeText(raw._id || payrollKey),
    payrollKey,
    employeeId: normalizeText(raw.employeeId || raw.employee_id || ''),
    employeeCode: normalizeText(raw.employeeCode || raw.employee_code || ''),
    employeeName: normalizeText(raw.employeeName || raw.employee_name || ''),
    designation: normalizeText(raw.designation || ''),
    department: normalizeText(raw.department || ''),
    month,
    year,
    presentDays: round2(toNumber(raw.presentDays ?? raw.present_days, 0)),
    absentDays: round2(toNumber(raw.absentDays ?? raw.absent_days, 0)),
    leaveDays: round2(toNumber(raw.leaveDays ?? raw.leave_days, 0)),
    overtimeHours: round2(toNumber(raw.overtimeHours ?? raw.overtime_hours, 0)),
    grossSalary: round2(toNumber(raw.grossSalary ?? raw.gross_salary, 0)),
    totalAllowances: round2(toNumber(raw.totalAllowances ?? raw.total_allowances, 0)),
    totalDeductions: round2(toNumber(raw.totalDeductions ?? raw.total_deductions, 0)),
    netSalary: round2(toNumber(raw.netSalary ?? raw.net_salary, 0)),
    paymentStatus: normalizeText(raw.paymentStatus || raw.payment_status || 'Pending'),
    paymentDate: normalizeText(raw.paymentDate || raw.payment_date || ''),
    paymentMode: normalizeText(raw.paymentMode || raw.payment_method || ''),
    remarks: normalizeText(raw.remarks || ''),
    payrollStatus: normalizeText(raw.payrollStatus || raw.payroll_status || 'Generated'),
    isLocked: !!raw.isLocked || !!raw.is_locked,
    manualAdjustmentAmount: round2(toNumber(raw.manualAdjustmentAmount ?? raw.manual_adjustment_amount, 0)),
    manualAdjustmentReason: normalizeText(raw.manualAdjustmentReason || raw.manual_adjustment_reason || ''),
    manualOverrideEnabled: !!raw.manualOverrideEnabled || !!raw.manual_override_enabled,
    overrideNetSalary: raw.overrideNetSalary ?? raw.override_net_salary ?? null,
    basicSalary: round2(toNumber(raw.basicSalary ?? raw.basic_salary, 0)),
    salaryType: normalizeText(raw.salaryType || raw.salary_type || 'monthly'),
    perDaySalary: round2(toNumber(raw.perDaySalary ?? raw.per_day_salary, 0)),
    attendanceSummary: raw.attendanceSummary || raw.attendance_summary || {},
    allowances: raw.allowances || {},
    deductions: raw.deductions || {},
    advanceBreakdown: raw.advanceBreakdown || raw.advance_breakdown || [],
    salaryInWords: normalizeText(raw.salaryInWords || raw.salary_in_words || ''),
    slipPath: normalizeText(raw.slipPath || raw.slip_path || ''),
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString()
  };
};

const toMinutes = (value) => {
  const raw = normalizeText(value);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
};

const attendanceStatus = (value) => normalizeRole(value || '');
const attendanceLeaveTypeAliases = new Map([
  ['cl', 'Casual Leave (CL)'],
  ['sl', 'Sick Leave (SL)'],
  ['lwp', 'Unpaid Leave (LWP)'],
  ['casual leave', 'Casual Leave (CL)'],
  ['casual leave (cl)', 'Casual Leave (CL)'],
  ['sick leave', 'Sick Leave (SL)'],
  ['sick leave (sl)', 'Sick Leave (SL)'],
  ['paid leave', 'Paid Leave'],
  ['earned leave', 'Paid Leave'],
  ['unpaid leave', 'Unpaid Leave (LWP)'],
  ['unpaid leave (lwp)', 'Unpaid Leave (LWP)'],
  ['half day leave', 'Half Day Leave'],
  ['half day', 'Half Day Leave'],
  ['weekly off', 'Weekly Off'],
  ['public holiday', 'Public Holiday'],
  ['outdoor duty', 'Outdoor Duty'],
  ['absent', 'Absent']
]);

const normalizeAttendanceLeaveType = (leaveType) => {
  const raw = normalizeRole(leaveType);
  if (!raw) return '';
  return attendanceLeaveTypeAliases.get(raw) || raw;
};

const classifyLeaveType = (leaveType) => {
  const text = normalizeRole(normalizeAttendanceLeaveType(leaveType));
  if (!text) return 'unpaid_leave';
  if (['paid leave', 'casual leave (cl)', 'sick leave (sl)', 'casual leave', 'sick leave', 'earned leave'].includes(text)) return 'paid_leave';
  if (text === 'outdoor duty') return 'present';
  if (text === 'public holiday') return 'paid_holiday';
  if (text === 'weekly off') return 'weekly_off';
  if (text === 'half day leave') return 'half_day';
  if (text === 'absent') return 'absent';
  if (text === 'unpaid leave (lwp)' || text === 'unpaid leave') return 'unpaid_leave';
  const leaveClassMap = [
    ['present', ['outdoor duty', 'outdoor-duty', 'on duty', 'on-duty', 'field duty', 'field-duty']],
    ['paid_holiday', ['public holiday', 'paid holiday', 'holiday']],
    ['weekly_off', ['weekly off', 'weekly-off', 'weekly holiday', 'weekly-holiday']],
    ['half_day', ['half day', 'half-day', 'half day leave', 'half-day leave']],
    ['absent', ['absent']],
    ['unpaid_leave', ['unpaid leave', 'unpaid', 'lwp', 'loss of pay', 'loss-of-pay']],
    ['paid_leave', ['paid leave', 'casual leave', 'sick leave', 'earned leave', 'compensatory leave', 'comp off', 'comp-off']]
  ];

  for (const [result, aliases] of leaveClassMap) {
    if (aliases.some((alias) => text === alias || text.includes(alias))) return result;
  }
  if (text.includes('paid')) return 'paid_leave';
  if (text.includes('public holiday')) return 'paid_holiday';
  if (text.includes('weekly off')) return 'weekly_off';
  if (text.includes('half day')) return 'half_day';
  if (text.includes('outdoor duty')) return 'present';
  if (text === 'absent') return 'absent';
  if (text.includes('unpaid') || text.includes('lwp')) return 'unpaid_leave';
  return 'unpaid_leave';
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
  let overtimeHours = 0;

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

    if (!att) return;

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
      const rawHours = toNumber(att.workingHours ?? att.hoursWorked ?? 0, 0);
      overtimeHours += Math.max(0, round2(rawHours - defaultPayrollConfig.standardDailyHours));
      return;
    }
    if (status === 'half-day') {
      halfDays += 1;
      const inMins = toMinutes(att.checkIn || '');
      if (inMins !== null && shiftStartMins !== null && inMins > (shiftStartMins + lateMarkGraceMinutes)) {
        lateMarks += 1;
      }
      const rawHours = toNumber(att.workingHours ?? att.hoursWorked ?? 0, 0);
      overtimeHours += Math.max(0, round2(rawHours - (defaultPayrollConfig.standardDailyHours / 2)));
      return;
    }
    if (status === 'leave') {
      const leaveClass = classifyLeaveType(att.leaveType);
      if (leaveClass === 'present') {
        presentDays += 1;
        return;
      }
      if (leaveClass === 'paid_holiday') {
        paidHolidayDays += 1;
        return;
      }
      if (leaveClass === 'weekly_off') {
        weeklyOffDays += 1;
        return;
      }
      if (leaveClass === 'half_day') {
        halfDays += 1;
        return;
      }
      if (leaveClass === 'absent') {
        unpaidLeaveDays += 1;
        return;
      }
      if (leaveClass === 'paid_leave') paidLeaveDays += 1;
      else unpaidLeaveDays += 1;
      return;
    }
    if (status === 'absent') {
      unpaidLeaveDays += 1;
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
    lateMarks: round2(lateMarks),
    overtimeHours: round2(overtimeHours)
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
  const manual = {
    ...manualOverride,
    enabled: manualOverride?.enabled !== undefined ? !!manualOverride.enabled : !!manualOverride?.manualOverrideEnabled,
    adjustmentAmount: manualOverride?.adjustmentAmount !== undefined
      ? toNumber(manualOverride.adjustmentAmount, 0)
      : toNumber(manualOverride?.manualAdjustmentAmount, 0),
    adjustmentReason: normalizeText(manualOverride?.adjustmentReason || manualOverride?.manualAdjustmentReason || '')
  };
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
  const overtimeHours = toNumber(attendanceSummary.overtimeHours, 0);
  const overtimeRate = Math.max(0, toNumber(structure?.overtimeRate, 0));
  const overtimeEarning = round2(overtimeHours * overtimeRate);

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

  const grossSalary = round2(baseEarned + allowanceTotal + overtimeEarning);
  const defaultNet = round2(grossSalary - deductionTotal);
  const adjustedNet = manual.enabled
    ? round2(toNumber(manual.overrideNetSalary, defaultNet))
    : round2(defaultNet + toNumber(manual.adjustmentAmount, 0));

  return {
    _id: normalizeText(manual._id || `PAYITEM-${Date.now()}-${employee?._id || 'EMP'}`),
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
    overtimeHours,
    overtimeRate,
    overtimeEarning,
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
    manualAdjustmentAmount: round2(toNumber(manual.adjustmentAmount, 0)),
    manualAdjustmentReason: manual.adjustmentReason,
    manualOverrideEnabled: !!manual.enabled,
    overrideNetSalary: manual.enabled ? round2(toNumber(manual.overrideNetSalary, adjustedNet)) : null,
    paymentStatus: normalizeText(manual.paymentStatus || 'Pending'),
    payrollStatus: allowedPayrollStatus.has(normalizeText(manual.payrollStatus)) ? normalizeText(manual.payrollStatus) : 'Generated',
    isLocked: !!manual.isLocked,
    paidAt: manual.paidAt || '',
    paidBy: manual.paidBy || '',
    paymentMode: manual.paymentMode || '',
    transactionRef: manual.transactionRef || '',
    paymentRemarks: manual.paymentRemarks || '',
    advanceBreakdown,
    salaryInWords: buildMoneyWords(adjustedNet),
    createdAt: manual.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const buildSalarySlipPdfBuffer = ({ item, company, branding }) => new Promise(async (resolve, reject) => {
  console.log('SALARY PDF branding object:', branding || {});
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  const logoSource = normalizeText(
    branding?.gstCompanyLogoUrl
    || branding?.gstCompanyLogo
    || branding?.gstBrandingLogoUrl
    || branding?.logoUrl
    || branding?.logo_url
    || branding?.dashboardImageUrl
    || ''
  );
  const resolvedLogoPath = resolveUploadPath(logoSource) || logoSource;
  const logoExists = Boolean(resolvedLogoPath && fs.existsSync(resolvedLogoPath));
  console.log('SALARY SLIP PDF USING QUOTATION HEADER');
  console.log('SALARY SLIP logo path value:', logoSource);
  console.log('SALARY SLIP resolved logo path:', resolvedLogoPath || '');
  console.log('SALARY SLIP logo exists:', logoExists);
  const headerSettings = {
    logo_url: resolvedLogoPath
  };
  const headerCompanySettings = {
    ...(branding || {}),
    gstCompanyLogoUrl: resolvedLogoPath,
    logo_url: resolvedLogoPath,
    logoUrl: resolvedLogoPath
  };
  const { headerBottomY: quotationHeaderBottomY } = renderQuotationPdfHeader(doc, headerSettings, headerCompanySettings);
  doc.y = quotationHeaderBottomY + 18;

  const line = (y) => {
    doc.moveTo(42, y).lineTo(553, y).strokeColor('#d0d7e2').stroke();
  };
  const textValue = (label, value, x, y) => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#4b5563').text(label, x, y, { continued: true });
    doc.font('Helvetica').fillColor('#111827').text(` ${value || '-'}`);
  };
  const amount = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const slipMonthLabel = new Date(Number(item.year), Math.max(0, Number(item.month) - 1), 1)
    .toLocaleDateString('en-IN', { month: 'long' })
    .concat(`-${item.year}`);

  const dividerY = Math.max(doc.y + 8, 118);
  const headerBottomY = dividerY + 26;
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('Salary Slip', 42, headerBottomY);
  doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`For ${slipMonthLabel}`, 42, headerBottomY + 18);
  line(headerBottomY + 40);

  const infoTopY = headerBottomY + 50;
  textValue('Employee Name:', item.employeeName, 42, infoTopY);
  textValue('Employee ID:', item.employeeCode, 310, infoTopY);
  textValue('Designation:', item.designation || '-', 42, infoTopY + 18);
  textValue('Department:', item.department || '-', 310, infoTopY + 18);
  textValue('Payment Status:', item.paymentStatus || 'Pending', 42, infoTopY + 36);
  textValue('Payroll Status:', item.payrollStatus || '-', 310, infoTopY + 36);
  line(infoTopY + 60);

  const attendanceTopY = infoTopY + 70;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Attendance Summary', 42, attendanceTopY);
  doc.font('Helvetica').fontSize(10).fillColor('#111827')
    .text(`Working Days: ${item.attendanceSummary.totalWorkingDays}`, 42, attendanceTopY + 18)
    .text(`Present: ${item.attendanceSummary.presentDays}`, 180, attendanceTopY + 18)
    .text(`Paid Leave: ${item.attendanceSummary.paidLeaveDays}`, 290, attendanceTopY + 18)
    .text(`Unpaid Leave: ${item.attendanceSummary.unpaidLeaveDays}`, 430, attendanceTopY + 18)
    .text(`Half Day: ${item.attendanceSummary.halfDays}`, 42, attendanceTopY + 36)
    .text(`Late Marks: ${item.attendanceSummary.lateMarks}`, 180, attendanceTopY + 36)
    .text(`Weekly Off: ${item.attendanceSummary.weeklyOffDays}`, 290, attendanceTopY + 36)
    .text(`Paid Holiday: ${item.attendanceSummary.paidHolidayDays}`, 430, attendanceTopY + 36);
  line(attendanceTopY + 60);

  const earningsTopY = attendanceTopY + 70;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Earnings', 42, earningsTopY);
  doc.font('Helvetica-Bold').text('Deductions', 310, earningsTopY);

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
    const y = earningsTopY + 22 + (i * rowHeight);
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

  const totalY = earningsTopY + 22 + (Math.max(earningsRows.length, deductionRows.length) * rowHeight) + 8;
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
  doc.font('Helvetica').text('Authorized Signature', 430, wordsY + 60);
  doc.moveTo(425, wordsY + 76).lineTo(552, wordsY + 76).strokeColor('#94a3b8').stroke();

  doc.end();
});

const getPayrollSlipFileInfo = (item = {}) => {
  const year = Number(item.year || new Date().getFullYear());
  const month = pad2(Number(item.month || 1));
  const employeeCode = normalizeText(item.employeeCode || item.employeeId || 'EMP').replace(/[^\w.-]+/g, '_');
  const fileName = `${employeeCode}_${year}_${month}.pdf`;
  const relativePath = `/uploads/payroll/salary-slips/${year}/${month}/${fileName}`;
  const absolutePath = path.join(uploadsRootDir, 'payroll', 'salary-slips', String(year), String(month), fileName);
  return { fileName, relativePath, absolutePath };
};

const ensureSalarySlipStored = async ({ item, company, branding, withMysqlConnection: mysqlConn }) => {
  const { absolutePath, relativePath } = getPayrollSlipFileInfo(item);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const buffer = await buildSalarySlipPdfBuffer({ item, company, branding });
  fs.writeFileSync(absolutePath, buffer);
  if (typeof mysqlConn === 'function') {
    await mysqlConn(async (conn) => {
      await conn.query(
        `INSERT INTO salary_slips (payroll_record_id, pdf_path, generated_at, payload)
         VALUES (?, ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE pdf_path=VALUES(pdf_path), generated_at=VALUES(generated_at), payload=VALUES(payload)`,
        [String(item._id || item.payrollKey || '').trim(), relativePath, JSON.stringify({ payrollRecordId: item._id || item.payrollKey || '', pdfPath: relativePath })]
      );
      await conn.query(
        `UPDATE payroll_records SET slip_path = ?, updated_at = NOW() WHERE payroll_key = ?`,
        [relativePath, String(item.payrollKey || item._id || '').trim()]
      );
    });
  }
  return { absolutePath, relativePath };
};

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
  loadEmailSettings,
  serverOrigin,
  withMysqlConnection
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

  const canUseMysql = typeof withMysqlConnection === 'function';
  const loadRuntimeEmailSettings = async () => {
    if (typeof loadEmailSettings === 'function') {
      const runtime = await loadEmailSettings();
      return normalizeEmailSettings(runtime && typeof runtime === 'object' ? runtime : {});
    }
    return normalizeEmailSettings(readSettings ? (readSettings() || {}) : {});
  };
  const PAYROLL_TABLES = {
    settings: 'payroll_settings',
    records: 'payroll_records',
    components: 'salary_components',
    advances: 'salary_advances',
    slips: 'salary_slips',
    runs: 'payroll_runs',
    payments: 'payroll_salary_payments',
    audit: 'payroll_audit'
  };

  const parseJsonValue = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch (_error) {
      return fallback;
    }
  };

  const jsonColumn = (value) => JSON.stringify(value ?? null);

  const ensurePayrollTables = async (conn) => {
    if (!canUseMysql) return;
    if (conn) {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS ${PAYROLL_TABLES.settings} (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          setting_key VARCHAR(120) NOT NULL,
          setting_value JSON NULL,
          payload JSON NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_payroll_settings_key (setting_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS ${PAYROLL_TABLES.records} (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          payroll_key VARCHAR(180) NOT NULL,
          employee_id VARCHAR(120) NOT NULL,
          employee_code VARCHAR(120) NULL,
          employee_name VARCHAR(255) NULL,
          designation VARCHAR(255) NULL,
          department VARCHAR(255) NULL,
          month INT NOT NULL,
          year INT NOT NULL,
          present_days DECIMAL(10,2) NOT NULL DEFAULT 0,
          absent_days DECIMAL(10,2) NOT NULL DEFAULT 0,
          leave_days DECIMAL(10,2) NOT NULL DEFAULT 0,
          overtime_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
          gross_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
          total_allowances DECIMAL(18,2) NOT NULL DEFAULT 0,
          total_deductions DECIMAL(18,2) NOT NULL DEFAULT 0,
          net_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
          payment_status VARCHAR(80) NULL,
          payment_date DATE NULL,
          payment_method VARCHAR(80) NULL,
          remarks TEXT NULL,
          payroll_status VARCHAR(80) NULL,
          is_locked TINYINT(1) NOT NULL DEFAULT 0,
          manual_adjustment_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
          manual_adjustment_reason TEXT NULL,
          manual_override_enabled TINYINT(1) NOT NULL DEFAULT 0,
          override_net_salary DECIMAL(18,2) NULL,
          basic_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
          salary_type VARCHAR(80) NULL,
          per_day_salary DECIMAL(18,2) NOT NULL DEFAULT 0,
          attendance_summary JSON NULL,
          allowances JSON NULL,
          deductions JSON NULL,
          advance_breakdown JSON NULL,
          salary_in_words TEXT NULL,
          slip_path TEXT NULL,
          payload JSON NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_payroll_records_key (payroll_key),
          KEY idx_payroll_records_employee (employee_id),
          KEY idx_payroll_records_month_year (month, year),
          KEY idx_payroll_records_status (payment_status, payroll_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS ${PAYROLL_TABLES.components} (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          employee_id VARCHAR(120) NOT NULL,
          structure_key VARCHAR(180) NOT NULL,
          component_name VARCHAR(120) NOT NULL,
          component_type VARCHAR(80) NOT NULL,
          amount DECIMAL(18,2) NOT NULL DEFAULT 0,
          recurring TINYINT(1) NOT NULL DEFAULT 1,
          effective_date DATE NULL,
          payload JSON NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_salary_components_row (structure_key, component_name, component_type),
          KEY idx_salary_components_employee (employee_id),
          KEY idx_salary_components_effective_date (effective_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS ${PAYROLL_TABLES.advances} (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          advance_key VARCHAR(180) NOT NULL,
          employee_id VARCHAR(120) NOT NULL,
          amount DECIMAL(18,2) NOT NULL DEFAULT 0,
          reason TEXT NULL,
          advance_date DATE NULL,
          recovery_month VARCHAR(20) NULL,
          status VARCHAR(80) NULL,
          monthly_deduction DECIMAL(18,2) NOT NULL DEFAULT 0,
          deduction_mode VARCHAR(80) NULL,
          recovered_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
          balance_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
          auto_deduct TINYINT(1) NOT NULL DEFAULT 1,
          payload JSON NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_salary_advances_key (advance_key),
          KEY idx_salary_advances_employee (employee_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS ${PAYROLL_TABLES.slips} (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          payroll_record_id VARCHAR(120) NOT NULL,
          pdf_path TEXT NOT NULL,
          generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          payload JSON NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_salary_slips_record (payroll_record_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      return;
    }
    await withMysqlConnection(async (innerConn) => {
      await ensurePayrollTables(innerConn);
    });
  };

  const runPayrollQuery = async (sql, params = []) => withMysqlConnection(async (conn) => {
    await ensurePayrollTables(conn);
    return conn.query(sql, params);
  });

  const readPayrollSettings = async () => {
    if (!canUseMysql) return { config: defaultPayrollConfig, runs: [] };
    const [rows] = await runPayrollQuery(`SELECT setting_key, setting_value, payload FROM ${PAYROLL_TABLES.settings} ORDER BY id ASC`);
    const map = new Map((Array.isArray(rows) ? rows : []).map((row) => [normalizeText(row.setting_key), parseJsonValue(row.setting_value || row.payload, {}) || {}]));
    const config = { ...defaultPayrollConfig, ...(map.get('config') || {}) };
    const runs = Array.isArray(map.get('runs')) ? map.get('runs') : [];
    return { config, runs };
  };

  const savePayrollSettings = async ({ config, runs }) => {
    if (!canUseMysql) return;
    const settings = [
      { setting_key: 'config', setting_value: config, payload: config },
      { setting_key: 'runs', setting_value: runs, payload: runs }
    ];
    await runPayrollQuery(`DELETE FROM ${PAYROLL_TABLES.settings}`);
    for (const row of settings) {
      await runPayrollQuery(
        `INSERT INTO ${PAYROLL_TABLES.settings} (setting_key, setting_value, payload)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), payload=VALUES(payload)`,
        [row.setting_key, jsonColumn(row.setting_value), jsonColumn(row.payload)]
      );
    }
  };

  const readPayrollRows = async (table, orderBy = 'id ASC') => {
    if (!canUseMysql) return [];
    const [rows] = await runPayrollQuery(`SELECT * FROM ${table} ORDER BY ${orderBy}`);
    return Array.isArray(rows) ? rows : [];
  };

  const savePayrollRows = async (table, rows, buildRow) => {
    if (!canUseMysql) return;
    const nextRows = Array.isArray(rows) ? rows : [];
    await runPayrollQuery(`DELETE FROM ${table}`);
    for (const row of nextRows) {
      const payload = buildRow(row);
      const columns = Object.keys(payload);
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map((column) => {
        const value = payload[column];
        return value && typeof value === 'object' && !(value instanceof Date) ? jsonColumn(value) : value;
      });
      await runPayrollQuery(
        `INSERT INTO ${table} (${columns.map((column) => `\`${column}\``).join(', ')})
         VALUES (${placeholders})`,
        values
      );
    }
  };

  const payrollCache = {
    config: { ...defaultPayrollConfig },
    runs: [],
    items: [],
    structures: [],
    holidays: [],
    advances: [],
    payments: [],
    audit: []
  };
  let payrollCacheLoaded = false;
  let payrollCachePromise = null;

  const loadPayrollCache = async () => {
    if (!canUseMysql || payrollCacheLoaded) return payrollCache;
    if (!payrollCachePromise) {
      payrollCachePromise = withMysqlConnection(async (conn) => {
        await ensurePayrollTables(conn);

        const [settingsRows] = await conn.query(`SELECT setting_key, setting_value, payload FROM ${PAYROLL_TABLES.settings} ORDER BY id ASC`);
        const settingsMap = new Map((Array.isArray(settingsRows) ? settingsRows : []).map((row) => [normalizeText(row.setting_key), parseJsonValue(row.setting_value || row.payload, {}) || {}]));
        payrollCache.config = { ...defaultPayrollConfig, ...(settingsMap.get('config') || {}) };
        payrollCache.runs = Array.isArray(settingsMap.get('runs')) ? settingsMap.get('runs') : [];

        const [recordRows] = await conn.query(`SELECT * FROM ${PAYROLL_TABLES.records} ORDER BY year DESC, month DESC, employee_name ASC`);
        payrollCache.items = (Array.isArray(recordRows) ? recordRows : []).map((row) => normalizePayrollRecord({
          ...parseJsonValue(row.payload, {}),
          _id: row.payroll_key || '',
          payrollKey: row.payroll_key || '',
          employeeId: row.employee_id || '',
          employeeCode: row.employee_code || '',
          employeeName: row.employee_name || '',
          designation: row.designation || '',
          department: row.department || '',
          month: row.month ?? 0,
          year: row.year ?? 0,
          presentDays: row.present_days ?? 0,
          absentDays: row.absent_days ?? 0,
          leaveDays: row.leave_days ?? 0,
          overtimeHours: row.overtime_hours ?? 0,
          grossSalary: row.gross_salary ?? 0,
          totalAllowances: row.total_allowances ?? 0,
          totalDeductions: row.total_deductions ?? 0,
          netSalary: row.net_salary ?? 0,
          paymentStatus: row.payment_status || 'Pending',
          paymentDate: row.payment_date || '',
          paymentMode: row.payment_method || '',
          remarks: row.remarks || '',
          payrollStatus: row.payroll_status || 'Generated',
          isLocked: !!row.is_locked,
          manualAdjustmentAmount: row.manual_adjustment_amount ?? 0,
          manualAdjustmentReason: row.manual_adjustment_reason || '',
          manualOverrideEnabled: !!row.manual_override_enabled,
          overrideNetSalary: row.override_net_salary ?? null,
          basicSalary: row.basic_salary ?? 0,
          salaryType: row.salary_type || 'monthly',
          perDaySalary: row.per_day_salary ?? 0,
          attendanceSummary: parseJsonValue(row.attendance_summary, {}) || {},
          allowances: parseJsonValue(row.allowances, {}) || {},
          deductions: parseJsonValue(row.deductions, {}) || {},
          advanceBreakdown: parseJsonValue(row.advance_breakdown, []) || [],
          salaryInWords: row.salary_in_words || '',
          slipPath: row.slip_path || ''
        }));

        const [componentRows] = await conn.query(`SELECT * FROM ${PAYROLL_TABLES.components} ORDER BY effective_date DESC, employee_id ASC, id ASC`);
        const groupedStructures = new Map();
        (Array.isArray(componentRows) ? componentRows : []).forEach((row) => {
          const payload = parseJsonValue(row.payload, {}) || {};
          const structureKey = normalizeText(row.structure_key || payload.structureKey || `${row.employee_id || payload.employeeId || 'EMP'}-${row.effective_date || payload.effectiveDate || '0000-00-00'}`);
          const list = groupedStructures.get(structureKey) || [];
          list.push({
            ...payload,
            _id: row.id ? String(row.id) : payload._id,
            structureKey,
            employeeId: row.employee_id || payload.employeeId || '',
            componentName: row.component_name || payload.componentName || '',
            componentType: row.component_type || payload.componentType || '',
            amount: Number(row.amount ?? payload.amount ?? 0),
            recurring: !!row.recurring,
            effectiveDate: row.effective_date || payload.effectiveDate || ''
          });
          groupedStructures.set(structureKey, list);
        });
        payrollCache.structures = Array.from(groupedStructures.values()).map((items) => {
          const first = items[0] || {};
          const allowances = {};
          const deductions = { latePerMark: 0 };
          items.forEach((item) => {
            const type = normalizeRole(item.componentType);
            const name = normalizeRole(item.componentName);
            if (type === 'allowance') allowances[name] = Number(item.amount || 0);
            else if (type === 'deduction') deductions[name] = Number(item.amount || 0);
            else if (name === 'basic salary') first.basicSalary = Number(item.amount || first.basicSalary || 0);
            else if (name === 'daily rate') first.dailyRate = Number(item.amount || first.dailyRate || 0);
            else if (name === 'hourly rate') first.hourlyRate = Number(item.amount || first.hourlyRate || 0);
          });
          return normalizeSalaryStructure({
            ...first,
            structureKey: first.structureKey,
            allowances,
            deductions
          });
        });

        const [holidayRows] = await conn.query(`SELECT setting_value, payload FROM ${PAYROLL_TABLES.settings} WHERE setting_key = 'holiday' ORDER BY id ASC`);
        payrollCache.holidays = (Array.isArray(holidayRows) ? holidayRows : [])
          .map((row) => normalizeHoliday(parseJsonValue(row.setting_value || row.payload, {}) || {}))
          .filter((entry) => entry.date);

        const [advanceRows] = await conn.query(`SELECT * FROM ${PAYROLL_TABLES.advances} ORDER BY advance_date DESC, id DESC`);
        payrollCache.advances = (Array.isArray(advanceRows) ? advanceRows : []).map((row) => normalizeAdvance({
          ...parseJsonValue(row.payload, {}) || {},
          _id: row.advance_key || '',
          employeeId: row.employee_id || '',
          amount: row.amount ?? 0,
          reason: row.reason || '',
          issuedDate: row.advance_date || '',
          recoveryMonth: row.recovery_month || '',
          status: row.status || '',
          monthlyDeduction: row.monthly_deduction ?? 0,
          deductionMode: row.deduction_mode || 'partial',
          recoveredAmount: row.recovered_amount ?? 0,
          balanceAmount: row.balance_amount ?? 0,
          autoDeduct: !!row.auto_deduct
        })).filter((entry) => entry.employeeId);

        const [paymentRows] = await conn.query(`SELECT * FROM ${PAYROLL_TABLES.payments} ORDER BY payment_date DESC, id DESC`);
        payrollCache.payments = Array.isArray(paymentRows) ? paymentRows.map((row) => parseJsonValue(row.payload, {
          _id: row.id ? String(row.id) : '',
          payrollItemId: row.payroll_item_id || '',
          employeeId: row.employee_id || '',
          employeeCode: row.employee_code || '',
          employeeName: row.employee_name || '',
          month: row.month ?? 0,
          year: row.year ?? 0,
          amount: row.amount ?? 0,
          paymentMode: row.payment_mode || '',
          paymentDate: row.payment_date || '',
          transactionRef: row.transaction_ref || '',
          remarks: row.remarks || ''
        })) : [];

        const [auditRows] = await conn.query(`SELECT * FROM ${PAYROLL_TABLES.audit} ORDER BY id DESC`);
        payrollCache.audit = Array.isArray(auditRows) ? auditRows.map((row) => parseJsonValue(row.payload, {
          _id: row.id ? String(row.id) : '',
          actor: row.actor || 'System',
          action: row.action || 'unknown',
          payload: {
            entityType: row.entity_type || '',
            entityId: row.entity_id || '',
            message: row.message || ''
          },
          createdAt: row.created_at || ''
        })) : [];
      }).catch((error) => {
        console.error('Payroll cache load failed:', error.message);
      }).finally(() => {
        payrollCachePromise = null;
      });
    }
    await payrollCachePromise;
    payrollCacheLoaded = true;
    return payrollCache;
  };

  const getPayrollConfig = () => payrollCache;
  const savePayrollConfigAndRuns = async ({ config, runs }) => {
    payrollCache.config = { ...defaultPayrollConfig, ...(config || {}) };
    payrollCache.runs = Array.isArray(runs) ? runs : [];
    if (!canUseMysql) return;
    withMysqlConnection(async (conn) => {
      await ensurePayrollTables(conn);
      await conn.query(`DELETE FROM ${PAYROLL_TABLES.settings} WHERE setting_key IN ('config', 'runs')`);
      await conn.query(
        `INSERT INTO ${PAYROLL_TABLES.settings} (setting_key, setting_value, payload)
         VALUES (?, ?, ?), (?, ?, ?)`,
        ['config', jsonColumn(payrollCache.config), jsonColumn(payrollCache.config), 'runs', jsonColumn(payrollCache.runs), jsonColumn(payrollCache.runs)]
      );
    }).catch((error) => {
      console.error('Payroll config save failed:', error.message);
    });
  };

  const getItems = () => payrollCache.items;
  const saveItems = (rows) => {
    payrollCache.items = (Array.isArray(rows) ? rows : []).map((entry) => normalizePayrollRecord(entry));
    if (!canUseMysql) return;
    withMysqlConnection(async (conn) => {
      await ensurePayrollTables(conn);
      await conn.query(`DELETE FROM ${PAYROLL_TABLES.records}`);
      for (const row of payrollCache.items) {
        await conn.query(
          `INSERT INTO ${PAYROLL_TABLES.records}
           (payroll_key, employee_id, employee_code, employee_name, designation, department, month, year, present_days, absent_days, leave_days, overtime_hours, gross_salary, total_allowances, total_deductions, net_salary, payment_status, payment_date, payment_method, remarks, payroll_status, is_locked, manual_adjustment_amount, manual_adjustment_reason, manual_override_enabled, override_net_salary, basic_salary, salary_type, per_day_salary, attendance_summary, allowances, deductions, advance_breakdown, salary_in_words, slip_path, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.payrollKey,
            row.employeeId,
            row.employeeCode || '',
            row.employeeName || '',
            row.designation || '',
            row.department || '',
            Number(row.month || 0),
            Number(row.year || 0),
            Number(row.presentDays || 0),
            Number(row.absentDays || 0),
            Number(row.leaveDays || 0),
            Number(row.overtimeHours || 0),
            Number(row.grossSalary || 0),
            Number(row.totalAllowances || 0),
            Number(row.totalDeductions || 0),
            Number(row.netSalary || 0),
            row.paymentStatus || 'Pending',
            row.paymentDate || null,
            row.paymentMode || '',
            row.remarks || '',
            row.payrollStatus || 'Generated',
            row.isLocked ? 1 : 0,
            Number(row.manualAdjustmentAmount || 0),
            row.manualAdjustmentReason || '',
            row.manualOverrideEnabled ? 1 : 0,
            row.overrideNetSalary ?? null,
            Number(row.basicSalary || 0),
            row.salaryType || 'monthly',
            Number(row.perDaySalary || 0),
            jsonColumn(row.attendanceSummary || {}),
            jsonColumn(row.allowances || {}),
            jsonColumn(row.deductions || {}),
            jsonColumn(row.advanceBreakdown || []),
            row.salaryInWords || '',
            row.slipPath || '',
            jsonColumn(row)
          ]
        );
      }
    }).catch((error) => {
      console.error('Payroll records save failed:', error.message);
    });
  };

  const getStructures = () => payrollCache.structures;
  const saveStructures = (rows) => {
    payrollCache.structures = (Array.isArray(rows) ? rows : []).map((entry) => normalizeSalaryStructure(entry));
    if (!canUseMysql) return;
    withMysqlConnection(async (conn) => {
      await ensurePayrollTables(conn);
      await conn.query(`DELETE FROM ${PAYROLL_TABLES.components}`);
      for (const structure of payrollCache.structures) {
        const structureKey = structure.structureKey || `${structure.employeeId}-${structure.effectiveDate}`;
        const baseRows = [
          ['Basic Salary', 'base', Number(structure.basicSalary || 0)],
          ['Daily Rate', 'base', Number(structure.dailyRate || 0)],
          ['Hourly Rate', 'base', Number(structure.hourlyRate || 0)]
        ];
        const allowanceRows = Object.entries(structure.allowances || {}).filter(([name]) => name !== 'total').map(([name, amount]) => [name, 'allowance', Number(amount || 0)]);
        const deductionRows = Object.entries(structure.deductions || {}).filter(([name]) => name !== 'latePerMark').map(([name, amount]) => [name, 'deduction', Number(amount || 0)]);
        const rowsToInsert = [...baseRows, ...allowanceRows, ...deductionRows];
        for (const [componentName, componentType, amount] of rowsToInsert) {
          await conn.query(
            `INSERT INTO ${PAYROLL_TABLES.components}
             (employee_id, structure_key, component_name, component_type, amount, recurring, effective_date, payload)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              structure.employeeId,
              structureKey,
              componentName,
              componentType,
              amount,
              1,
              structure.effectiveDate || null,
              jsonColumn({ ...structure, structureKey })
            ]
          );
        }
      }
    }).catch((error) => {
      console.error('Payroll structures save failed:', error.message);
    });
  };

  const getHolidays = () => payrollCache.holidays;
  const saveHolidays = (rows) => {
    payrollCache.holidays = (Array.isArray(rows) ? rows : []).map((entry) => normalizeHoliday(entry)).filter((entry) => entry.date);
    if (!canUseMysql) return;
    withMysqlConnection(async (conn) => {
      await ensurePayrollTables(conn);
      await conn.query(`DELETE FROM ${PAYROLL_TABLES.settings} WHERE setting_key = 'holiday'`);
      for (const row of payrollCache.holidays) {
        await conn.query(
          `INSERT INTO ${PAYROLL_TABLES.settings} (setting_key, setting_value, payload) VALUES ('holiday', ?, ?)`,
          [jsonColumn(row), jsonColumn(row)]
        );
      }
    }).catch((error) => {
      console.error('Payroll holidays save failed:', error.message);
    });
  };

  const getAdvances = () => payrollCache.advances;
  const saveAdvances = (rows) => {
    payrollCache.advances = (Array.isArray(rows) ? rows : []).map((entry) => normalizeAdvance(entry)).filter((entry) => entry.employeeId);
    if (!canUseMysql) return;
    withMysqlConnection(async (conn) => {
      await ensurePayrollTables(conn);
      await conn.query(`DELETE FROM ${PAYROLL_TABLES.advances}`);
      for (const row of payrollCache.advances) {
        await conn.query(
          `INSERT INTO ${PAYROLL_TABLES.advances}
           (advance_key, employee_id, amount, reason, advance_date, recovery_month, status, monthly_deduction, deduction_mode, recovered_amount, balance_amount, auto_deduct, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row._id,
            row.employeeId,
            Number(row.amount || 0),
            row.reason || '',
            row.issuedDate || null,
            row.recoveryMonth || null,
            row.status || 'Open',
            Number(row.monthlyDeduction || 0),
            row.deductionMode || 'partial',
            Number(row.recoveredAmount || 0),
            Number(row.balanceAmount || 0),
            row.autoDeduct ? 1 : 0,
            jsonColumn(row)
          ]
        );
      }
    }).catch((error) => {
      console.error('Payroll advances save failed:', error.message);
    });
  };

  const getPayments = () => payrollCache.payments;
  const savePayments = (rows) => {
    payrollCache.payments = Array.isArray(rows) ? rows : [];
    if (!canUseMysql) return;
    withMysqlConnection(async (conn) => {
      await ensurePayrollTables(conn);
      await conn.query(`DELETE FROM ${PAYROLL_TABLES.payments}`);
      for (const row of payrollCache.payments) {
        await conn.query(
          `INSERT INTO ${PAYROLL_TABLES.payments}
           (payroll_item_id, employee_id, employee_code, employee_name, payment_date, payment_mode, transaction_ref, amount, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.payrollItemId || '',
            row.employeeId || '',
            row.employeeCode || '',
            row.employeeName || '',
            row.paymentDate || null,
            row.paymentMode || '',
            row.transactionRef || '',
            Number(row.amount || 0),
            jsonColumn(row)
          ]
        );
      }
    }).catch((error) => {
      console.error('Payroll payments save failed:', error.message);
    });
  };

  const saveAuditRows = (rows) => {
    payrollCache.audit = Array.isArray(rows) ? rows : [];
    if (!canUseMysql) return;
    withMysqlConnection(async (conn) => {
      await ensurePayrollTables(conn);
      await conn.query(`DELETE FROM ${PAYROLL_TABLES.audit}`);
      for (const row of payrollCache.audit) {
        await conn.query(
          `INSERT INTO ${PAYROLL_TABLES.audit} (actor, action, entity_type, entity_id, message, payload)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            row.actor || 'System',
            row.action || 'unknown',
            row.entityType || '',
            row.entityId || '',
            row.message || '',
            jsonColumn(row.payload || row)
          ]
        );
      }
    }).catch((error) => {
      console.error('Payroll audit save failed:', error.message);
    });
  };

  const buildPayrollEmployeeLookup = (employees = []) => {
    const map = new Map();
    const add = (value, entry) => {
      const key = normalizeText(value).toLowerCase();
      if (!key || map.has(key)) return;
      map.set(key, entry || {});
    };
    (Array.isArray(employees) ? employees : []).forEach((entry) => {
      const fullName = [entry?.firstName, entry?.lastName].filter(Boolean).join(' ').trim();
      [
        entry?._id,
        entry?.id,
        entry?.external_id,
        entry?.empCode,
        entry?.employeeCode,
        entry?.employeeId,
        fullName,
        entry?.name,
        entry?.displayName
      ].forEach((value) => add(value, entry));
    });
    return map;
  };

  const findPayrollEmployee = (lookup, ...values) => {
    if (!lookup || typeof lookup.get !== 'function') return null;
    for (const value of values.flat()) {
      const key = normalizeText(value).toLowerCase();
      if (!key) continue;
      const employee = lookup.get(key);
      if (employee) return employee;
    }
    return null;
  };

  const loadPayrollCompanySettings = async () => {
    if (typeof withMysqlConnection === 'function') {
      try {
        return await withMysqlConnection(async (conn) => {
          const [rows] = await conn.query(
            'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
            ['main']
          );
          const row = Array.isArray(rows) ? rows[0] : null;
          const raw = row?.setting_value;
          if (!raw) return {};
          if (typeof raw === 'string') {
            try {
              return JSON.parse(raw) || {};
            } catch (_error) {
              return {};
            }
          }
          if (raw && typeof raw === 'object') return raw;
          return {};
        });
      } catch (error) {
        console.error('Failed to load payroll company settings from MySQL, using JSON fallback:', error.message);
      }
    }
    return readSettings ? (readSettings() || {}) : {};
  };

  app.use('/api/payroll', async (_req, _res, next) => {
    try {
      await loadPayrollCache();
    } catch (_error) {
      // Non-blocking: payroll APIs will still serve cached data if loading fails.
    }
    next();
  });

  const writeAudit = ({ actor, action, payload, entityType = '', entityId = '', message = '' }) => {
    const row = {
      _id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actor: normalizeText(actor || 'System'),
      action: normalizeText(action || 'unknown'),
      entityType: normalizeText(entityType || ''),
      entityId: normalizeText(entityId || ''),
      message: normalizeText(message || ''),
      payload: payload || {},
      createdAt: new Date().toISOString()
    };
    payrollCache.audit = [row, ...payrollCache.audit];
    if (!canUseMysql) return;
    withMysqlConnection(async (conn) => {
      await ensurePayrollTables(conn);
      await conn.query(
        `INSERT INTO ${PAYROLL_TABLES.audit} (actor, action, entity_type, entity_id, message, payload)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.actor, row.action, row.entityType, row.entityId, row.message, jsonColumn(row)]
      );
    }).catch((error) => {
      console.error('Payroll audit write failed:', error.message);
    });
  };

  const readAttendanceForPayroll = async () => {
    if (!canUseMysql) return readJsonFile(attendanceFile, []);
    try {
      return withMysqlConnection(async (conn) => {
        const [rows] = await conn.query('SELECT payload, leave_type FROM attendance ORDER BY id DESC');
        return (Array.isArray(rows) ? rows : [])
          .map((row) => {
            const payload = parseJsonValue(row.payload, {});
            if (!payload) return null;
            const leaveType = normalizeAttendanceLeaveType(row.leave_type);
            const record = typeof payload === 'object' ? { ...payload } : {};
            if (leaveType && !record.leaveType) record.leaveType = leaveType;
            return record;
          })
          .filter((entry) => entry && entry.employeeId && entry.date);
      });
    } catch (error) {
      console.error('Payroll attendance read failed:', error.message);
      return readJsonFile(attendanceFile, []);
    }
  };

  const employeeLookup = () => {
    return buildPayrollEmployeeLookup(readJsonFile(employeesFile, []));
  };

  const readEmployeesForPayroll = async () => {
    const localEmployees = readJsonFile(employeesFile, []);
    if (!canUseMysql) return localEmployees;
    try {
      const mysqlEmployees = await withMysqlConnection(async (conn) => {
        const [rows] = await conn.query(`
          SELECT
            id,
            external_id,
            emp_code,
            first_name,
            last_name,
            role,
            role_name,
            mobile,
            email,
            city,
            pincode,
            salary,
            joining_date,
            payload
          FROM employees
          ORDER BY id DESC
        `);
        return Array.isArray(rows) ? rows : [];
      });
      const normalizedMysql = mysqlEmployees.map((row) => {
        let payload = {};
        const rawPayload = row?.payload;
        if (rawPayload && typeof rawPayload === 'object') payload = rawPayload;
        if (typeof rawPayload === 'string') {
          try { payload = JSON.parse(rawPayload); } catch { payload = {}; }
        }
        const salary = Number(row?.salary ?? payload.salary ?? payload.salaryPerMonth ?? 0) || 0;
        const firstName = normalizeText(row?.first_name || payload?.firstName || '');
        const lastName = normalizeText(row?.last_name || payload?.lastName || '');
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
        return {
          ...payload,
          id: normalizeText(row?.id || payload?.id || ''),
          _id: normalizeText(row?.external_id || payload?._id || row?.id || ''),
          external_id: normalizeText(row?.external_id || payload?.external_id || ''),
          empCode: normalizeText(row?.emp_code || payload?.empCode || ''),
          employeeCode: normalizeText(row?.emp_code || payload?.employeeCode || ''),
          firstName,
          lastName,
          name: normalizeText(payload?.name || fullName || row?.name || ''),
          displayName: normalizeText(payload?.displayName || fullName || row?.displayName || ''),
          mobile: normalizeText(row?.mobile || payload?.mobile || ''),
          email: normalizeText(row?.email || payload?.email || payload?.emailId || ''),
          role: normalizeText(row?.role || payload?.role || ''),
          roleName: normalizeText(row?.role_name || payload?.roleName || ''),
          salary,
          salaryPerMonth: salary,
          dateOfJoining: normalizeText(row?.joining_date || payload?.dateOfJoining || ''),
          city: normalizeText(row?.city || payload?.city || ''),
          pincode: normalizeText(row?.pincode || payload?.pincode || '')
        };
      }).filter((entry) => normalizeText(entry?._id));
      if (normalizedMysql.length > 0) return normalizedMysql;
      return Array.isArray(localEmployees) ? localEmployees : [];
    } catch (error) {
      console.error('Payroll employee MySQL fallback failed:', error.message);
      return Array.isArray(localEmployees) ? localEmployees : [];
    }
  };

  const enrichPayrollStructureWithEmployee = (item, lookup) => {
    const structure = normalizeSalaryStructure(item);
    const employee = findPayrollEmployee(
      lookup,
      structure.employeeId,
      item?.employeeId,
      item?.employee_id,
      item?.employeeCode,
      item?.employee_code,
      item?.employeeName,
      item?.employee_name,
      item?._id
    );
    if (!employee) return structure;
    const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
    const employeeName = fullName || structure.employeeName || employee.name || employee.displayName || employee.empCode || employee.employeeCode || 'Employee';
    const employeeCode = normalizeText(structure.employeeCode || employee.empCode || employee.employeeCode || '');
    return {
      ...structure,
      employeeId: normalizeText(structure.employeeId || employee._id || employee.id || ''),
      employeeName,
      employeeCode,
      designation: normalizeText(structure.designation || employee.roleName || employee.role || ''),
      department: normalizeText(structure.department || employee.role || ''),
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

  const enrichPayrollItemWithEmployee = (item, lookup) => {
    const employee = findPayrollEmployee(
      lookup,
      item?.employeeId,
      item?.employeeCode,
      item?.employeeName,
      item?.name,
      item?.displayName
    );
    if (!employee) return item;
    const fullName = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
    return {
      ...item,
      employeeId: normalizeText(item.employeeId || employee._id || employee.id || ''),
      employeeName: fullName || item.employeeName || employee.name || employee.displayName || employee.empCode || 'Employee',
      employeeCode: normalizeText(employee.empCode || employee.employeeCode || item.employeeCode || ''),
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

  const enrichPayrollItems = (rows, lookup = null) => {
    const resolvedLookup = lookup || employeeLookup();
    return (Array.isArray(rows) ? rows : []).map((entry) => enrichPayrollItemWithEmployee(entry, resolvedLookup));
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

  app.get('/api/payroll/salary-structures', async (req, res) => {
    try {
      const employeeId = normalizeText(req.query.employeeId || '');
      const employees = await readEmployeesForPayroll();
      const lookup = buildPayrollEmployeeLookup(employees);
      const rawRows = getStructures();
      const rows = rawRows.map((entry) => enrichPayrollStructureWithEmployee(entry, lookup));
      const needsBackfill = rows.some((entry, index) => {
        const source = rawRows[index] || {};
        return normalizeText(entry.employeeName) !== normalizeText(source.employeeName)
          || normalizeText(entry.employeeCode) !== normalizeText(source.employeeCode)
          || normalizeText(entry.employeeId) !== normalizeText(source.employeeId);
      });
      if (needsBackfill) saveStructures(rows);
      const filtered = rows.filter((entry) => (employeeId ? normalizeText(entry.employeeId) === employeeId : true));
      filtered.sort((a, b) => `${a.employeeId}-${a.effectiveDate}`.localeCompare(`${b.employeeId}-${b.effectiveDate}`));
      res.json(filtered);
    } catch (error) {
      console.error('Payroll salary-structures GET failed:', error.message);
      res.status(500).json({ error: 'Failed to load salary structures' });
    }
  });

  app.post('/api/payroll/salary-structures', async (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can manage salary structures');
    if (!perms) return;
    const employees = await readEmployeesForPayroll();
    const lookup = buildPayrollEmployeeLookup(employees);
    const payload = enrichPayrollStructureWithEmployee(normalizeSalaryStructure(req.body || {}), lookup);
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

  app.post('/api/payroll/salary-structures/sync-employees', async (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can sync salary structures');
    if (!perms) return;
    const updateExisting = req.body?.updateExisting === true;
    const employees = await readEmployeesForPayroll();
    const lookup = buildPayrollEmployeeLookup(employees);
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
      const fullName = [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim();
      const fallbackSalary = Math.max(0, toNumber(employee?.salaryPerMonth ?? employee?.salary, 0));
      if (list.length === 0) {
        structures.push(enrichPayrollStructureWithEmployee(normalizeSalaryStructure({
          employeeId,
          effectiveDate: today,
          salaryType: 'monthly',
          basicSalary: fallbackSalary,
          employeeName: fullName || employee?.name || '',
          employeeCode: normalizeText(employee?.empCode || employee?.employeeCode || ''),
          allowances: { hra: 0, conveyance: 0, mobile: 0, bonus: 0, incentive: 0, other: 0 },
          deductions: { leave: 0, late: 0, advance: 0, loan: 0, pf: 0, esi: 0, other: 0, latePerMark: 0 },
          notes: 'Auto-created from Employee Master sync'
        }), lookup));
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
        employeeName: structures[index].employeeName || fullName || employee?.name || '',
        employeeCode: structures[index].employeeCode || normalizeText(employee?.empCode || employee?.employeeCode || ''),
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

  app.get('/api/payroll/salary-structures/:employeeId/current', async (req, res) => {
    try {
      const employeeId = normalizeText(req.params.employeeId);
      const date = normalizeText(req.query.date || new Date().toISOString().slice(0, 10));
      const lookup = buildPayrollEmployeeLookup(await readEmployeesForPayroll());
      const selected = selectCurrentStructure(getStructures(), employeeId, date);
      if (!selected) return res.status(404).json({ error: 'Salary structure not found' });
      res.json(enrichPayrollStructureWithEmployee(selected, lookup));
    } catch (error) {
      console.error('PAYROLL current salary structure failed:', error.message);
      res.status(500).json({ error: 'Could not load salary structure' });
    }
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

  app.post('/api/payroll/calculate', async (req, res) => {
    const employeeId = normalizeText(req.body?.employeeId);
    const month = toNumber(req.body?.month, 0);
    const year = toNumber(req.body?.year, 0);
    if (!employeeId || !month || !year) return res.status(400).json({ error: 'employeeId, month, year are required' });

    const employees = readJsonFile(employeesFile, []);
    const attendance = await readAttendanceForPayroll();
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

  app.post('/api/payroll/generate', async (req, res) => {
    try {
      const perms = ensureAccess(req, res, (p) => p.canGenerate, 'Only Admin/HR can generate payroll');
      if (!perms) return;
      const month = toNumber(req.body?.month, 0);
      const year = toNumber(req.body?.year, 0);
      if (!month || !year) return res.status(400).json({ error: 'month and year are required' });
      if (month < 1 || month > 12) return res.status(400).json({ error: 'month must be between 1 and 12' });
      if (year < 2000 || year > 2100) return res.status(400).json({ error: 'year is out of allowed range' });

      const selectedEmployeeIds = Array.isArray(req.body?.employeeIds)
        ? req.body.employeeIds.map((entry) => normalizeText(entry)).filter(Boolean)
        : [];
      const forceRegenerate = req.body?.forceRegenerate === true;

      const employees = await readEmployeesForPayroll();
      if (!Array.isArray(employees) || employees.length === 0) {
        return res.status(400).json({ error: 'No employees found for payroll generation' });
      }
      const attendance = await readAttendanceForPayroll();
      const structures = getStructures();
      const holidays = getHolidays();
      const advances = getAdvances();
      const { config, runs } = getPayrollConfig();
      const items = getItems();

      const selectedSet = new Set(selectedEmployeeIds.map((entry) => normalizeText(entry)));
      const scope = selectedEmployeeIds.length > 0
        ? employees.filter((entry) =>
          selectedSet.has(normalizeText(entry._id))
          || selectedSet.has(normalizeText(entry.empCode))
          || selectedSet.has(normalizeText(entry.employeeCode))
        )
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

        if (existingIndex >= 0) {
          items[existingIndex] = {
            ...nextItem,
            _id: existing?._id || nextItem._id,
            createdAt: existing?.createdAt || nextItem.createdAt
          };
        }
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

      return res.json({ message: 'Payroll generated', run, generated, skipped });
    } catch (error) {
      console.error('Payroll generation failed:', error && error.stack ? error.stack : error);
      return res.status(500).json({ error: `Payroll generation failed: ${error.message || 'Unknown error'}` });
    }
  });

  app.get('/api/payroll/debug', async (req, res) => {
    try {
      const perms = ensureAccess(req, res, (p) => p.canManageAll || p.canGenerate, 'Only Admin/HR can view payroll debug');
      if (!perms) return;
      const month = toNumber(req.query.month, 0);
      const year = toNumber(req.query.year, 0);

      const employees = await readEmployeesForPayroll();
      const items = getItems();
      const matchingMonthItems = (Array.isArray(items) ? items : []).filter((entry) => {
        if (month && toNumber(entry.month, 0) !== month) return false;
        if (year && toNumber(entry.year, 0) !== year) return false;
        return true;
      });

      const availableEmployees = (Array.isArray(employees) ? employees : []).map((entry) => ({
        _id: normalizeText(entry?._id),
        empCode: normalizeText(entry?.empCode || entry?.employeeCode || ''),
        name: [entry?.firstName, entry?.lastName].filter(Boolean).join(' ').trim() || normalizeText(entry?.empCode || entry?.employeeCode || '')
      }));

      const existingItems = matchingMonthItems.map((entry) => ({
        _id: normalizeText(entry?._id),
        employeeId: normalizeText(entry?.employeeId),
        employeeCode: normalizeText(entry?.employeeCode),
        payrollStatus: normalizeText(entry?.payrollStatus),
        paymentStatus: normalizeText(entry?.paymentStatus)
      }));

      return res.json({
        employeesCount: availableEmployees.length,
        payrollItemsCount: Array.isArray(items) ? items.length : 0,
        matchingMonthItems: matchingMonthItems.length,
        employeeIdsInItems: existingItems.map((entry) => entry.employeeId).filter(Boolean),
        availableEmployees: availableEmployees.slice(0, 500),
        existingItems: existingItems.slice(0, 500)
      });
    } catch (error) {
      console.error('PAYROLL DEBUG failed:', error.message);
      return res.status(500).json({ error: 'Could not load payroll debug data' });
    }
  });

  app.get('/api/payroll/runs', (req, res) => {
    const { runs } = getPayrollConfig();
    res.json([...runs].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
  });

  app.get('/api/payroll/items', async (req, res) => {
    try {
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
      const lookup = buildPayrollEmployeeLookup(await readEmployeesForPayroll());

      const rows = enrichPayrollItems(getItems(), lookup).filter((entry) => {
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
    } catch (error) {
      console.error('PAYROLL items failed:', error.message);
      res.status(500).json({ error: 'Could not load payroll items' });
    }
  });

  app.get('/api/payroll/items/:id', async (req, res) => {
    try {
      const perms = roleToPermissions(getRoleFromReq(req));
      const identity = getRequestIdentity(req, perms);
      if (!ensureOwnIdentity(identity, res)) return;
      const lookup = buildPayrollEmployeeLookup(await readEmployeesForPayroll());
      const item = enrichPayrollItemWithEmployee(findItemById(req.params.id) || {}, lookup);
      if (!item || !item._id) return res.status(404).json({ error: 'Payroll item not found' });
      if (!canAccessItem(item, identity)) return res.status(403).json({ error: 'You can only view your own salary slip.' });
      res.json(item);
    } catch (error) {
      console.error('PAYROLL item lookup failed:', error.message);
      res.status(500).json({ error: 'Could not load payroll item' });
    }
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

  const deletePayrollItemById = (req, res, rawId) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll || p.canGenerate, 'Only Admin/HR can delete payroll rows');
    if (!perms) return;
    const itemId = normalizeText(rawId);
    if (!itemId) return res.status(400).json({ error: 'Payroll item id is required' });

    const items = getItems();
    const index = items.findIndex((entry) => normalizeText(entry._id) === itemId);
    if (index === -1) return res.status(404).json({ error: 'Payroll item not found' });

    const current = items[index];
    const payrollStatus = normalizeText(current.payrollStatus);
    const paymentStatus = normalizeText(current.paymentStatus);
    if (payrollStatus === 'Paid' || paymentStatus === 'Paid') {
      return res.status(400).json({
        error: 'Paid payroll row cannot be deleted. Unlock and mark status first.',
        code: 'PAYROLL_ROW_PAID',
        payrollStatus,
        paymentStatus
      });
    }

    const nextItems = items.filter((entry) => normalizeText(entry._id) !== itemId);
    saveItems(nextItems);

    const payments = getPayments();
    const nextPayments = payments.filter((entry) => normalizeText(entry.payrollItemId) !== itemId);
    if (nextPayments.length !== payments.length) savePayments(nextPayments);

    const auditRows = payrollCache.audit || [];
    const nextAuditRows = auditRows.filter((entry) => {
      const payload = entry && typeof entry === 'object' ? entry.payload : null;
      const payloadPayrollItemId = normalizeText(payload?.payrollItemId || payload?.id || '');
      return payloadPayrollItemId !== itemId;
    });
    if (nextAuditRows.length !== auditRows.length) saveAuditRows(nextAuditRows);

    writeAudit({
      auditFile: payrollAuditFile,
      readJsonFile,
      actor: getActorName(req),
      action: 'payroll_item_deleted',
      payload: { payrollItemId: itemId, employeeId: current.employeeId, month: current.month, year: current.year }
    });

    return res.json({ message: 'Payroll row deleted', id: itemId });
  };

  app.delete('/api/payroll/items/:id', (req, res) => {
    deletePayrollItemById(req, res, req.params.id);
  });

  // Compatibility route for environments/proxies where DELETE may be blocked.
  app.post('/api/payroll/items/:id/delete', (req, res) => {
    deletePayrollItemById(req, res, req.params.id);
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
      console.log('ACTIVE SALARY PDF ROUTE HIT');
      console.log('SALARY SLIP PDF USING QUOTATION HEADER');
      const perms = roleToPermissions(getRoleFromReq(req));
      const identity = getRequestIdentity(req, perms);
      if (!ensureOwnIdentity(identity, res)) return;
      const item = findItemById(req.params.id);
      if (!item) return res.status(404).json({ error: 'Payroll item not found' });
      if (!canAccessItem(item, identity)) return res.status(403).json({ error: 'You can only view your own salary slip.' });
      const settings = await loadPayrollCompanySettings();
      console.log('SALARY PDF branding object:', settings || {});
      const company = resolveCompanyDetails(settings);
      const { absolutePath, relativePath } = await ensureSalarySlipStored({ item, company, branding: settings, withMysqlConnection });
      const buffer = fs.readFileSync(absolutePath);
      const safeName = `${normalizeText(item.employeeCode || item.employeeId || 'EMP')}_${item.year}_${pad2(item.month)}.pdf`.replace(/[^\w.-]+/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${String(req.query.download || '') === '1' ? 'attachment' : 'inline'}; filename="${safeName}"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Payroll-Slip-Path', relativePath);
      res.send(buffer);
    } catch (error) {
      console.error('Salary slip PDF failed:', error);
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

      const appSettings = await loadPayrollCompanySettings();
      const emailSettings = await loadRuntimeEmailSettings();
      const company = resolveCompanyDetails(appSettings);
      const { absolutePath } = await ensureSalarySlipStored({ item, company, branding: appSettings, withMysqlConnection });
      const fileName = `${normalizeText(item.employeeCode || item.employeeId || 'EMP')}_${item.year}_${pad2(item.month)}.pdf`.replace(/[^\w.-]+/g, '_');
      const subject = normalizeText(req.body?.subject || `Salary Slip ${pad2(item.month)}/${item.year} - ${item.employeeName}`);
      const message = normalizeText(req.body?.message || `Dear ${item.employeeName},\nPlease find attached your salary slip for ${pad2(item.month)}/${item.year}.\n\n${company.companyName}`);
      await sendEmailMessage({
        settings: emailSettings,
        to: recipient,
        subject,
        textBody: message,
        htmlBody: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
        attachments: [
          {
            filename: fileName,
            path: absolutePath,
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
      res.status(500).json({ error: error.message || 'Could not send salary slip email' });
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

      const settings = await loadPayrollCompanySettings();
      const waConfig = resolveWhatsappConfig(settings);
      if (!waConfig.phoneNumberId || !waConfig.accessToken) {
        return res.status(400).json({ error: 'WhatsApp API settings are incomplete. Configure Phone Number ID and Access Token in Settings.' });
      }

      const company = resolveCompanyDetails(settings);
      const { absolutePath } = await ensureSalarySlipStored({ item, company, branding: settings, withMysqlConnection });
      const fileName = `${normalizeText(item.employeeCode || item.employeeId || 'EMP')}_${item.year}_${pad2(item.month)}.pdf`.replace(/[^\w.-]+/g, '_');
      const graphBase = `https://graph.facebook.com/${waConfig.apiVersion}`;
      const shareOrigin = serverOrigin || 'https://crm.skuaspestcontrol.com';
      const shareLink = `${shareOrigin}/api/payroll/items/${item._id}/slip/pdf?download=1&role=Employee&userId=${encodeURIComponent(item.employeeId || '')}&userName=${encodeURIComponent(item.employeeName || '')}&_ts=${Date.now()}`;
      const caption = String(req.body?.message || `Salary slip for ${pad2(item.month)}/${item.year}\n${company.companyName}\n${shareLink}`).trim().slice(0, 1024);

      const mediaForm = new FormData();
      mediaForm.append('messaging_product', 'whatsapp');
      mediaForm.append('type', 'application/pdf');
      mediaForm.append('file', new Blob([fs.readFileSync(absolutePath)], { type: 'application/pdf' }), fileName);

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
    const employeesList = Array.isArray(readJsonFile(employeesFile, [])) ? readJsonFile(employeesFile, []) : [];
    const employeeCount = identity.ownOnly
      ? new Set(rows.map((entry) => normalizeText(entry.employeeId)).filter(Boolean)).size
      : employeesList.length;
    const totalAllowances = sum(rows, (item) => item.allowances?.total || 0);
    const totalDeductions = sum(rows, (item) => item.deductions?.total || 0);
    const totalMonthlyPayroll = sum(rows, (item) => item.netSalary || 0);
    const paidAmount = sum(paidRows, (item) => item.netSalary || 0);
    const pendingAmount = sum(pendingRows, (item) => item.netSalary || 0);
    const advances = getAdvances().filter((entry) => (identity.ownOnly ? normalizeText(entry.employeeId) === identity.employeeId : true));
    const advanceBalance = sum(advances, (item) => item.balanceAmount || 0);
    const totalExpense = round2(totalMonthlyPayroll + advanceBalance);

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

    const paidVsPendingChart = [
      { key: 'Paid', total: paidAmount },
      { key: 'Pending', total: pendingAmount }
    ];

    res.json({
      month,
      year,
      cards: {
        totalEmployees: employeeCount,
        thisMonthPayroll: totalMonthlyPayroll,
        paidSalaries: paidRows.length,
        pendingSalaries: pendingRows.length,
        advanceSalary: advanceBalance,
        totalExpense
      },
      monthWiseChart,
      paidVsPendingChart
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

  app.post('/api/payroll/seed-sample', async (req, res) => {
    const perms = ensureAccess(req, res, (p) => p.canManageAll, 'Only Admin/HR can seed payroll sample data');
    if (!perms) return;
    let employees = readJsonFile(employeesFile, []);
    if ((!Array.isArray(employees) || employees.length === 0) && canUseMysql) {
      try {
        const mysqlEmployees = await withMysqlConnection(async (conn) => {
          const [rows] = await conn.query(`
            SELECT
              external_id AS _id,
              first_name AS firstName,
              last_name AS lastName,
              emp_code AS empCode,
              salary_per_month AS salaryPerMonth,
              salary AS salary
            FROM employees
            ORDER BY id ASC
          `);
          return Array.isArray(rows) ? rows : [];
        });
        if (Array.isArray(mysqlEmployees) && mysqlEmployees.length > 0) {
          employees = mysqlEmployees.map((entry, index) => ({
            _id: normalizeText(entry?._id) || `EMP-${index + 1}`,
            firstName: normalizeText(entry?.firstName),
            lastName: normalizeText(entry?.lastName),
            empCode: normalizeText(entry?.empCode),
            salaryPerMonth: toNumber(entry?.salaryPerMonth, toNumber(entry?.salary, 0)),
            salary: toNumber(entry?.salary, toNumber(entry?.salaryPerMonth, 0))
          }));
        }
      } catch (error) {
        console.error('Payroll seed employees MySQL fallback failed:', error.message);
      }
    }
    if (employees.length === 0) return res.status(400).json({ error: 'No employees found for seeding' });

    const structures = getStructures();
    const existingEmpSet = new Set(structures.map((entry) => normalizeText(entry.employeeId)));
    const seeds = [];
    employees.forEach((emp, index) => {
      if (existingEmpSet.has(normalizeText(emp._id))) return;
      seeds.push(normalizeSalaryStructure({
        employeeId: emp._id,
        employeeName: [emp?.firstName, emp?.lastName].filter(Boolean).join(' ').trim() || normalizeText(emp?.name || ''),
        employeeCode: normalizeText(emp?.empCode || emp?.employeeCode || ''),
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
    const rows = Array.isArray(payrollCache.audit) ? payrollCache.audit : [];
    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json(rows.slice(0, 500));
  });
}

module.exports = {
  registerPayrollModule
};
