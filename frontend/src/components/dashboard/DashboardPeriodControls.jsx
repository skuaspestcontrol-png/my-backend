import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import './dashboardPeriodControls.css';

const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })
    .format(new Date(Date.UTC(2000, index, 1)))
}));

function PeriodDropdown({ label, value, options, onChange }) {
  const id = useId();
  const trigger = useRef(null), menu = useRef(null), search = useRef({ text: '', time: 0 });
  const selected = options.findIndex(option => option.value === value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(Math.max(0, selected));
  const [position, setPosition] = useState(null);

  const show = (index = selected) => { setActive(Math.max(0, index)); setOpen(true); };
  const choose = (index) => {
    if (options[index] && options[index].value !== value) onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = (event) => {
      if (event && menu.current?.contains(event.target)) return;
      const rect = trigger.current.getBoundingClientRect();
      const top = rect.bottom + 8;
      const maxHeight = Math.min(256, window.innerHeight - top - 12);
      if (rect.bottom < 0 || rect.top >= window.innerHeight || maxHeight < 40) {
        setOpen(false);
        return;
      }
      const width = Math.min(Math.max(156, rect.width), window.innerWidth - 24);
      setPosition({ top, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width, maxHeight });
    };
    const outside = event => {
      if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !menu.current) return;
    const option = menu.current.querySelector(`[data-index="${active}"]`);
    if (!option) return;
    if (option.offsetTop < menu.current.scrollTop) menu.current.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > menu.current.scrollTop + menu.current.clientHeight) {
      menu.current.scrollTop = option.offsetTop + option.offsetHeight - menu.current.clientHeight;
    }
  }, [active, open, position]);

  useEffect(() => { if (!open) search.current = { text: '', time: 0 }; }, [open]);

  const keyDown = event => {
    if (event.key === 'Tab') { if (open) choose(active); return; }
    if (event.key === 'Escape') { if (open) { event.preventDefault(); setOpen(false); } return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) show();
      else setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      show(event.key === 'Home' ? 0 : options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(active); else show();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const text = (now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase();
      search.current = { text, time: now };
      const match = options.findIndex(option => option.label.toLowerCase().startsWith(text));
      if (match >= 0) { event.preventDefault(); show(match); }
    }
  };

  return <>
    <button ref={trigger} type="button" role="combobox" className="dashboard-period-trigger"
      aria-label={label} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? `${id}-options` : undefined}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={keyDown}
      onBlur={event => { if (!menu.current?.contains(event.relatedTarget)) setOpen(false); }}>
      <span>{options[selected]?.label ?? String(value)}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && position ? createPortal(
      <div ref={menu} id={`${id}-options`} role="listbox" aria-label={`${label} options`}
        className="dashboard-period-menu" style={position}>
        {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`}
          role="option" aria-selected={index === selected} data-index={index}
          data-active={index === active ? 'true' : undefined}
          className="dashboard-period-option" onPointerMove={event => { if (event.pointerType !== 'touch') setActive(index); }}
          onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}>
          <span>{option.label}</span>{index === selected ? <Check size={16} aria-hidden="true" /> : null}
        </div>)}
      </div>, document.body
    ) : null}
  </>;
}

export default function DashboardPeriodControls({ month, year, years, onMonthChange, onYearChange }) {
  return <div className="dashboard-monthly-controls dashboard-period-controls" role="group" aria-label="Monthly target period">
    <CalendarDays size={17} aria-hidden="true" />
    <PeriodDropdown label="Select monthly target month" value={month} options={months} onChange={onMonthChange} />
    <span className="dashboard-period-divider" aria-hidden="true" />
    <PeriodDropdown label="Select monthly target year" value={year} options={years.map(value => ({ value, label: String(value) }))} onChange={onYearChange} />
  </div>;
}
