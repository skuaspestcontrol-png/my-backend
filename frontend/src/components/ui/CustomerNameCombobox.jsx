import { useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { CRMFormInteractionContext } from './CRMFormWizard';
import '../../styles/customerNameCombobox.css';

// Selection keeps the editor's existing name-based resolver; unmatched text remains a new customer name.
export default function CustomerNameCombobox({ value, options, onChange, style, placeholder, 'aria-label': label = 'Customer Name' }) {
  const id = useId(), input = useRef(null), popup = useRef(null);
  const markInteraction = useContext(CRMFormInteractionContext);
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1), [position, setPosition] = useState(null);
  const matches = options.filter(option => option.name.toLocaleLowerCase().includes(String(value || '').trim().toLocaleLowerCase()));
  useEffect(() => {
    const label = input.current?.closest('.skuas-form-field')?.querySelector('label');
    if (label) label.htmlFor = input.current.id;
  }, []);
  useEffect(() => { setActive(-1); }, [value]);
  useEffect(() => { if (input.current?.matches(':disabled')) setOpen(false); });
  useEffect(() => {
    if (!open) return;
    const align = () => {
      const rect = input.current.getBoundingClientRect();
      const bounds = input.current.closest('.crm-wizard-body')?.getBoundingClientRect();
      if (bounds && (rect.top < bounds.top || rect.bottom > bounds.bottom)) { setOpen(false); return; }
      const width = Math.min(rect.width, window.innerWidth - 16);
      const below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
      const flip = below < 160 && above > below;
      const height = Math.max(0, Math.min(240, flip ? above : below));
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width, maxHeight: height,
        ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) });
    };
    const outside = event => { if (!input.current?.parentElement.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false); };
    align();
    window.addEventListener('resize', align);
    window.addEventListener('scroll', align, true);
    document.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('resize', align); window.removeEventListener('scroll', align, true); document.removeEventListener('pointerdown', outside); };
  }, [open]);
  useEffect(() => { if (active >= 0) popup.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);
  const choose = option => { markInteraction(); onChange(option.name); setOpen(false); setActive(-1); };
  const keyDown = event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); setOpen(true);
      setActive(previous => matches.length ? event.key === 'ArrowDown' ? Math.min(previous + 1, matches.length - 1) : Math.max(previous - 1, 0) : -1);
    } else if (event.key === 'Enter' && open && active >= 0 && matches[active]) {
      event.preventDefault(); event.stopPropagation(); choose(matches[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    } else if (event.key === 'Tab') setOpen(false);
  };
  return <div className="crm-customer-combobox">
    <input ref={input} id={`${id}-input`} role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={open}
      aria-controls={open ? id : undefined} aria-activedescendant={open && active >= 0 && matches[active] ? `${id}-${active}` : undefined}
      value={value} style={style} placeholder={placeholder} autoComplete="off"
      onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
      onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={keyDown} />
    <ChevronDown size={16} aria-hidden="true" className="crm-customer-combobox-chevron" />
    {open && position ? createPortal(<div ref={popup} id={id} role="listbox" aria-label="Customer suggestions"
      className="crm-customer-suggestions" style={position}>
      {matches.length ? matches.map((option, index) => <div role="option" id={`${id}-${index}`} key={option.id || `${option.name}-${index}`}
        aria-selected={active === index} data-option-index={index} className="crm-customer-suggestion"
        onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>{option.name}</div>)
        : <div className="crm-customer-suggestions-empty" role="status">No matching customers. Continue typing to use a new name.</div>}
    </div>, document.body) : null}
  </div>;
}
