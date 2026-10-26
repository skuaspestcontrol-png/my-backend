// HR uses the same persisted employee/payroll sources as the portal, without
// invoking payroll cache hydration, recalculation, schema setup or backfills.
const object = (value) => {
  if (value && typeof value === 'object') return value;
  try { const parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' ? parsed : {}; } catch { return {}; }
};
const createHrPortalReaders = ({ canUseMysql, withMysqlConnection, readJsonFile, files, mapEmployee }) => {
  const employees = async () => {
    if (!canUseMysql()) return readJsonFile(files.employeesFile, []);
    const rows = await withMysqlConnection(async (conn) => {
      const [data] = await conn.query(`SELECT id, external_id, emp_code, first_name, last_name, role, role_name, mobile, email, city, pincode, profile_photo, present_address, salary, joining_date, employment_status, resignation_date, status, app_access_enabled, web_portal_access_enabled, payload FROM employees ORDER BY id DESC`);
      return data;
    });
    const mapped = rows.map(mapEmployee);
    const ids = mapped.map((entry) => String(entry._id || '').trim());
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('Employee identity unavailable');
    return mapped;
  };
  const payroll = async () => {
    if (!canUseMysql()) return readJsonFile(files.payrollItemsFile, []);
    const rows = await withMysqlConnection(async (conn) => {
      const [data] = await conn.query(`SELECT payroll_key, employee_id, employee_name, month, year, net_salary, payment_status, payroll_status, payload FROM payroll_records ORDER BY year DESC, month DESC, employee_id ASC`);
      return data;
    });
    return rows.map((row) => {
      if (row.net_salary == null || typeof row.net_salary === 'boolean' || String(row.net_salary).trim() === '' || !Number.isFinite(Number(row.net_salary))) throw new Error('Stored payroll total unavailable');
      return { ...object(row.payload), _id: row.payroll_key, employeeId: String(row.employee_id), employeeName: row.employee_name, month: Number(row.month), year: Number(row.year), netSalary: Number(row.net_salary), paymentStatus: row.payment_status, payrollStatus: row.payroll_status };
    });
  };
  const attendance = async () => {
    if (!canUseMysql()) return readJsonFile(files.attendanceFile, []);
    const rows = await withMysqlConnection(async (conn) => {
      const [data] = await conn.query(`SELECT id, external_id, employee_id, employee_external_id, employee_code, employee_name,
        DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date_value,
        DATE_FORMAT(\`date\`, '%Y-%m-%d') AS legacy_date_value,
        TIME_FORMAT(check_in, '%H:%i:%s') AS check_in_value,
        TIME_FORMAT(check_out, '%H:%i:%s') AS check_out_value,
        TIME_FORMAT(check_in_time, '%H:%i:%s') AS legacy_check_in_value,
        TIME_FORMAT(check_out_time, '%H:%i:%s') AS legacy_check_out_value,
        working_minutes, working_hours, status, leave_type, source, payload FROM attendance ORDER BY id DESC`);
      return data;
    });
    return rows.map((row) => {
      const payload = object(row.payload);
      return { ...payload, _id: payload._id || row.external_id || `ATT-${row.id}`,
        employeeId: payload.employeeId || row.employee_external_id || row.employee_id || '',
        employeeCode: payload.employeeCode || row.employee_code || '', employeeName: payload.employeeName || row.employee_name || '',
        date: payload.date || row.attendance_date_value || row.legacy_date_value || '', status: payload.status || row.status,
        checkIn: row.check_in_value || row.legacy_check_in_value || payload.checkIn || '',
        checkOut: row.check_out_value || row.legacy_check_out_value || payload.checkOut || '',
        workingMinutes: row.working_minutes ?? payload.workingMinutes ?? payload.working_minutes,
        workingHours: row.working_hours ?? payload.workingHours ?? payload.working_hours,
        leaveType: payload.leaveType || row.leave_type || '', source: payload.source || row.source || '' };
    });
  };
  return { employees, payroll, attendance, canUseMysql };
};
const getHrBusinessDate = (now = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
module.exports = { createHrPortalReaders, getHrBusinessDate };
