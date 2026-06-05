import React, { useMemo, useRef } from 'react';
import { Calendar } from 'lucide-react';
import {
  buildServiceScheduleRows,
  formatServiceScheduleDate,
  normalizeServiceScheduleRows,
  normalizeServiceScheduleTime
} from '../utils/serviceScheduleBuilder';

const styles = {
  block: {
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    background: '#fff',
    overflow: 'hidden',
    display: 'grid'
  },
  head: {
    padding: '6px 10px',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap'
  },
  titleWrap: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' },
  title: { margin: 0, fontSize: '13px', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '18px',
    padding: '0 7px',
    borderRadius: '6px',
    background: '#a855f7',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 800,
    lineHeight: 1
  },
  hint: { margin: 0, fontSize: '9px', color: '#64748b', lineHeight: 1.25 },
  tableWrap: {
    maxHeight: '240px',
    overflow: 'auto',
    borderTop: '1px solid var(--color-border)',
    background: '#fff'
  },
  table: { width: '100%', minWidth: '760px', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: {
    borderBottom: '1px solid #d9e1ea',
    borderRight: '1px solid #d9e1ea',
    background: '#f8fafc',
    color: '#55657a',
    fontSize: '8px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    padding: '3px 8px',
    textAlign: 'left'
  },
  td: {
    borderBottom: '1px solid #d9e1ea',
    borderRight: '1px solid #d9e1ea',
    color: '#334155',
    fontSize: '10px',
    padding: '3px 8px',
    verticalAlign: 'middle'
  },
  numberCell: { width: '34px', textAlign: 'center', color: '#475569', fontWeight: 700, fontSize: '11px', paddingTop: '3px', paddingBottom: '3px' },
  dateCell: { fontSize: '10px', fontWeight: 600, color: '#334155', lineHeight: 1.05, whiteSpace: 'nowrap' },
  preferredCell: { fontSize: '10px', fontWeight: 600, color: '#475569', lineHeight: 1.05, whiteSpace: 'nowrap' },
  dateInput: {
    width: '100%',
    minHeight: '22px',
    height: '22px',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    background: '#fff',
    color: '#475569',
    fontSize: '8px',
    fontWeight: 600,
    padding: '0 22px 0 5px',
    boxSizing: 'border-box'
  },
  dateField: {
    position: 'relative',
    width: '100%',
    display: 'flex',
    alignItems: 'center'
  },
  dateIcon: {
    position: 'absolute',
    right: '6px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    cursor: 'pointer'
  },
  emptyState: {
    borderTop: '1px solid var(--color-border)',
    padding: '10px',
    color: '#64748b',
    fontSize: '10px',
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
  const dateInputRefs = useRef({});
  const previewRows = useMemo(() => {
    if (Array.isArray(scheduleRows) && scheduleRows.length > 0) {
      return normalizeServiceScheduleRows(scheduleRows, normalizedTime);
    }
    return buildServiceScheduleRows({
      draft,
      defaultTime: normalizedTime,
      itemMeta: defaultItemMeta
    });
  }, [defaultItemMeta, draft, normalizedTime, scheduleRows]);

  const previewCount = previewRows.length;

  const handleServiceDateChange = (index, nextDate) => {
    if (typeof onRowsChange !== 'function') return;
    const updatedRows = previewRows.map((row, rowIndex) =>
      rowIndex === index
        ? { ...row, serviceDate: nextDate, finalServiceDate: nextDate, serviceNumber: rowIndex + 1 }
        : row
    );
    onRowsChange(updatedRows);
  };

  const focusDatePicker = (index) => {
    const input = dateInputRefs.current?.[index];
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

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
              <col style={{ width: '34px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '220px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...styles.th, ...styles.numberCell }}>#</th>
                <th style={styles.th}>Base Date</th>
                <th style={styles.th}>Preferred Day</th>
                <th style={styles.th}>Final Service Date</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => {
                const currentDate = formatDateInput(row.finalServiceDate || row.serviceDate);
                const baseDate = row.baseServiceDate || row.serviceDate;
                const preferredDayLabel = row.preferredDayLabel || 'Normal dates';
                return (
                  <tr key={`${row.finalServiceDate || row.serviceDate}-${row.serviceTime}-${index}`}>
                    <td style={{ ...styles.td, ...styles.numberCell }}>{index + 1}</td>
                    <td style={styles.td}>
                      <div style={styles.dateCell}>{formatServiceScheduleDate(baseDate)}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.preferredCell}>{preferredDayLabel}</div>
                    </td>
                    <td style={{ ...styles.td, paddingTop: '1px', paddingBottom: '1px' }}>
                      <div style={styles.dateField}>
                        <input
                          ref={(node) => {
                            dateInputRefs.current[index] = node;
                          }}
                          type="date"
                          style={styles.dateInput}
                          value={currentDate}
                          onChange={(event) => handleServiceDateChange(index, event.target.value)}
                          aria-label={`Visit ${index + 1} final service date`}
                        />
                        <span
                          style={styles.dateIcon}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open calendar for visit ${index + 1}`}
                          onClick={() => focusDatePicker(index)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              focusDatePicker(index);
                            }
                          }}
                        >
                          <Calendar size={12} />
                        </span>
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
        </div>
      )}
    </section>
  );
}
