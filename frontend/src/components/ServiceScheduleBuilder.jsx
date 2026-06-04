import React, { useMemo } from 'react';
import { Calendar, ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  buildServiceScheduleRows,
  formatServiceScheduleDate,
  formatServiceScheduleDateTime,
  getServiceScheduleRuleLabel,
  normalizeServiceScheduleRows,
  normalizeServiceScheduleTime,
  serviceScheduleFrequencyOptions,
  serviceScheduleRepeatUnitOptions,
  serviceScheduleWeekdayOptions
} from '../utils/serviceScheduleBuilder';

const styles = {
  block: { border: '1px solid var(--color-border)', borderRadius: '12px', background: '#f8fafc', padding: '12px', display: 'grid', gap: '12px' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' },
  titleWrap: { display: 'grid', gap: '4px' },
  title: { margin: 0, fontSize: '13px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' },
  hint: { margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.4 },
  headerMeta: { display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  compactBadge: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '999px', border: '1px solid #dbeafe', background: '#eff6ff', color: '#1d4ed8', fontSize: '11px', fontWeight: 800 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' },
  field: { display: 'grid', gap: '4px', minWidth: 0 },
  label: { fontSize: '11px', color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' },
  input: { border: '1px solid #d1d5db', borderRadius: '8px', minHeight: '36px', padding: '0 10px', fontSize: '13px', color: '#0f172a', background: '#fff', boxSizing: 'border-box', width: '100%' },
  inputError: { borderColor: '#fca5a5', boxShadow: '0 0 0 1px rgba(239,68,68,0.08)' },
  helper: { fontSize: '11px', color: '#64748b', lineHeight: 1.4 },
  error: { fontSize: '11px', color: '#dc2626', fontWeight: 700, lineHeight: 1.4 },
  chipRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  chipRowCompact: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(82px, 1fr))', gap: '6px' },
  chipRowDays: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(48px, 1fr))', gap: '6px' },
  chipGroup: { display: 'grid', gap: '6px' },
  chipGroupLabel: { fontSize: '10px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
  chip: { border: '1px solid #d1d5db', background: '#fff', color: '#475569', borderRadius: '999px', minHeight: '28px', padding: '0 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', textAlign: 'center' },
  chipActive: { borderColor: 'var(--color-primary-soft)', background: 'var(--color-primary)', color: '#fff' },
  sectionCard: { border: '1px solid var(--color-border)', borderRadius: '10px', background: '#fff', padding: '10px', display: 'grid', gap: '10px' },
  summary: { display: 'grid', gap: '6px' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px', color: '#334155' },
  summaryKey: { color: '#64748b', fontWeight: 700 },
  summaryValue: { fontWeight: 800, color: '#0f172a' },
  dateChipRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  dateChip: { display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '999px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontSize: '11px', fontWeight: 800 },
  actionRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  actionBtn: { minHeight: '34px', borderRadius: '8px', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  secondaryBtn: { minHeight: '34px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', color: '#111827', fontSize: '12px', fontWeight: 800, cursor: 'pointer', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  rowsWrap: { display: 'grid', gap: '8px' },
  rowsHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  rowsTitle: { margin: 0, fontSize: '12px', fontWeight: 800, color: '#0f172a' },
  rowsToggle: { border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: '12px', fontWeight: 800, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' },
  rowList: { display: 'grid', gap: '8px' },
  rowItem: { border: '1px solid #e2e8f0', borderRadius: '10px', background: '#fff', padding: '8px 10px', display: 'grid', gap: '8px' },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  rowLabel: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#0f172a' },
  rowMeta: { fontSize: '11px', color: '#64748b', fontWeight: 700 },
  rowGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px auto', gap: '8px', alignItems: 'end' },
  rowInput: { border: '1px solid #d1d5db', borderRadius: '8px', minHeight: '34px', padding: '0 10px', fontSize: '13px', color: '#0f172a', background: '#fff', width: '100%', boxSizing: 'border-box' },
  rowDelete: { border: '1px solid #fecaca', background: '#fff1f2', color: '#be123c', borderRadius: '8px', minHeight: '34px', width: '34px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  emptyState: { border: '1px dashed #cbd5e1', borderRadius: '10px', background: '#fff', padding: '10px 12px', fontSize: '12px', color: '#64748b', lineHeight: 1.45 },
  desktopTwoCol: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  desktopThreeCol: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }
};

const isWeekBasedFrequency = (frequency, repeatUnit) => {
  const normalizedFrequency = String(frequency || '').toLowerCase();
  const normalizedRepeatUnit = String(repeatUnit || '').toLowerCase();
  return normalizedFrequency === 'weekly' || normalizedFrequency === 'fortnightly' || (normalizedFrequency === 'custom' && normalizedRepeatUnit === 'weeks');
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
  const previewDates = previewRows.slice(0, 5).map((row) => formatServiceScheduleDate(row.serviceDate)).filter(Boolean);
  const rowLimit = expanded ? previewRows.length : Math.min(previewRows.length, 5);
  const visibleRows = previewRows.slice(0, rowLimit);
  const hasRows = previewRows.length > 0;
  const isManual = Array.isArray(scheduleRows);
  const showWeekdays = Boolean(String(draft.frequency || '').trim());
  const repeatEvery = Math.max(1, Number(draft.repeatEvery || 1));
  const previewRuleLabel = previewRows[0]?.scheduleRuleLabel || ruleLabel;

  const updateDraft = (patch) => {
    onDraftChange({ ...draft, ...patch });
  };

  const selectedWeekdays = Array.isArray(draft.weekdays) ? draft.weekdays : [];
  const isAnyDaySelected = showWeekdays && selectedWeekdays.length === 0;
  const isExactWeekdaySelection = (values) => {
    const current = [...selectedWeekdays].sort();
    const target = [...values].map((value) => String(value)).sort();
    if (current.length !== target.length) return false;
    return current.every((value, index) => value === target[index]);
  };
  const isWeekdaysSelected = isExactWeekdaySelection(['1', '2', '3', '4', '5']);
  const isWeekendSelected = isExactWeekdaySelection(['0', '6']);

  const toggleWeekday = (weekdayValue) => {
    const current = selectedWeekdays;
    const next = current.includes(String(weekdayValue))
      ? current.filter((value) => value !== String(weekdayValue))
      : [...current, String(weekdayValue)];
    updateDraft({ weekdays: next });
  };

  const selectAnyDay = () => {
    updateDraft({ weekdays: [] });
  };

  const selectWeekdays = () => {
    updateDraft({ weekdays: ['1', '2', '3', '4', '5'] });
  };

  const selectWeekend = () => {
    updateDraft({ weekdays: ['0', '6'] });
  };

  const handleFrequencyChange = (value) => {
    const nextFrequency = String(value || '').trim();
    const shouldKeepWeekdays = isWeekBasedFrequency(nextFrequency, draft.repeatUnit);
    updateDraft({
      frequency: nextFrequency,
      weekdays: shouldKeepWeekdays ? (Array.isArray(draft.weekdays) ? draft.weekdays : []) : []
    });
  };

  const handleRepeatUnitChange = (value) => {
    const nextUnit = String(value || 'weeks').trim();
    updateDraft({
      repeatUnit: nextUnit,
      weekdays: nextUnit === 'weeks' ? (Array.isArray(draft.weekdays) ? draft.weekdays : []) : []
    });
  };

  const updateRow = (index, patch) => {
    const nextRows = previewRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    onRowsChange(normalizeServiceScheduleRows(nextRows, normalizedTime));
  };

  const deleteRow = (index) => {
    const nextRows = previewRows.filter((_, rowIndex) => rowIndex !== index);
    onRowsChange(normalizeServiceScheduleRows(nextRows, normalizedTime));
  };

  return (
    <div style={styles.block}>
      <div style={styles.head}>
        <div style={styles.titleWrap}>
          <h4 style={styles.title}>Service Schedules</h4>
          <p style={styles.hint}>Build a compact visit rule, preview the schedule, then edit the generated visits before saving.</p>
        </div>
        <div style={styles.headerMeta}>
          <span style={styles.compactBadge}>
            <Calendar size={12} />
            {previewRows.length} visits
          </span>
          <span style={styles.compactBadge}>{ruleLabel}</span>
        </div>
      </div>

      <div style={{ ...styles.grid, gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)' }}>
        <div style={styles.field}>
          <label style={styles.label}>Default Time</label>
          <input
            type="time"
            style={styles.input}
            value={normalizedTime}
            onChange={(event) => onTimeChange(normalizeServiceScheduleTime(event.target.value, '10:00'))}
          />
          <span style={styles.helper}>Applies to every generated visit.</span>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Contract Schedule Rule</label>
          <input style={styles.input} value={ruleLabel} readOnly />
          <span style={styles.helper}>Use the controls below to define the repeat pattern.</span>
        </div>
      </div>

      <div style={{ ...styles.grid, ...styles.desktopTwoCol }}>
        <div style={styles.field}>
          <label style={styles.label}>Start Date</label>
          <input
            type="date"
            style={{ ...styles.input, ...(errors.startDate ? styles.inputError : null) }}
            value={draft.startDate || ''}
            onChange={(event) => updateDraft({ startDate: event.target.value })}
          />
          {errors.startDate ? <span style={styles.error}>{errors.startDate}</span> : <span style={styles.helper}>First visit starts from this date.</span>}
        </div>
        <div style={styles.field}>
          <label style={styles.label}>End Date</label>
          <input
            type="date"
            style={{ ...styles.input, ...(errors.endDate ? styles.inputError : null) }}
            value={draft.endDate || ''}
            onChange={(event) => updateDraft({ endDate: event.target.value })}
          />
          {errors.endDate ? <span style={styles.error}>{errors.endDate}</span> : <span style={styles.helper}>Visits are generated inclusively up to this date.</span>}
        </div>
      </div>

      <div style={{ ...styles.grid, ...styles.desktopTwoCol }}>
        <div style={styles.field}>
          <label style={styles.label}>Visit Frequency</label>
          <select
            style={{ ...styles.input, ...(errors.frequency ? styles.inputError : null) }}
            value={draft.frequency || ''}
            onChange={(event) => handleFrequencyChange(event.target.value)}
          >
            <option value="">Select frequency</option>
            {serviceScheduleFrequencyOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {errors.frequency ? <span style={styles.error}>{errors.frequency}</span> : <span style={styles.helper}>Choose a repeat cadence for the contract.</span>}
        </div>

        {draft.frequency === 'custom' ? (
          <div style={styles.field}>
            <label style={styles.label}>Custom Repeat</label>
            <div style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr) minmax(120px, 140px)', gap: '8px' }}>
              <div style={styles.field}>
                <input
                  type="number"
                  min="1"
                  step="1"
                  style={{ ...styles.input, width: '100%', ...(errors.repeatEvery ? styles.inputError : null) }}
                  value={repeatEvery}
                  onChange={(event) => updateDraft({ repeatEvery: Math.max(1, Number(event.target.value || 1)) })}
                />
                {errors.repeatEvery ? <span style={styles.error}>{errors.repeatEvery}</span> : null}
              </div>
              <select
                style={styles.input}
                value={draft.repeatUnit || 'weeks'}
                onChange={(event) => handleRepeatUnitChange(event.target.value)}
              >
                {serviceScheduleRepeatUnitOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input style={styles.input} value={`Every ${repeatEvery} ${draft.repeatUnit || 'weeks'}`} readOnly />
            </div>
          <span style={styles.helper}>Use the day chips to pick Any day, Weekdays, Weekend, or specific days for the schedule.</span>
          </div>
        ) : (
          <div style={styles.field}>
            <label style={styles.label}>Repeat Preview</label>
            <input style={styles.input} value={ruleLabel} readOnly />
            <span style={styles.helper}>Preview updates as you change the rule.</span>
          </div>
        )}
      </div>

      {showWeekdays ? (
        <div style={styles.field}>
          <label style={styles.label}>Service Day</label>
          <span style={styles.helper}>Select Days</span>
          <div style={styles.chipGroup}>
            <span style={styles.chipGroupLabel}>Quick Pick</span>
            <div style={styles.chipRowCompact}>
              <button
                type="button"
                style={{ ...styles.chip, ...(isAnyDaySelected ? styles.chipActive : null) }}
                onClick={selectAnyDay}
              >
                Any day
              </button>
              <button
                type="button"
                style={{ ...styles.chip, ...(isWeekdaysSelected ? styles.chipActive : null) }}
                onClick={selectWeekdays}
              >
                Weekdays
              </button>
              <button
                type="button"
                style={{ ...styles.chip, ...(isWeekendSelected ? styles.chipActive : null) }}
                onClick={selectWeekend}
              >
                Weekend
              </button>
            </div>
          </div>
          <div style={styles.chipGroup}>
            <span style={styles.chipGroupLabel}>Specific Days</span>
            <div style={styles.chipRowDays}>
              {serviceScheduleWeekdayOptions.map((weekday) => {
                const active = Array.isArray(draft.weekdays) && draft.weekdays.includes(weekday.value);
                return (
                  <button
                    key={weekday.value}
                    type="button"
                    style={{ ...styles.chip, ...(active ? styles.chipActive : null) }}
                    onClick={() => toggleWeekday(weekday.value)}
                  >
                    {weekday.short}
                  </button>
                );
              })}
            </div>
          </div>
          {errors.weekdays ? <span style={styles.error}>{errors.weekdays}</span> : <span style={styles.helper}>Pick Any day, Weekdays, Weekend, or specific days. The chosen day set is saved with the rule.</span>}
        </div>
      ) : null}

      <div style={styles.sectionCard}>
        <div style={styles.summary}>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>Auto-generated visits</span>
            <span style={styles.summaryValue}>{previewRows.length}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>First visit</span>
            <span style={styles.summaryValue}>{previewRows[0] ? formatServiceScheduleDateTime(previewRows[0].serviceDate, previewRows[0].serviceTime) : '—'}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>Last visit</span>
            <span style={styles.summaryValue}>{previewRows[previewRows.length - 1] ? formatServiceScheduleDateTime(previewRows[previewRows.length - 1].serviceDate, previewRows[previewRows.length - 1].serviceTime) : '—'}</span>
          </div>
          <div style={styles.summaryRow}>
            <span style={styles.summaryKey}>Rule</span>
            <span style={styles.summaryValue}>{previewRuleLabel}</span>
          </div>
          {showWeekdays ? (
            <div style={styles.summaryRow}>
              <span style={styles.summaryKey}>Selected days</span>
              <span style={styles.summaryValue}>
                {selectedWeekdays.length === 0
                  ? 'Any day'
                  : isWeekdaysSelected
                    ? 'Weekdays'
                    : isWeekendSelected
                      ? 'Weekend'
                      : selectedWeekdays.map((value) => serviceScheduleWeekdayOptions.find((day) => day.value === value)?.short).filter(Boolean).join(', ')}
              </span>
            </div>
          ) : null}
        </div>

        <div>
          <div style={{ ...styles.summaryRow, marginBottom: '8px' }}>
            <span style={styles.summaryKey}>First 5 visits</span>
            <span style={styles.summaryValue}>{hasRows ? `${Math.min(previewRows.length, 5)} shown` : 'No visits yet'}</span>
          </div>
          <div style={styles.dateChipRow}>
            {previewDates.length > 0 ? (
              previewDates.map((date, index) => (
                <span key={`${date}-${index}`} style={styles.dateChip}>{date}</span>
              ))
            ) : (
              <span style={styles.helper}>Generate the schedule to preview the first few visit dates.</span>
            )}
          </div>
        </div>

        <div style={styles.actionRow}>
          <button type="button" style={styles.actionBtn} onClick={onGenerate}>
            {isManual ? <RefreshCw size={14} /> : <Plus size={14} />}
            {isManual ? 'Regenerate Schedule' : 'Generate Schedule'}
          </button>
          {isManual ? (
            <button type="button" style={styles.secondaryBtn} onClick={onReset}>
              Reset to Rule
            </button>
          ) : null}
        </div>
      </div>

      {isManual ? (
        <div style={styles.rowsWrap}>
          <div style={styles.rowsHead}>
            <h5 style={styles.rowsTitle}>Manual Override</h5>
            <button type="button" style={styles.rowsToggle} onClick={() => onExpandedChange(!expanded)}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? 'Collapse' : 'Expand'} ({previewRows.length})
            </button>
          </div>

          {previewRows.length === 0 ? (
            <div style={styles.emptyState}>
              No visits are available right now. Regenerate the schedule to continue.
            </div>
          ) : (
            <div style={styles.rowList}>
              {visibleRows.map((row, index) => (
                <div key={`${row.serviceDate}-${row.serviceTime}-${index}`} style={styles.rowItem}>
                  <div style={styles.rowTop}>
                    <span style={styles.rowLabel}>
                      <Pencil size={12} />
                      Visit {row.serviceNumber}
                    </span>
                    <span style={styles.rowMeta}>{row.itemName || 'Service Visit'}</span>
                  </div>
                  <div style={styles.rowGrid}>
                    <label style={styles.field}>
                      <span style={styles.label}>Date</span>
                      <input
                        type="date"
                        style={styles.rowInput}
                        value={row.serviceDate || ''}
                        onChange={(event) => updateRow(index, { serviceDate: event.target.value })}
                      />
                    </label>
                    <label style={styles.field}>
                      <span style={styles.label}>Time</span>
                      <input
                        type="time"
                        style={styles.rowInput}
                        value={normalizeServiceScheduleTime(row.serviceTime, normalizedTime)}
                        onChange={(event) => updateRow(index, { serviceTime: normalizeServiceScheduleTime(event.target.value, normalizedTime) })}
                      />
                    </label>
                    <button type="button" style={styles.rowDelete} onClick={() => deleteRow(index)} title="Delete visit">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <span style={styles.rowMeta}>{formatServiceScheduleDateTime(row.serviceDate, row.serviceTime)}</span>
                </div>
              ))}
              {!expanded && previewRows.length > 5 ? (
                <button type="button" style={styles.rowsToggle} onClick={() => onExpandedChange(true)}>
                  Show {previewRows.length - 5} more
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.emptyState}>
          Fill the rule and click <strong>Generate Schedule</strong> to create a manual visit list. The contract will still save with the existing auto-generated behaviour until you generate and edit the schedule.
        </div>
      )}
    </div>
  );
}
