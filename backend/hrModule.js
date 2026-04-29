const fs = require('fs');
const PDFDocument = require('pdfkit');

const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const round2 = (value) => Number((toNumber(value, 0)).toFixed(2));
const normalizeText = (value) => String(value || '').trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const pad2 = (value) => String(value).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const monthRange = (month, year) => {
  const now = new Date();
  const safeMonth = Math.min(12, Math.max(1, toNumber(month, now.getMonth() + 1)));
  const safeYear = Math.max(2000, toNumber(year, now.getFullYear()));
  const start = new Date(safeYear, safeMonth - 1, 1);
  const end = new Date(safeYear, safeMonth, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return {
    month: safeMonth,
    year: safeYear,
    start,
    end
  };
};

const monthLabel = (year, month) => {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
};

const listDates = (start, end) => {
  const cursor = new Date(start);
  const rows = [];
  while (cursor.getTime() <= end.getTime()) {
    rows.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
};

const toMinutes = (value) => {
  const raw = normalizeText(value);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (!match) return null;
  return (Number(match[1]) * 60) + Number(match[2]);
};

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const rolePermissions = (rawRole) => {
  const role = normalizeLower(rawRole || 'employee');
  const isAdmin = role === 'admin';
  const isHr = role.includes('hr');
  const isAccountant = role.includes('account');
  const isManager = role.includes('manager');
  const isEmployee = role.includes('employee') || role.includes('technician') || role.includes('sales') || role.includes('operations');
  return {
    role,
    isAdmin,
    isHr,
    isAccountant,
    isManager,
    isEmployee,
    canManage: isAdmin || isHr,
    canViewTeam: isAdmin || isHr || isManager || isAccountant,
    canViewSelf: true
  };
};

const getReqRole = (req) => normalizeText(req.headers['x-role'] || req.headers['x-portal-role'] || req.query.role || req.body?.role || 'employee');
const getReqUserId = (req) => normalizeText(req.headers['x-user-id'] || req.headers['x-employee-id'] || req.query.userId || req.query.employeeId || req.body?.employeeId || '');
const getReqActor = (req) => normalizeText(req.headers['x-user-name'] || req.headers['x-portal-user'] || req.body?.actor || 'System');

const ensureFile = (filePath, defaultValue) => {
  if (fs.existsSync(filePath)) return;
  fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
};

const normalizeLeave = (raw = {}) => {
  const fromDate = normalizeText(raw.fromDate || raw.date || '');
  const toDate = normalizeText(raw.toDate || raw.date || fromDate);
  const leaveTypeRaw = normalizeLower(raw.leaveType || raw.type || 'paid leave');
  const leaveType = leaveTypeRaw.includes('sick')
    ? 'Sick Leave'
    : leaveTypeRaw.includes('unpaid')
      ? 'Unpaid Leave'
      : 'Paid Leave';
  const statusRaw = normalizeLower(raw.status || 'pending');
  const status = statusRaw === 'approved'
    ? 'Approved'
    : statusRaw === 'rejected'
      ? 'Rejected'
      : 'Pending';

  return {
    _id: normalizeText(raw._id || `LV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    employeeId: normalizeText(raw.employeeId || ''),
    employeeCode: normalizeText(raw.employeeCode || ''),
    employeeName: normalizeText(raw.employeeName || ''),
    leaveType,
    fromDate,
    toDate,
    days: Math.max(0.5, toNumber(raw.days, 1)),
    reason: normalizeText(raw.reason || ''),
    status,
    reviewedBy: normalizeText(raw.reviewedBy || ''),
    reviewedAt: normalizeText(raw.reviewedAt || ''),
    createdAt: normalizeText(raw.createdAt || new Date().toISOString()),
    updatedAt: new Date().toISOString()
  };
};

const normalizeNotification = (raw = {}) => ({
  _id: normalizeText(raw._id || `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  type: normalizeText(raw.type || 'info'),
  title: normalizeText(raw.title || 'Notification'),
  message: normalizeText(raw.message || ''),
  level: normalizeText(raw.level || 'normal'),
  relatedEmployeeId: normalizeText(raw.relatedEmployeeId || ''),
  isRead: !!raw.isRead,
  createdAt: normalizeText(raw.createdAt || new Date().toISOString()),
  expiresAt: normalizeText(raw.expiresAt || ''),
  updatedAt: new Date().toISOString()
});

const normalizeEmployeeWorkflow = (raw = {}) => {
  const statusRaw = normalizeLower(raw.status || 'active employees');
  const statusMap = {
    'new joiners': 'New Joiners',
    'active employees': 'Active Employees',
    'on probation': 'On Probation',
    'on leave': 'On Leave',
    'under review': 'Under Review',
    resigned: 'Resigned',
    terminated: 'Terminated'
  };
  return {
    employeeId: normalizeText(raw.employeeId || ''),
    status: statusMap[statusRaw] || 'Active Employees',
    priority: normalizeText(raw.priority || 'Normal'),
    lastActivity: normalizeText(raw.lastActivity || ''),
    currentTask: normalizeText(raw.currentTask || ''),
    updatedAt: new Date().toISOString()
  };
};

const normalizePerformance = (raw = {}) => ({
  employeeId: normalizeText(raw.employeeId || ''),
  jobsCompleted: Math.max(0, toNumber(raw.jobsCompleted, 0)),
  onTimeCompletion: Math.max(0, Math.min(100, toNumber(raw.onTimeCompletion, 0))),
  customerFeedback: Math.max(0, Math.min(5, toNumber(raw.customerFeedback, 0))),
  repeatComplaints: Math.max(0, toNumber(raw.repeatComplaints, 0)),
  revenueGenerated: Math.max(0, toNumber(raw.revenueGenerated, 0)),
  score: Math.max(0, Math.min(100, toNumber(raw.score, 0))),
  updatedAt: new Date().toISOString()
});

const buildEmployeeName = (employee = {}) => {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
  return name || employee.empCode || 'Employee';
};

const parseDateForMonth = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
};

const getLatestSalary = (salaryStructures, employeeId, monthEnd) => {
  const list = (Array.isArray(salaryStructures) ? salaryStructures : [])
    .filter((entry) => normalizeText(entry.employeeId) === normalizeText(employeeId))
    .sort((a, b) => String(a.effectiveDate || '').localeCompare(String(b.effectiveDate || '')));

  if (list.length === 0) return null;
  const end = toDateOnly(monthEnd);
  if (!end) return list[list.length - 1];

  let selected = list[0];
  list.forEach((item) => {
    const date = toDateOnly(item.effectiveDate);
    if (date && date.getTime() <= end.getTime()) selected = item;
  });
  return selected;
};

const deriveEmployeeBaseSalary = (employee, salaryStructures, endDate) => {
  const fromStructure = getLatestSalary(salaryStructures, employee._id, endDate);
  if (fromStructure && toNumber(fromStructure.basicSalary, 0) > 0) return toNumber(fromStructure.basicSalary, 0);
  return Math.max(0, toNumber(employee.salaryPerMonth ?? employee.salary, 0));
};

const summarizeAttendanceMonth = ({ employeeId, attendanceRows, lateMinutes = 15, shiftStart = '09:00', month, year }) => {
  const { start, end } = monthRange(month, year);
  const rows = (Array.isArray(attendanceRows) ? attendanceRows : []).filter((entry) => {
    if (normalizeText(entry.employeeId) !== normalizeText(employeeId)) return false;
    const day = toDateOnly(entry.date);
    if (!day) return false;
    return day.getTime() >= start.getTime() && day.getTime() <= end.getTime();
  });

  let present = 0;
  let absent = 0;
  let leave = 0;
  let halfDay = 0;
  let lateMarks = 0;
  let overtimeHours = 0;
  const startMins = toMinutes(shiftStart);

  rows.forEach((entry) => {
    const status = normalizeLower(entry.status);
    if (status === 'present') present += 1;
    else if (status === 'half-day') halfDay += 1;
    else if (status === 'leave') leave += 1;
    else if (status === 'absent') absent += 1;

    const inMins = toMinutes(entry.checkIn);
    if (inMins !== null && startMins !== null && inMins > (startMins + lateMinutes)) lateMarks += 1;

    const wh = toNumber(entry.workingHours, 0);
    if (wh > 8) overtimeHours += (wh - 8);
  });

  return {
    present,
    absent,
    leave,
    halfDay,
    lateMarks,
    overtimeHours: round2(overtimeHours),
    totalEntries: rows.length
  };
};

const buildTrendFromAttendance = (attendanceRows, month, year) => {
  const { start, end } = monthRange(month, year);
  const dateRows = listDates(start, end);
  const byDate = new Map();

  (Array.isArray(attendanceRows) ? attendanceRows : []).forEach((entry) => {
    const date = toDateOnly(entry.date);
    if (!date) return;
    if (date.getTime() < start.getTime() || date.getTime() > end.getTime()) return;
    const key = toDateKey(date);
    const current = byDate.get(key) || { date: key, present: 0, absent: 0, leave: 0, halfDay: 0 };
    const status = normalizeLower(entry.status);
    if (status === 'present') current.present += 1;
    else if (status === 'absent') current.absent += 1;
    else if (status === 'leave') current.leave += 1;
    else if (status === 'half-day') current.halfDay += 1;
    byDate.set(key, current);
  });

  return dateRows.map((date) => {
    const key = toDateKey(date);
    const base = byDate.get(key) || { date: key, present: 0, absent: 0, leave: 0, halfDay: 0 };
    return {
      ...base,
      label: `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`,
      onDuty: base.present + base.halfDay
    };
  });
};

const computeAttendanceToday = ({ employees, attendanceRows, leaves, today }) => {
  const todayKey = toDateKey(today);
  const attendanceByEmployee = new Map(
    (Array.isArray(attendanceRows) ? attendanceRows : [])
      .filter((entry) => normalizeText(entry.date) === todayKey)
      .map((entry) => [normalizeText(entry.employeeId), entry])
  );

  const leaveByEmployee = new Map();
  (Array.isArray(leaves) ? leaves : []).forEach((entry) => {
    const leave = normalizeLeave(entry);
    if (leave.status !== 'Approved') return;
    const from = toDateOnly(leave.fromDate);
    const to = toDateOnly(leave.toDate);
    if (!from || !to) return;
    if (today.getTime() < from.getTime() || today.getTime() > to.getTime()) return;
    leaveByEmployee.set(leave.employeeId, leave);
  });

  const rows = [];
  let onDuty = 0;
  let absent = 0;
  let onLeave = 0;
  let lateCheckins = 0;

  employees.forEach((employee) => {
    const id = normalizeText(employee._id);
    const attendance = attendanceByEmployee.get(id);
    const leave = leaveByEmployee.get(id);
    const name = buildEmployeeName(employee);

    if (leave && !attendance) {
      onLeave += 1;
      rows.push({
        employeeId: id,
        employeeCode: normalizeText(employee.empCode),
        employeeName: name,
        role: normalizeText(employee.role || ''),
        department: normalizeText(employee.department || employee.role || ''),
        status: 'Leave',
        checkIn: '',
        checkOut: '',
        late: false,
        leaveType: leave.leaveType
      });
      return;
    }

    if (!attendance) {
      absent += 1;
      rows.push({
        employeeId: id,
        employeeCode: normalizeText(employee.empCode),
        employeeName: name,
        role: normalizeText(employee.role || ''),
        department: normalizeText(employee.department || employee.role || ''),
        status: 'Absent',
        checkIn: '',
        checkOut: '',
        late: false,
        leaveType: ''
      });
      return;
    }

    const status = normalizeLower(attendance.status);
    const inMins = toMinutes(attendance.checkIn);
    const late = inMins !== null && inMins > (9 * 60) + 15;
    if (late) lateCheckins += 1;

    if (status === 'present' || status === 'half-day') onDuty += 1;
    if (status === 'leave') onLeave += 1;
    if (status === 'absent') absent += 1;

    rows.push({
      employeeId: id,
      employeeCode: normalizeText(employee.empCode),
      employeeName: name,
      role: normalizeText(employee.role || ''),
      department: normalizeText(employee.department || employee.role || ''),
      status: status === 'half-day' ? 'Half Day' : (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Present'),
      checkIn: normalizeText(attendance.checkIn),
      checkOut: normalizeText(attendance.checkOut),
      late,
      leaveType: normalizeText(attendance.leaveType)
    });
  });

  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return {
    summary: { onDuty, absent, onLeave, lateCheckins },
    rows
  };
};

const calcPerformanceScore = (metrics) => {
  const jobs = Math.min(100, toNumber(metrics.jobsCompleted, 0) * 4);
  const onTime = Math.max(0, Math.min(100, toNumber(metrics.onTimeCompletion, 0)));
  const feedback = Math.max(0, Math.min(100, (toNumber(metrics.customerFeedback, 0) / 5) * 100));
  const complaintsPenalty = Math.max(0, 100 - (toNumber(metrics.repeatComplaints, 0) * 12));
  return round2((jobs * 0.3) + (onTime * 0.3) + (feedback * 0.25) + (complaintsPenalty * 0.15));
};

const parseCompletionDate = (job) => {
  const v = normalizeText(job.completionCardGeneratedAt || job.punchOutTime || job.updatedAt || job.createdAt || '');
  if (!v) return null;
  const date = new Date(v);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildPerformanceRows = ({ employees, jobs, invoices, performanceStored }) => {
  const revenueByInvoice = new Map();
  (Array.isArray(invoices) ? invoices : []).forEach((invoice) => {
    revenueByInvoice.set(normalizeText(invoice._id), Math.max(0, toNumber(invoice.total ?? invoice.amount, 0)));
  });

  const storedMap = new Map(
    (Array.isArray(performanceStored) ? performanceStored : [])
      .map((entry) => normalizePerformance(entry))
      .filter((entry) => entry.employeeId)
      .map((entry) => [entry.employeeId, entry])
  );

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return (Array.isArray(employees) ? employees : []).map((employee) => {
    const id = normalizeText(employee._id);
    const isTechnician = normalizeLower(employee.role).includes('technician');
    const name = buildEmployeeName(employee);

    const assignedJobs = (Array.isArray(jobs) ? jobs : []).filter((job) => normalizeText(job.technicianId) === id);
    const completedJobs = assignedJobs.filter((job) => normalizeLower(job.status) === 'completed');

    let onTimeCount = 0;
    completedJobs.forEach((job) => {
      const scheduled = toDateOnly(job.scheduledDate);
      const completed = parseCompletionDate(job);
      if (!scheduled || !completed) {
        onTimeCount += 1;
        return;
      }
      const endOfScheduled = new Date(scheduled);
      endOfScheduled.setHours(23, 59, 59, 999);
      if (completed.getTime() <= endOfScheduled.getTime()) onTimeCount += 1;
    });

    const monthCompletedJobs = completedJobs.filter((job) => {
      const completed = parseCompletionDate(job);
      if (!completed) return false;
      return completed.getTime() >= thisMonthStart.getTime();
    });

    const revenueGenerated = completedJobs.reduce((sum, job) => {
      const invoiceRevenue = revenueByInvoice.get(normalizeText(job.contractId));
      if (!invoiceRevenue) return sum;
      return sum + invoiceRevenue;
    }, 0);

    const base = {
      employeeId: id,
      employeeName: name,
      employeeCode: normalizeText(employee.empCode),
      role: normalizeText(employee.role || ''),
      designation: normalizeText(employee.roleName || employee.role || ''),
      isTechnician,
      jobsCompleted: completedJobs.length,
      onTimeCompletion: completedJobs.length > 0 ? round2((onTimeCount / completedJobs.length) * 100) : 0,
      customerFeedback: completedJobs.length > 0 ? 4.2 : 0,
      repeatComplaints: Math.max(0, assignedJobs.length - completedJobs.length > 1 ? 1 : 0),
      revenueGenerated: round2(revenueGenerated),
      monthCompletedJobs: monthCompletedJobs.length,
      score: 0
    };

    const stored = storedMap.get(id);
    const merged = stored
      ? {
          ...base,
          ...stored,
          employeeId: id,
          employeeName: name,
          employeeCode: normalizeText(employee.empCode),
          role: normalizeText(employee.role || ''),
          designation: normalizeText(employee.roleName || employee.role || ''),
          isTechnician
        }
      : base;

    return {
      ...merged,
      score: calcPerformanceScore(merged)
    };
  });
};

const buildCsv = (rows) => {
  const escape = (value) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return rows.map((row) => row.map(escape).join(',')).join('\n');
};

const buildSimplePdfBuffer = ({ title, rows }) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a').text('SKUAS Pest Control', 36, 36);
  doc.font('Helvetica').fontSize(10).fillColor('#334155').text('Phone: 9316666656 | Website: www.skuaspestcontrol.com', 36, 58);
  doc.moveTo(36, 76).lineTo(559, 76).strokeColor('#cbd5e1').stroke();

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(title, 36, 90);
  let y = 116;
  rows.forEach((line) => {
    if (y > 780) {
      doc.addPage();
      y = 48;
    }
    doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(line, 36, y, { width: 523 });
    y += 14;
  });

  doc.end();
});

function registerHrModule({
  app,
  readJsonFile,
  files
}) {
  const {
    employeesFile,
    attendanceFile,
    jobsFile,
    invoicesFile,
    payrollItemsFile,
    salaryStructuresFile,
    advancesFile,
    leavesFile,
    notificationsFile,
    workflowFile,
    performanceFile
  } = files;

  ensureFile(leavesFile, []);
  ensureFile(notificationsFile, []);
  ensureFile(workflowFile, []);
  ensureFile(performanceFile, []);

  const getEmployees = () => readJsonFile(employeesFile, []);
  const getAttendance = () => readJsonFile(attendanceFile, []);
  const getJobs = () => readJsonFile(jobsFile, []);
  const getInvoices = () => readJsonFile(invoicesFile, []);
  const getPayrollItems = () => readJsonFile(payrollItemsFile, []);
  const getSalaryStructures = () => readJsonFile(salaryStructuresFile, []);
  const getAdvances = () => readJsonFile(advancesFile, []);
  const getLeaves = () => readJsonFile(leavesFile, []).map((entry) => normalizeLeave(entry));
  const getNotifications = () => readJsonFile(notificationsFile, []).map((entry) => normalizeNotification(entry));
  const getWorkflow = () => readJsonFile(workflowFile, []).map((entry) => normalizeEmployeeWorkflow(entry));
  const getPerformance = () => readJsonFile(performanceFile, []).map((entry) => normalizePerformance(entry));

  const saveLeaves = (rows) => fs.writeFileSync(leavesFile, JSON.stringify(rows, null, 2));
  const saveNotifications = (rows) => fs.writeFileSync(notificationsFile, JSON.stringify(rows, null, 2));
  const saveWorkflow = (rows) => fs.writeFileSync(workflowFile, JSON.stringify(rows, null, 2));
  const savePerformance = (rows) => fs.writeFileSync(performanceFile, JSON.stringify(rows, null, 2));

  const ensureWorkflowSeed = () => {
    const employees = getEmployees();
    const current = getWorkflow();
    const map = new Map(current.map((entry) => [entry.employeeId, entry]));
    let changed = false;

    employees.forEach((employee) => {
      const id = normalizeText(employee._id);
      if (!id) return;
      if (map.has(id)) return;
      const role = normalizeLower(employee.role);
      const defaultStatus = role.includes('technician') ? 'Active Employees' : 'New Joiners';
      const createdAt = parseDateForMonth(employee.createdAt);
      const currentTask = role.includes('technician') ? 'Assigned field service' : 'Back office operations';
      map.set(id, normalizeEmployeeWorkflow({
        employeeId: id,
        status: defaultStatus,
        priority: 'Normal',
        lastActivity: createdAt ? createdAt.toISOString() : new Date().toISOString(),
        currentTask
      }));
      changed = true;
    });

    if (changed) {
      const next = Array.from(map.values());
      saveWorkflow(next);
      return next;
    }

    return current;
  };

  const ensurePerformanceSeed = () => {
    const employees = getEmployees();
    const jobs = getJobs();
    const invoices = getInvoices();
    const current = getPerformance();
    const currentMap = new Map(current.map((entry) => [entry.employeeId, entry]));

    const computed = buildPerformanceRows({
      employees,
      jobs,
      invoices,
      performanceStored: current
    });

    const next = computed.map((entry) => {
      const stored = currentMap.get(entry.employeeId);
      if (!stored) return normalizePerformance(entry);
      return normalizePerformance({ ...entry, ...stored, score: entry.score });
    });

    savePerformance(next);
    return next;
  };

  const getEmployeeActivityMap = (jobs) => {
    const map = new Map();
    (Array.isArray(jobs) ? jobs : []).forEach((job) => {
      const employeeId = normalizeText(job.technicianId);
      if (!employeeId) return;
      const stamp = parseDateForMonth(job.updatedAt || job.createdAt || job.completionCardGeneratedAt || '');
      if (!stamp) return;
      const current = map.get(employeeId);
      if (!current || current.getTime() < stamp.getTime()) map.set(employeeId, stamp);
    });
    return map;
  };

  const buildDashboardPayload = ({ month, year, department, role, location, status, search }) => {
    const today = toDateOnly(new Date());
    const employees = getEmployees();
    const attendance = getAttendance();
    const jobs = getJobs();
    const payrollItems = getPayrollItems();
    const salaryStructures = getSalaryStructures();
    const leaves = getLeaves();
    const advances = getAdvances();

    const workflow = ensureWorkflowSeed();
    const performance = ensurePerformanceSeed();
    const workflowByEmployee = new Map(workflow.map((entry) => [entry.employeeId, entry]));
    const performanceByEmployee = new Map(performance.map((entry) => [entry.employeeId, entry]));
    const latestActivityByEmployee = getEmployeeActivityMap(jobs);

    const normalizedSearch = normalizeLower(search || '');

    const filteredEmployees = employees.filter((employee) => {
      const dep = normalizeLower(employee.department || employee.role || '');
      const roleName = normalizeLower(employee.role || '');
      const city = normalizeLower(employee.city || employee.location || '');
      const employeeWorkflow = workflowByEmployee.get(normalizeText(employee._id));
      const state = normalizeLower(employeeWorkflow?.status || 'active employees');
      const fullName = buildEmployeeName(employee).toLowerCase();
      const empCode = normalizeLower(employee.empCode || '');

      if (department && dep !== normalizeLower(department)) return false;
      if (role && roleName !== normalizeLower(role)) return false;
      if (location && city !== normalizeLower(location)) return false;
      if (status && state !== normalizeLower(status)) return false;
      if (normalizedSearch && !(`${fullName} ${empCode}`.includes(normalizedSearch))) return false;
      return true;
    });

    const employeeIds = new Set(filteredEmployees.map((entry) => normalizeText(entry._id)));

    const { month: safeMonth, year: safeYear, start, end } = monthRange(month, year);
    const monthPayroll = payrollItems.filter((entry) => {
      if (toNumber(entry.month, 0) !== safeMonth) return false;
      if (toNumber(entry.year, 0) !== safeYear) return false;
      if (!employeeIds.has(normalizeText(entry.employeeId))) return false;
      return true;
    });

    const attendanceToday = computeAttendanceToday({
      employees: filteredEmployees,
      attendanceRows: attendance,
      leaves,
      today
    });

    const monthAttendance = attendance.filter((entry) => {
      const date = toDateOnly(entry.date);
      if (!date) return false;
      if (date.getTime() < start.getTime() || date.getTime() > end.getTime()) return false;
      return employeeIds.has(normalizeText(entry.employeeId));
    });

    let totalOvertimeHours = 0;
    let totalLateMarks = 0;

    const leaveCountByEmployee = new Map();
    const lateCountByEmployee = new Map();

    filteredEmployees.forEach((employee) => {
      const summary = summarizeAttendanceMonth({
        employeeId: employee._id,
        attendanceRows: monthAttendance,
        month: safeMonth,
        year: safeYear
      });
      totalOvertimeHours += summary.overtimeHours;
      totalLateMarks += summary.lateMarks;
      leaveCountByEmployee.set(employee._id, summary.leave + summary.absent + (summary.halfDay * 0.5));
      lateCountByEmployee.set(employee._id, summary.lateMarks);
    });

    const leaveTypeDistribution = { 'Sick Leave': 0, 'Paid Leave': 0, 'Unpaid Leave': 0 };
    leaves.forEach((entry) => {
      const leave = normalizeLeave(entry);
      if (leave.status !== 'Approved') return;
      if (!employeeIds.has(leave.employeeId)) return;
      const from = toDateOnly(leave.fromDate);
      if (!from) return;
      if (from.getMonth() + 1 !== safeMonth || from.getFullYear() !== safeYear) return;
      leaveTypeDistribution[leave.leaveType] = (leaveTypeDistribution[leave.leaveType] || 0) + leave.days;
    });

    const departmentMap = new Map();
    filteredEmployees.forEach((employee) => {
      const dep = normalizeText(employee.department || employee.role || 'Unassigned');
      departmentMap.set(dep, (departmentMap.get(dep) || 0) + 1);
    });

    const salaryExpenseChart = [];
    for (let i = 5; i >= 0; i -= 1) {
      const pointer = new Date(safeYear, safeMonth - 1, 1);
      pointer.setMonth(pointer.getMonth() - i);
      const m = pointer.getMonth() + 1;
      const y = pointer.getFullYear();
      const amount = payrollItems
        .filter((entry) => toNumber(entry.month, 0) === m && toNumber(entry.year, 0) === y)
        .reduce((sum, entry) => sum + Math.max(0, toNumber(entry.netSalary, 0)), 0);

      const fallback = filteredEmployees.reduce((sum, employee) => {
        const salary = deriveEmployeeBaseSalary(employee, salaryStructures, pointer);
        return sum + salary;
      }, 0);

      salaryExpenseChart.push({
        month: monthLabel(y, m),
        amount: round2(amount || fallback)
      });
    }

    const productivity = filteredEmployees
      .map((employee) => {
        const perf = performanceByEmployee.get(normalizeText(employee._id));
        return {
          employeeId: normalizeText(employee._id),
          employeeName: buildEmployeeName(employee),
          jobsCompleted: Math.max(0, toNumber(perf?.monthCompletedJobs ?? perf?.jobsCompleted, 0)),
          score: toNumber(perf?.score, 0)
        };
      })
      .sort((a, b) => b.jobsCompleted - a.jobsCompleted)
      .slice(0, 8);

    const sortedLeaves = [...filteredEmployees]
      .sort((a, b) => (leaveCountByEmployee.get(b._id) || 0) - (leaveCountByEmployee.get(a._id) || 0))
      .slice(0, 5)
      .map((employee) => ({
        employeeId: employee._id,
        employeeName: buildEmployeeName(employee),
        value: round2(leaveCountByEmployee.get(employee._id) || 0)
      }));

    const sortedLate = [...filteredEmployees]
      .sort((a, b) => (lateCountByEmployee.get(b._id) || 0) - (lateCountByEmployee.get(a._id) || 0))
      .slice(0, 5)
      .map((employee) => ({
        employeeId: employee._id,
        employeeName: buildEmployeeName(employee),
        value: round2(lateCountByEmployee.get(employee._id) || 0)
      }));

    const topPerformers = [...performance]
      .filter((entry) => employeeIds.has(entry.employeeId))
      .sort((a, b) => toNumber(b.score, 0) - toNumber(a.score, 0))
      .slice(0, 5)
      .map((entry) => ({
        employeeId: entry.employeeId,
        employeeName: buildEmployeeName(filteredEmployees.find((employee) => normalizeText(employee._id) === normalizeText(entry.employeeId)) || {}),
        value: round2(entry.score)
      }));

    const pendingSalaryEmployees = monthPayroll
      .filter((entry) => normalizeLower(entry.paymentStatus || '') !== 'paid')
      .slice(0, 8)
      .map((entry) => ({
        employeeId: entry.employeeId,
        employeeName: normalizeText(entry.employeeName || ''),
        value: round2(entry.netSalary)
      }));

    const upcomingBirthdays = filteredEmployees
      .map((employee) => {
        const dob = parseDateForMonth(employee.dateOfBirth);
        if (!dob) return null;
        const now = new Date();
        const next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate());
        if (next.getTime() < now.getTime()) next.setFullYear(now.getFullYear() + 1);
        const days = Math.round((next.getTime() - now.getTime()) / 86400000);
        return {
          employeeId: employee._id,
          employeeName: buildEmployeeName(employee),
          date: toDateKey(next),
          days
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.days - b.days)
      .slice(0, 6);

    const cards = {
      totalEmployees: filteredEmployees.length,
      activeEmployees: workflow.filter((entry) => employeeIds.has(entry.employeeId) && entry.status === 'Active Employees').length,
      inactiveEmployees: workflow.filter((entry) => employeeIds.has(entry.employeeId) && (entry.status === 'Resigned' || entry.status === 'Terminated')).length,
      techniciansOnDutyToday: attendanceToday.summary.onDuty,
      absentToday: attendanceToday.summary.absent,
      onLeaveToday: attendanceToday.summary.onLeave,
      lateCheckins: attendanceToday.summary.lateCheckins,
      totalPayrollCurrentMonth: round2(monthPayroll.reduce((sum, entry) => sum + toNumber(entry.netSalary, 0), 0) || filteredEmployees.reduce((sum, employee) => sum + deriveEmployeeBaseSalary(employee, salaryStructures, end), 0)),
      pendingSalaryPayments: round2(monthPayroll.filter((entry) => normalizeLower(entry.paymentStatus) !== 'paid').reduce((sum, entry) => sum + toNumber(entry.netSalary, 0), 0)),
      totalOvertimeHours: round2(totalOvertimeHours),
      newJoineesThisMonth: filteredEmployees.filter((employee) => {
        const createdAt = parseDateForMonth(employee.createdAt);
        if (!createdAt) return false;
        return createdAt.getMonth() + 1 === safeMonth && createdAt.getFullYear() === safeYear;
      }).length
    };

    const payrollQuick = {
      pendingEmployees: monthPayroll.filter((entry) => normalizeLower(entry.paymentStatus) !== 'paid').map((entry) => ({
        employeeId: entry.employeeId,
        employeeName: normalizeText(entry.employeeName || ''),
        amount: round2(entry.netSalary)
      })),
      processedThisMonth: monthPayroll.length,
      paidAmount: round2(monthPayroll.filter((entry) => normalizeLower(entry.paymentStatus) === 'paid').reduce((sum, entry) => sum + toNumber(entry.netSalary, 0), 0)),
      pendingAmount: round2(monthPayroll.filter((entry) => normalizeLower(entry.paymentStatus) !== 'paid').reduce((sum, entry) => sum + toNumber(entry.netSalary, 0), 0)),
      advanceSalaryGiven: round2((Array.isArray(advances) ? advances : []).filter((entry) => employeeIds.has(normalizeText(entry.employeeId))).reduce((sum, entry) => sum + toNumber(entry.amount, 0), 0)),
      deductionSummary: round2(monthPayroll.reduce((sum, entry) => sum + toNumber(entry.deductions?.total, 0), 0)),
      holdEmployees: monthPayroll.filter((entry) => normalizeLower(entry.payrollStatus) === 'hold').length
    };

    const alerts = [
      ...attendanceToday.rows.filter((entry) => entry.status === 'Absent').map((entry) => ({
        type: 'absence',
        title: 'Absent Alert',
        message: `${entry.employeeName} is absent today`,
        relatedEmployeeId: entry.employeeId
      })),
      ...pendingSalaryEmployees.map((entry) => ({
        type: 'payroll',
        title: 'Salary Pending',
        message: `${entry.employeeName} salary is pending`,
        relatedEmployeeId: entry.employeeId
      })),
      ...leaves.filter((entry) => entry.status === 'Pending').map((entry) => ({
        type: 'leave',
        title: 'Leave Request',
        message: `${entry.employeeName} requested ${entry.leaveType}`,
        relatedEmployeeId: entry.employeeId
      }))
    ].slice(0, 20);

    return {
      month: safeMonth,
      year: safeYear,
      cards,
      charts: {
        attendanceTrend: buildTrendFromAttendance(monthAttendance, safeMonth, safeYear),
        departmentEmployeeCount: Array.from(departmentMap.entries()).map(([name, value]) => ({ name, value })),
        salaryExpenseChart,
        leaveTypeDistribution: Object.entries(leaveTypeDistribution).map(([name, value]) => ({ name, value: round2(value) })),
        technicianProductivity: productivity
      },
      quickInsights: {
        highestLeaves: sortedLeaves,
        frequentLateMarks: sortedLate,
        topPerformers,
        pendingSalary: pendingSalaryEmployees,
        upcomingBirthdays,
        upcomingAnniversaries: []
      },
      payrollQuick,
      alerts,
      attendanceToday
    };
  };

  const makeAccessScope = (req) => {
    const permissions = rolePermissions(getReqRole(req));
    const employeeId = getReqUserId(req);
    const ownOnly = permissions.canViewTeam ? false : permissions.canViewSelf;
    return {
      permissions,
      employeeId,
      ownOnly
    };
  };

  const applyScopeFilter = (rows, scope, idSelector = (entry) => normalizeText(entry.employeeId)) => {
    if (!scope.ownOnly) return rows;
    if (!scope.employeeId) return [];
    return rows.filter((entry) => normalizeText(idSelector(entry)) === normalizeText(scope.employeeId));
  };

  app.get('/api/hr/dashboard-summary', (req, res) => {
    try {
      const payload = buildDashboardPayload({
        month: req.query.month,
        year: req.query.year,
        department: req.query.department,
        role: req.query.role,
        location: req.query.location,
        status: req.query.status,
        search: req.query.search
      });
      res.json(payload);
    } catch (error) {
      console.error('Failed to build HR dashboard summary:', error.message);
      res.status(500).json({ error: 'Could not load HR dashboard summary' });
    }
  });

  app.get('/api/hr/kanban', (req, res) => {
    try {
      const scope = makeAccessScope(req);
      const employees = getEmployees();
      const workflow = ensureWorkflowSeed();
      const workflowByEmployee = new Map(workflow.map((entry) => [entry.employeeId, entry]));
      const attendance = getAttendance();
      const leaves = getLeaves();
      const payrollItems = getPayrollItems();
      const today = toDateOnly(new Date());
      const todayKey = toDateKey(today);

      const department = normalizeLower(req.query.department || '');
      const role = normalizeLower(req.query.role || '');
      const location = normalizeLower(req.query.location || '');
      const status = normalizeLower(req.query.status || '');
      const search = normalizeLower(req.query.search || '');

      const rows = employees
        .filter((employee) => {
          const dep = normalizeLower(employee.department || employee.role || '');
          const roleName = normalizeLower(employee.role || '');
          const city = normalizeLower(employee.city || '');
          const workflowRow = workflowByEmployee.get(normalizeText(employee._id));
          const rowStatus = normalizeLower(workflowRow?.status || 'active employees');
          const name = buildEmployeeName(employee).toLowerCase();
          const empCode = normalizeLower(employee.empCode || '');

          if (scope.ownOnly && normalizeText(employee._id) !== normalizeText(scope.employeeId)) return false;
          if (department && dep !== department) return false;
          if (role && roleName !== role) return false;
          if (location && city !== location) return false;
          if (status && rowStatus !== status) return false;
          if (search && !(`${name} ${empCode}`.includes(search))) return false;
          return true;
        })
        .map((employee) => {
          const id = normalizeText(employee._id);
          const flow = workflowByEmployee.get(id) || normalizeEmployeeWorkflow({ employeeId: id });
          const todayAttendance = attendance.find((entry) => normalizeText(entry.employeeId) === id && normalizeText(entry.date) === todayKey);
          const monthSummary = summarizeAttendanceMonth({
            employeeId: id,
            attendanceRows: attendance,
            month: Number(req.query.month) || today.getMonth() + 1,
            year: Number(req.query.year) || today.getFullYear()
          });
          const pendingLeaves = leaves.filter((entry) => normalizeText(entry.employeeId) === id && entry.status === 'Pending').length;
          const latestPayroll = [...payrollItems]
            .filter((entry) => normalizeText(entry.employeeId) === id)
            .sort((a, b) => `${b.year}-${pad2(b.month)}-${b.updatedAt || b.createdAt || ''}`.localeCompare(`${a.year}-${pad2(a.month)}-${a.updatedAt || a.createdAt || ''}`))[0];

          return {
            employeeId: id,
            employeeCode: normalizeText(employee.empCode),
            employeeName: buildEmployeeName(employee),
            photoUrl: normalizeText(employee.profileImageUrl || employee.imageUrl || ''),
            role: normalizeText(employee.role || ''),
            designation: normalizeText(employee.roleName || employee.role || ''),
            department: normalizeText(employee.department || employee.role || ''),
            location: normalizeText(employee.city || ''),
            status: flow.status,
            priority: flow.priority || 'Normal',
            attendanceSummary: {
              present: monthSummary.present,
              absent: monthSummary.absent,
              leave: monthSummary.leave + monthSummary.halfDay
            },
            todayStatus: todayAttendance ? normalizeText(todayAttendance.status) : 'absent',
            lastActivity: flow.lastActivity || normalizeText(employee.updatedAt || employee.createdAt || ''),
            currentTask: flow.currentTask || (normalizeLower(employee.role).includes('technician') ? 'Field assignment' : 'Department operations'),
            salaryStatus: normalizeText(latestPayroll?.paymentStatus || 'Pending'),
            pendingLeaves
          };
        });

      const columns = ['New Joiners', 'Active Employees', 'On Probation', 'On Leave', 'Under Review', 'Resigned', 'Terminated'];
      const grouped = columns.map((column) => ({
        name: column,
        items: rows.filter((entry) => entry.status === column)
      }));

      res.json({ columns: grouped, total: rows.length });
    } catch (error) {
      console.error('Failed to load HR kanban:', error.message);
      res.status(500).json({ error: 'Could not load HR kanban board' });
    }
  });

  app.put('/api/hr/employees/:id/status', (req, res) => {
    const scope = makeAccessScope(req);
    if (!scope.permissions.canManage) return res.status(403).json({ error: 'Only Admin/HR can update employee workflow status' });

    const employeeId = normalizeText(req.params.id);
    const status = normalizeText(req.body?.status);
    const validStatuses = new Set(['New Joiners', 'Active Employees', 'On Probation', 'On Leave', 'Under Review', 'Resigned', 'Terminated']);
    if (!validStatuses.has(status)) return res.status(400).json({ error: 'Invalid workflow status' });

    const rows = ensureWorkflowSeed();
    const index = rows.findIndex((entry) => normalizeText(entry.employeeId) === employeeId);
    const payload = normalizeEmployeeWorkflow({
      employeeId,
      status,
      priority: req.body?.priority || (rows[index]?.priority || 'Normal'),
      lastActivity: new Date().toISOString(),
      currentTask: req.body?.currentTask || (rows[index]?.currentTask || '')
    });

    if (index >= 0) rows[index] = { ...rows[index], ...payload, updatedAt: new Date().toISOString() };
    else rows.push(payload);

    saveWorkflow(rows);
    res.json({ message: 'Employee workflow status updated', row: payload });
  });

  app.get('/api/hr/attendance', (req, res) => {
    const scope = makeAccessScope(req);
    const date = normalizeText(req.query.date || '');
    const employeeId = normalizeText(req.query.employeeId || '');
    const department = normalizeLower(req.query.department || '');

    const employees = getEmployees();
    const employeesById = new Map(employees.map((entry) => [normalizeText(entry._id), entry]));
    const rows = getAttendance().filter((entry) => {
      if (date && normalizeText(entry.date) !== date) return false;
      if (employeeId && normalizeText(entry.employeeId) !== employeeId) return false;
      if (scope.ownOnly && normalizeText(entry.employeeId) !== normalizeText(scope.employeeId)) return false;
      const employee = employeesById.get(normalizeText(entry.employeeId));
      if (department && normalizeLower(employee?.department || employee?.role || '') !== department) return false;
      return true;
    });

    rows.sort((a, b) => `${a.date}-${a.employeeName}`.localeCompare(`${b.date}-${b.employeeName}`));
    res.json(rows);
  });

  app.get('/api/hr/attendance/today', (req, res) => {
    const scope = makeAccessScope(req);
    const employees = getEmployees();
    const leaves = getLeaves();
    const attendance = getAttendance();
    const today = toDateOnly(new Date());
    const payload = computeAttendanceToday({ employees, attendanceRows: attendance, leaves, today });
    const filteredRows = applyScopeFilter(payload.rows, scope, (entry) => entry.employeeId);
    res.json({ summary: payload.summary, rows: filteredRows });
  });

  app.post('/api/hr/attendance/manual', (req, res) => {
    const scope = makeAccessScope(req);
    if (!scope.permissions.canManage) return res.status(403).json({ error: 'Only Admin/HR can mark attendance manually' });

    const employeeId = normalizeText(req.body?.employeeId);
    const date = normalizeText(req.body?.date);
    if (!employeeId || !date) return res.status(400).json({ error: 'employeeId and date are required' });

    const employees = getEmployees();
    const employee = employees.find((entry) => normalizeText(entry._id) === employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const records = getAttendance();
    const index = records.findIndex((entry) => normalizeText(entry.employeeId) === employeeId && normalizeText(entry.date) === date);
    const statusRaw = normalizeLower(req.body?.status || 'present');
    const status = ['present', 'absent', 'leave', 'half-day', 'weekly-off'].includes(statusRaw) ? statusRaw : 'present';

    const next = {
      _id: index >= 0 ? records[index]._id : `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      employeeId,
      employeeCode: normalizeText(employee.empCode || ''),
      employeeName: buildEmployeeName(employee),
      date,
      status,
      checkIn: normalizeText(req.body?.checkIn),
      checkOut: normalizeText(req.body?.checkOut),
      leaveType: normalizeText(req.body?.leaveType),
      leaveReason: normalizeText(req.body?.leaveReason),
      notes: normalizeText(req.body?.notes),
      workingHours: round2(toNumber(req.body?.workingHours, 0)),
      updatedAt: new Date().toISOString(),
      updatedBy: getReqActor(req)
    };

    if (index >= 0) records[index] = { ...records[index], ...next, _id: records[index]._id };
    else records.push(next);

    fs.writeFileSync(attendanceFile, JSON.stringify(records, null, 2));
    res.json(next);
  });

  app.post('/api/hr/attendance/bulk', (req, res) => {
    const scope = makeAccessScope(req);
    if (!scope.permissions.canManage) return res.status(403).json({ error: 'Only Admin/HR can bulk upload attendance' });

    const payload = Array.isArray(req.body?.records) ? req.body.records : [];
    if (payload.length === 0) return res.status(400).json({ error: 'records array is required' });

    const employees = getEmployees();
    const employeeById = new Map(employees.map((entry) => [normalizeText(entry._id), entry]));
    const records = getAttendance();
    let upserted = 0;

    payload.forEach((entry) => {
      const employeeId = normalizeText(entry.employeeId);
      const date = normalizeText(entry.date);
      if (!employeeId || !date) return;
      const employee = employeeById.get(employeeId);
      if (!employee) return;
      const idx = records.findIndex((row) => normalizeText(row.employeeId) === employeeId && normalizeText(row.date) === date);
      const next = {
        _id: idx >= 0 ? records[idx]._id : `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        employeeId,
        employeeCode: normalizeText(employee.empCode || ''),
        employeeName: buildEmployeeName(employee),
        date,
        status: ['present', 'absent', 'leave', 'half-day', 'weekly-off'].includes(normalizeLower(entry.status)) ? normalizeLower(entry.status) : 'present',
        checkIn: normalizeText(entry.checkIn),
        checkOut: normalizeText(entry.checkOut),
        leaveType: normalizeText(entry.leaveType),
        leaveReason: normalizeText(entry.leaveReason),
        notes: normalizeText(entry.notes),
        workingHours: round2(toNumber(entry.workingHours, 0)),
        updatedAt: new Date().toISOString(),
        updatedBy: getReqActor(req)
      };

      if (idx >= 0) records[idx] = { ...records[idx], ...next, _id: records[idx]._id };
      else records.push(next);
      upserted += 1;
    });

    fs.writeFileSync(attendanceFile, JSON.stringify(records, null, 2));
    res.json({ message: 'Attendance bulk upload completed', upserted });
  });

  app.get('/api/hr/leaves', (req, res) => {
    const scope = makeAccessScope(req);
    const rows = getLeaves();
    const filtered = rows.filter((entry) => {
      if (scope.ownOnly && normalizeText(entry.employeeId) !== normalizeText(scope.employeeId)) return false;
      const status = normalizeLower(req.query.status || '');
      const employeeId = normalizeText(req.query.employeeId || '');
      const leaveType = normalizeLower(req.query.leaveType || '');
      const month = toNumber(req.query.month, 0);
      const year = toNumber(req.query.year, 0);

      if (status && normalizeLower(entry.status) !== status) return false;
      if (employeeId && normalizeText(entry.employeeId) !== employeeId) return false;
      if (leaveType && normalizeLower(entry.leaveType) !== leaveType) return false;
      if (month || year) {
        const from = toDateOnly(entry.fromDate);
        if (!from) return false;
        if (month && from.getMonth() + 1 !== month) return false;
        if (year && from.getFullYear() !== year) return false;
      }
      return true;
    });

    filtered.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json(filtered);
  });

  app.get('/api/hr/leaves/calendar', (req, res) => {
    const scope = makeAccessScope(req);
    const month = toNumber(req.query.month, new Date().getMonth() + 1);
    const year = toNumber(req.query.year, new Date().getFullYear());
    const { start, end } = monthRange(month, year);

    const rows = getLeaves().filter((entry) => {
      if (scope.ownOnly && normalizeText(entry.employeeId) !== normalizeText(scope.employeeId)) return false;
      const from = toDateOnly(entry.fromDate);
      const to = toDateOnly(entry.toDate);
      if (!from || !to) return false;
      if (to.getTime() < start.getTime() || from.getTime() > end.getTime()) return false;
      return true;
    });

    const calendar = [];
    rows.forEach((entry) => {
      const from = toDateOnly(entry.fromDate);
      const to = toDateOnly(entry.toDate);
      if (!from || !to) return;
      const dates = listDates(from, to).filter((d) => d.getTime() >= start.getTime() && d.getTime() <= end.getTime());
      dates.forEach((date) => {
        calendar.push({
          date: toDateKey(date),
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          leaveType: entry.leaveType,
          status: entry.status
        });
      });
    });

    res.json(calendar);
  });

  app.get('/api/hr/leaves/balance', (req, res) => {
    const scope = makeAccessScope(req);
    const employees = getEmployees();
    const leaves = getLeaves().filter((entry) => entry.status === 'Approved');
    const month = toNumber(req.query.month, new Date().getMonth() + 1);
    const year = toNumber(req.query.year, new Date().getFullYear());

    const rows = applyScopeFilter(employees, scope, (entry) => entry._id).map((employee) => {
      const id = normalizeText(employee._id);
      const used = leaves.filter((entry) => {
        if (normalizeText(entry.employeeId) !== id) return false;
        const date = toDateOnly(entry.fromDate);
        if (!date) return false;
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      });

      const paidUsed = round2(used.filter((entry) => entry.leaveType === 'Paid Leave').reduce((sum, entry) => sum + toNumber(entry.days, 0), 0));
      const sickUsed = round2(used.filter((entry) => entry.leaveType === 'Sick Leave').reduce((sum, entry) => sum + toNumber(entry.days, 0), 0));
      const unpaidUsed = round2(used.filter((entry) => entry.leaveType === 'Unpaid Leave').reduce((sum, entry) => sum + toNumber(entry.days, 0), 0));

      const annualPaid = 12;
      const annualSick = 8;

      return {
        employeeId: id,
        employeeCode: normalizeText(employee.empCode),
        employeeName: buildEmployeeName(employee),
        paidLeave: { total: annualPaid, used: paidUsed, balance: round2(Math.max(0, annualPaid - paidUsed)) },
        sickLeave: { total: annualSick, used: sickUsed, balance: round2(Math.max(0, annualSick - sickUsed)) },
        unpaidLeave: { used: unpaidUsed }
      };
    });

    res.json(rows);
  });

  app.post('/api/hr/leaves', (req, res) => {
    const scope = makeAccessScope(req);
    const employeeId = normalizeText(req.body?.employeeId || scope.employeeId);
    if (!employeeId) return res.status(400).json({ error: 'employeeId is required' });

    if (scope.ownOnly && normalizeText(scope.employeeId) !== employeeId) {
      return res.status(403).json({ error: 'You can only create your own leave request' });
    }

    const employees = getEmployees();
    const employee = employees.find((entry) => normalizeText(entry._id) === employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const payload = normalizeLeave({
      ...req.body,
      employeeId,
      employeeCode: employee.empCode,
      employeeName: buildEmployeeName(employee),
      status: 'Pending'
    });

    if (!payload.fromDate || !payload.toDate) return res.status(400).json({ error: 'fromDate and toDate are required' });

    const rows = getLeaves();
    rows.push(payload);
    saveLeaves(rows);

    const notifications = getNotifications();
    notifications.unshift(normalizeNotification({
      type: 'leave',
      title: 'Leave Request Alert',
      message: `${payload.employeeName} requested ${payload.leaveType} (${payload.fromDate} to ${payload.toDate})`,
      relatedEmployeeId: payload.employeeId,
      level: 'high'
    }));
    saveNotifications(notifications.slice(0, 500));

    res.json(payload);
  });

  app.put('/api/hr/leaves/:id/decision', (req, res) => {
    const scope = makeAccessScope(req);
    if (!scope.permissions.canManage) return res.status(403).json({ error: 'Only Admin/HR can approve/reject leave' });

    const id = normalizeText(req.params.id);
    const decision = normalizeLower(req.body?.decision);
    const status = decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : '';
    if (!status) return res.status(400).json({ error: 'decision must be approved or rejected' });

    const rows = getLeaves();
    const index = rows.findIndex((entry) => normalizeText(entry._id) === id);
    if (index < 0) return res.status(404).json({ error: 'Leave request not found' });

    rows[index] = {
      ...rows[index],
      status,
      reviewedBy: getReqActor(req),
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveLeaves(rows);

    const notifications = getNotifications();
    notifications.unshift(normalizeNotification({
      type: 'leave',
      title: `Leave ${status}`,
      message: `${rows[index].employeeName} leave request ${status.toLowerCase()}`,
      relatedEmployeeId: rows[index].employeeId,
      level: status === 'Rejected' ? 'high' : 'normal'
    }));
    saveNotifications(notifications.slice(0, 500));

    res.json(rows[index]);
  });

  app.get('/api/hr/performance', (req, res) => {
    const scope = makeAccessScope(req);
    const employees = getEmployees();
    const jobs = getJobs();
    const invoices = getInvoices();
    const stored = getPerformance();

    const rows = buildPerformanceRows({ employees, jobs, invoices, performanceStored: stored });
    savePerformance(rows.map((entry) => normalizePerformance(entry)));

    const filtered = applyScopeFilter(rows, scope, (entry) => entry.employeeId)
      .filter((entry) => {
        const department = normalizeLower(req.query.department || '');
        const role = normalizeLower(req.query.role || '');
        const search = normalizeLower(req.query.search || '');
        if (department && normalizeLower(entry.role) !== department) return false;
        if (role && normalizeLower(entry.role) !== role) return false;
        if (search && !(`${normalizeLower(entry.employeeName)} ${normalizeLower(entry.employeeCode)}`.includes(search))) return false;
        return true;
      })
      .sort((a, b) => b.score - a.score);

    const topPerformers = filtered.slice(0, 10);
    const lowPerformanceAlerts = filtered.filter((entry) => entry.score < 55).slice(0, 10);

    res.json({
      rows: filtered,
      leaderboard: topPerformers,
      lowPerformanceAlerts,
      chart: filtered.slice(0, 12).map((entry) => ({
        employeeName: entry.employeeName,
        score: entry.score,
        jobsCompleted: entry.jobsCompleted
      }))
    });
  });

  app.get('/api/hr/payroll-summary', (req, res) => {
    const scope = makeAccessScope(req);
    const month = toNumber(req.query.month, new Date().getMonth() + 1);
    const year = toNumber(req.query.year, new Date().getFullYear());

    const payrollItems = getPayrollItems();
    const advances = getAdvances();

    const filtered = payrollItems.filter((entry) => {
      if (toNumber(entry.month, 0) !== month) return false;
      if (toNumber(entry.year, 0) !== year) return false;
      if (scope.ownOnly && normalizeText(entry.employeeId) !== normalizeText(scope.employeeId)) return false;
      return true;
    });

    const pending = filtered.filter((entry) => normalizeLower(entry.paymentStatus) !== 'paid');
    const paid = filtered.filter((entry) => normalizeLower(entry.paymentStatus) === 'paid');

    const pendingEmployees = pending.map((entry) => ({
      employeeId: entry.employeeId,
      employeeName: normalizeText(entry.employeeName),
      amount: round2(entry.netSalary)
    }));

    const deductionSummary = filtered.reduce((sum, entry) => sum + toNumber(entry.deductions?.total, 0), 0);
    const advanceBalance = (Array.isArray(advances) ? advances : [])
      .filter((entry) => !scope.ownOnly || normalizeText(entry.employeeId) === normalizeText(scope.employeeId))
      .reduce((sum, entry) => sum + toNumber(entry.balanceAmount, 0), 0);

    res.json({
      month,
      year,
      employeesWithPendingSalary: pendingEmployees,
      salaryProcessedThisMonth: filtered.length,
      paidSalaryAmount: round2(paid.reduce((sum, entry) => sum + toNumber(entry.netSalary, 0), 0)),
      pendingSalaryAmount: round2(pending.reduce((sum, entry) => sum + toNumber(entry.netSalary, 0), 0)),
      advanceSalaryGiven: round2((Array.isArray(advances) ? advances : []).reduce((sum, entry) => sum + toNumber(entry.amount, 0), 0)),
      deductionsSummary: round2(deductionSummary),
      advanceSalaryBalance: round2(advanceBalance),
      quickAction: {
        label: 'Generate Payroll',
        endpoint: '/api/payroll/generate',
        method: 'POST',
        payload: { month, year }
      }
    });
  });

  app.get('/api/hr/notifications', (req, res) => {
    const scope = makeAccessScope(req);
    const saved = getNotifications();

    const dynamic = [];
    const today = toDateOnly(new Date());
    const attendanceToday = computeAttendanceToday({
      employees: getEmployees(),
      attendanceRows: getAttendance(),
      leaves: getLeaves(),
      today
    });

    attendanceToday.rows
      .filter((entry) => entry.status === 'Absent')
      .slice(0, 10)
      .forEach((entry) => {
        dynamic.push(normalizeNotification({
          _id: `AUTO-ABS-${entry.employeeId}`,
          type: 'absence',
          title: 'Employee Absent Alert',
          message: `${entry.employeeName} is absent today`,
          relatedEmployeeId: entry.employeeId,
          level: 'high',
          createdAt: new Date().toISOString(),
          isRead: false
        }));
      });

    getLeaves()
      .filter((entry) => entry.status === 'Pending')
      .slice(0, 10)
      .forEach((entry) => {
        dynamic.push(normalizeNotification({
          _id: `AUTO-LV-${entry._id}`,
          type: 'leave',
          title: 'Leave Request Alert',
          message: `${entry.employeeName} requested ${entry.leaveType}`,
          relatedEmployeeId: entry.employeeId,
          level: 'normal',
          createdAt: new Date().toISOString(),
          isRead: false
        }));
      });

    const rows = [...dynamic, ...saved]
      .filter((entry) => !scope.ownOnly || normalizeText(entry.relatedEmployeeId) === normalizeText(scope.employeeId) || !entry.relatedEmployeeId)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 100);

    res.json(rows);
  });

  app.put('/api/hr/notifications/:id/read', (req, res) => {
    const id = normalizeText(req.params.id);
    const rows = getNotifications();
    const index = rows.findIndex((entry) => normalizeText(entry._id) === id);
    if (index < 0) return res.status(404).json({ error: 'Notification not found' });
    rows[index] = { ...rows[index], isRead: true, updatedAt: new Date().toISOString() };
    saveNotifications(rows);
    res.json(rows[index]);
  });

  app.get('/api/hr/employees/:id/profile', (req, res) => {
    const scope = makeAccessScope(req);
    const employeeId = normalizeText(req.params.id);
    if (scope.ownOnly && normalizeText(scope.employeeId) !== employeeId) {
      return res.status(403).json({ error: 'You can only view your own profile' });
    }

    const employees = getEmployees();
    const employee = employees.find((entry) => normalizeText(entry._id) === employeeId);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    const attendance = getAttendance();
    const leaves = getLeaves();
    const payrollItems = getPayrollItems();
    const jobs = getJobs();
    const performance = ensurePerformanceSeed().find((entry) => normalizeText(entry.employeeId) === employeeId) || null;

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const attendanceSummary = summarizeAttendanceMonth({
      employeeId,
      attendanceRows: attendance,
      month,
      year
    });

    const leaveBalance = getLeaves()
      .filter((entry) => normalizeText(entry.employeeId) === employeeId && entry.status === 'Approved')
      .reduce((acc, entry) => {
        if (entry.leaveType === 'Paid Leave') acc.paidUsed += toNumber(entry.days, 0);
        if (entry.leaveType === 'Sick Leave') acc.sickUsed += toNumber(entry.days, 0);
        if (entry.leaveType === 'Unpaid Leave') acc.unpaidUsed += toNumber(entry.days, 0);
        return acc;
      }, { paidUsed: 0, sickUsed: 0, unpaidUsed: 0 });

    const latestPayroll = [...payrollItems]
      .filter((entry) => normalizeText(entry.employeeId) === employeeId)
      .sort((a, b) => `${b.year}-${pad2(b.month)}-${b.updatedAt || b.createdAt || ''}`.localeCompare(`${a.year}-${pad2(a.month)}-${a.updatedAt || a.createdAt || ''}`))[0] || null;

    const tasks = jobs
      .filter((entry) => normalizeText(entry.technicianId) === employeeId)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 8)
      .map((entry) => ({
        jobId: entry._id,
        customerName: normalizeText(entry.customerName),
        serviceName: normalizeText(entry.serviceName),
        status: normalizeText(entry.status),
        scheduledDate: normalizeText(entry.scheduledDate),
        scheduledTime: normalizeText(entry.scheduledTime)
      }));

    res.json({
      personal: {
        employeeId,
        employeeCode: normalizeText(employee.empCode),
        employeeName: buildEmployeeName(employee),
        mobile: normalizeText(employee.mobile),
        email: normalizeText(employee.emailId || employee.email),
        gender: normalizeText(employee.gender),
        dateOfBirth: normalizeText(employee.dateOfBirth),
        city: normalizeText(employee.city),
        address: normalizeText(employee.presentAddress || employee.permanentAddress),
        profilePhoto: normalizeText(employee.profileImageUrl || employee.imageUrl)
      },
      job: {
        role: normalizeText(employee.role),
        designation: normalizeText(employee.roleName || employee.role),
        department: normalizeText(employee.department || employee.role),
        joiningDate: normalizeText(employee.createdAt),
        portalAccess: normalizeText(employee.portalAccess || (employee.webPortalAccessEnabled ? 'Yes' : 'No'))
      },
      attendanceSummary,
      leaveBalance: {
        paid: { total: 12, used: round2(leaveBalance.paidUsed), balance: round2(Math.max(0, 12 - leaveBalance.paidUsed)) },
        sick: { total: 8, used: round2(leaveBalance.sickUsed), balance: round2(Math.max(0, 8 - leaveBalance.sickUsed)) },
        unpaidUsed: round2(leaveBalance.unpaidUsed)
      },
      salary: latestPayroll
        ? {
            month: latestPayroll.month,
            year: latestPayroll.year,
            grossSalary: round2(latestPayroll.grossSalary),
            netSalary: round2(latestPayroll.netSalary),
            paymentStatus: normalizeText(latestPayroll.paymentStatus),
            payrollStatus: normalizeText(latestPayroll.payrollStatus)
          }
        : {
            month,
            year,
            grossSalary: round2(toNumber(employee.salaryPerMonth ?? employee.salary, 0)),
            netSalary: round2(toNumber(employee.salaryPerMonth ?? employee.salary, 0)),
            paymentStatus: 'Pending',
            payrollStatus: 'Draft'
          },
      assignedTasks: tasks,
      performance: performance || {
        jobsCompleted: 0,
        onTimeCompletion: 0,
        customerFeedback: 0,
        repeatComplaints: 0,
        revenueGenerated: 0,
        score: 0
      }
    });
  });

  app.get('/api/hr/filters', (req, res) => {
    const employees = getEmployees();
    const departments = Array.from(new Set(employees.map((entry) => normalizeText(entry.department || entry.role || '')).filter(Boolean))).sort();
    const roles = Array.from(new Set(employees.map((entry) => normalizeText(entry.role || '')).filter(Boolean))).sort();
    const locations = Array.from(new Set(employees.map((entry) => normalizeText(entry.city || '')).filter(Boolean))).sort();
    const statuses = ['New Joiners', 'Active Employees', 'On Probation', 'On Leave', 'Under Review', 'Resigned', 'Terminated'];

    res.json({ departments, roles, locations, statuses });
  });

  app.get('/api/hr/reports/monthly-payroll', async (req, res) => {
    try {
      const scope = makeAccessScope(req);
      const month = toNumber(req.query.month, new Date().getMonth() + 1);
      const year = toNumber(req.query.year, new Date().getFullYear());
      const format = normalizeLower(req.query.format || 'json');

      const rows = getPayrollItems()
        .filter((entry) => toNumber(entry.month, 0) === month && toNumber(entry.year, 0) === year)
        .filter((entry) => !scope.ownOnly || normalizeText(entry.employeeId) === normalizeText(scope.employeeId))
        .map((entry) => ({
          employeeCode: normalizeText(entry.employeeCode),
          employeeName: normalizeText(entry.employeeName),
          department: normalizeText(entry.department),
          grossSalary: round2(entry.grossSalary),
          deductions: round2(entry.deductions?.total),
          netSalary: round2(entry.netSalary),
          paymentStatus: normalizeText(entry.paymentStatus),
          payrollStatus: normalizeText(entry.payrollStatus)
        }));

      if (format === 'csv' || format === 'excel') {
        const csv = buildCsv([
          ['Employee Code', 'Employee Name', 'Department', 'Gross Salary', 'Deductions', 'Net Salary', 'Payment Status', 'Payroll Status'],
          ...rows.map((entry) => [entry.employeeCode, entry.employeeName, entry.department, entry.grossSalary, entry.deductions, entry.netSalary, entry.paymentStatus, entry.payrollStatus])
        ]);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="monthly_payroll_${year}_${pad2(month)}.csv"`);
        return res.send(csv);
      }

      if (format === 'pdf') {
        const pdfRows = [
          `Monthly Payroll Report - ${monthLabel(year, month)}`,
          `Total Employees: ${rows.length}`,
          `Total Payroll: ${formatCurrency(rows.reduce((sum, entry) => sum + toNumber(entry.netSalary, 0), 0))}`,
          ''
        ];
        rows.forEach((entry) => {
          pdfRows.push(`${entry.employeeCode} | ${entry.employeeName} | ${entry.department} | Net ${formatCurrency(entry.netSalary)} | ${entry.paymentStatus}`);
        });

        const buffer = await buildSimplePdfBuffer({ title: 'Monthly Payroll Report', rows: pdfRows });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="monthly_payroll_${year}_${pad2(month)}.pdf"`);
        return res.send(buffer);
      }

      return res.json({ month, year, rows });
    } catch (error) {
      console.error('Failed monthly payroll report export:', error.message);
      return res.status(500).json({ error: 'Could not export monthly payroll report' });
    }
  });

  app.get('/api/hr/reports/employee-salary', async (req, res) => {
    try {
      const scope = makeAccessScope(req);
      const format = normalizeLower(req.query.format || 'json');
      const rows = getPayrollItems()
        .filter((entry) => !scope.ownOnly || normalizeText(entry.employeeId) === normalizeText(scope.employeeId))
        .sort((a, b) => `${b.year}-${pad2(b.month)}-${b.employeeName}`.localeCompare(`${a.year}-${pad2(a.month)}-${a.employeeName}`))
        .map((entry) => ({
          monthYear: `${pad2(entry.month)}/${entry.year}`,
          employeeCode: normalizeText(entry.employeeCode),
          employeeName: normalizeText(entry.employeeName),
          grossSalary: round2(entry.grossSalary),
          allowances: round2(entry.allowances?.total),
          deductions: round2(entry.deductions?.total),
          netSalary: round2(entry.netSalary)
        }));

      if (format === 'csv' || format === 'excel') {
        const csv = buildCsv([
          ['Month/Year', 'Employee Code', 'Employee Name', 'Gross Salary', 'Allowances', 'Deductions', 'Net Salary'],
          ...rows.map((entry) => [entry.monthYear, entry.employeeCode, entry.employeeName, entry.grossSalary, entry.allowances, entry.deductions, entry.netSalary])
        ]);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="employee_salary_report.csv"');
        return res.send(csv);
      }

      if (format === 'pdf') {
        const pdfRows = ['Employee Salary Report', ''];
        rows.forEach((entry) => {
          pdfRows.push(`${entry.monthYear} | ${entry.employeeCode} | ${entry.employeeName} | Net ${formatCurrency(entry.netSalary)}`);
        });
        const buffer = await buildSimplePdfBuffer({ title: 'Employee Salary Report', rows: pdfRows });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="employee_salary_report.pdf"');
        return res.send(buffer);
      }

      return res.json({ rows });
    } catch (error) {
      console.error('Failed employee salary report export:', error.message);
      return res.status(500).json({ error: 'Could not export employee salary report' });
    }
  });

  app.get('/api/hr/reports/deductions', async (req, res) => {
    try {
      const scope = makeAccessScope(req);
      const format = normalizeLower(req.query.format || 'json');
      const rows = getPayrollItems()
        .filter((entry) => !scope.ownOnly || normalizeText(entry.employeeId) === normalizeText(scope.employeeId))
        .map((entry) => ({
          monthYear: `${pad2(entry.month)}/${entry.year}`,
          employeeCode: normalizeText(entry.employeeCode),
          employeeName: normalizeText(entry.employeeName),
          leaveDeduction: round2(entry.deductions?.leaveDeduction),
          lateDeduction: round2(entry.deductions?.lateComingDeduction),
          advanceDeduction: round2(entry.deductions?.advanceSalaryDeduction),
          loanDeduction: round2(entry.deductions?.loanDeduction),
          pf: round2(entry.deductions?.pf),
          esi: round2(entry.deductions?.esi),
          other: round2(entry.deductions?.otherDeduction),
          total: round2(entry.deductions?.total)
        }));

      if (format === 'csv' || format === 'excel') {
        const csv = buildCsv([
          ['Month/Year', 'Employee Code', 'Employee Name', 'Leave Deduction', 'Late Deduction', 'Advance Deduction', 'Loan Deduction', 'PF', 'ESI', 'Other', 'Total'],
          ...rows.map((entry) => [entry.monthYear, entry.employeeCode, entry.employeeName, entry.leaveDeduction, entry.lateDeduction, entry.advanceDeduction, entry.loanDeduction, entry.pf, entry.esi, entry.other, entry.total])
        ]);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="deduction_report.csv"');
        return res.send(csv);
      }

      return res.json({ rows });
    } catch (error) {
      console.error('Failed deduction report export:', error.message);
      return res.status(500).json({ error: 'Could not export deduction report' });
    }
  });

  app.get('/api/hr/reports/advances', async (req, res) => {
    try {
      const scope = makeAccessScope(req);
      const format = normalizeLower(req.query.format || 'json');
      const rows = getAdvances()
        .filter((entry) => !scope.ownOnly || normalizeText(entry.employeeId) === normalizeText(scope.employeeId))
        .map((entry) => ({
          advanceId: normalizeText(entry._id),
          employeeId: normalizeText(entry.employeeId),
          amount: round2(entry.amount),
          recoveredAmount: round2(entry.recoveredAmount),
          balanceAmount: round2(entry.balanceAmount),
          status: normalizeText(entry.status),
          issuedDate: normalizeText(entry.issuedDate)
        }));

      if (format === 'csv' || format === 'excel') {
        const csv = buildCsv([
          ['Advance ID', 'Employee ID', 'Amount', 'Recovered', 'Balance', 'Status', 'Issued Date'],
          ...rows.map((entry) => [entry.advanceId, entry.employeeId, entry.amount, entry.recoveredAmount, entry.balanceAmount, entry.status, entry.issuedDate])
        ]);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="advance_salary_report.csv"');
        return res.send(csv);
      }

      return res.json({ rows });
    } catch (error) {
      console.error('Failed advance report export:', error.message);
      return res.status(500).json({ error: 'Could not export advance report' });
    }
  });

  app.get('/api/hr/ai-performance-suggestions', (req, res) => {
    const scope = makeAccessScope(req);
    const performance = ensurePerformanceSeed();
    const rows = applyScopeFilter(performance, scope, (entry) => entry.employeeId);

    const suggestions = rows.slice(0, 20).map((entry) => {
      if (entry.score >= 80) {
        return {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName || entry.employeeId,
          suggestion: 'Eligible for advanced assignments and leadership mentoring.',
          score: entry.score
        };
      }
      if (entry.score >= 60) {
        return {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName || entry.employeeId,
          suggestion: 'Maintain consistency with punctuality and customer feedback follow-ups.',
          score: entry.score
        };
      }
      return {
        employeeId: entry.employeeId,
        employeeName: entry.employeeName || entry.employeeId,
        suggestion: 'Recommend coaching plan: attendance discipline + job quality checklist review.',
        score: entry.score
      };
    });

    res.json({ suggestions });
  });
}

module.exports = {
  registerHrModule
};
