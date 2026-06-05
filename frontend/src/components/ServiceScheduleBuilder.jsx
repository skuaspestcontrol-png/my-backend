import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import {
  buildServiceScheduleRows,
  formatServiceScheduleDate,
  getServiceScheduleRuleLabel,
  normalizeServiceScheduleRows,
  normalizeServiceScheduleTime
} from '../utils/serviceScheduleBuilder';

const styles = {
  block: {
    border: '1px solid var(--color-border)',
    borderRadius: '14px',
    background: '#fff',
    overflow: 'hidden',
    display: 'grid'
  },
  head: {
    padding: '18px 20px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap'
  },
  titleWrap: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '22px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '32px',
    padding: '0 12px',
    borderRadius: '10px',
    background: '#a855f7',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 800,
    lineHeight: 1
  },
  hint: { margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 },
  tableWrap: {
    maxHeight: '430px',
    overflow: 'auto',
    borderTop: '1px solid var(--color-border)',
    background: '#fff'
  },
  table: { width: '100%', minWidth: '1160px', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    borderBottom: '1px solid #d9e1ea',
    borderRight: '1px solid #d9e1ea',
    background: '#f8fafc',
    color: '#55657a',
    fontSize: '13px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    padding: '16px 14px',
    textAlign: 'left'
  },
  td: {
    borderBottom: '1px solid #d9e1ea',
    borderRight: '1px solid #d9e1ea',
    color: '#334155',
    fontSize: '14px',
    padding: '16px 14px',
    verticalAlign: 'middle'
  },
  numberCell: { width: '60px', textAlign: 'center', color: '#475569', fontWeight: 700, fontSize: '20px' },
  serviceCell: { fontSize: '16px', fontWeight: 500, color: '#334155' },
  visitCell: { fontSize: '16px', fontWeight: 400, color: '#475569', whiteSpace: 'pre-line', lineHeight: 1.35 },
  dateInput: {
    width: '100%',
    minHeight: '56px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#475569',
    fontSize: '15px',
    fontWeight: 600,
    padding: '0 14px',
    boxSizing: 'border-box'
  },
  windowGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' },
  emptyState: {
    borderTop: '1px solid var(--color-border)',
    padding: '18px',
    color: '#64748b',
    fontSize: '13px',
    lineHeight: 1.5,
    background: '#fff'
  }
};

const parseDateOnly = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateInput = (value) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDate = (value, days) => {
  const date = parseDateOnly(value);
  if (!date) return '';
  date.setDate(date.getDate() + Number(days || 0));
  return formatDateInput(date);
};

const formatWindowEnd = (nextDate, fallbackDate) => {
  const shifted = shiftDate(nextDate, -1);
  return shifted || formatDateInput(fallbackDate);
};

export default function ServiceScheduleBuilder({
  draft,
  time,
  defaultItemMeta,
  scheduleRows,
  onDraftChange,
  onTimeChange,
  onGenerate,
  onReset,
  onRowsChange,
  errors = {},
  expanded,
  onExpandedChange
}) {
  const normalizedTime = normalizeServiceScheduleTime(time, '10:00');
  const previewRows = useMemo(() => {
    if (Array.isArray(scheduleRows)) {
      return normalizeServiceScheduleRows(scheduleRows, normalizedTime);
    }
    return buildServiceScheduleRows({
      draft,
      defaultTime: normalizedTime,
      itemMeta: defaultItemMeta
    });
  }, [defaultItemMeta, draft, normalizedTime, scheduleRows]);

  const ruleLabel = getServiceScheduleRuleLabel(draft);
  const previewCount = previewRows.length;

  return (
    <section style={styles.block}>
      <div style={styles.head}>
        <div style={styles.titleWrap}>
          <h4 style={styles.title}>Schedule Preview</h4>
          <span style={styles.countBadge}>{previewCount}</span>
        </div>
        <p style={styles.hint}>Preview the next generated visits before saving the contract.</p>
      </div>

      {previewRows.length > 0 ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <colgroup>
              <col style={{ width: '60px' }} />
              <col style={{ width: '116px' }} />
              <col style={{ width: '92px' }} />
              <col style={{ width: '284px' }} />
              <col style={{ width: 'auto' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.numberCell }}>#</th>
                <th style={styles.th}>Service</th>
                <th style={styles.th}>Visit</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Window</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => {
                const currentDate = formatDateInput(row.serviceDate);
                const nextDate = previewRows[index + 1]?.serviceDate || '';
                const windowStart = currentDate;
                const windowEnd = formatWindowEnd(nextDate, currentDate);
                return (
                  <tr key={`${row.serviceDate}-${row.serviceTime}-${index}`}>
                    <td style={{ ...styles.td, ...styles.numberCell }}>{index + 1}</td>
                    <td style={styles.td}>
                      <div style={styles.serviceCell}>{row.itemName || 'Service'}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.visitCell}>{`Visit\n${row.serviceNumber || index + 1}`}</div>
                    </td>
                    <td style={styles.td}>
                      <input type="date" style={styles.dateInput} value={currentDate} readOnly aria-label={`Visit ${index + 1} date`} />
                    </td>
                    <td style={styles.td}>
                      <div style={styles.windowGrid}>
                        <input type="date" style={styles.dateInput} value={windowStart} readOnly aria-label={`Visit ${index + 1} window start`} />
                        <input type="date" style={styles.dateInput} value={windowEnd} readOnly aria-label={`Visit ${index + 1} window end`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={styles.emptyState}>
          No visits are available yet. Choose the contract rule and dates to generate a schedule preview.
          {ruleLabel ? <div style={{ marginTop: '6px', fontWeight: 700, color: '#334155' }}>{ruleLabel}</div> : null}
        </div>
      )}
    </section>
  );
}
