import { Children, cloneElement, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { CRMModal, CRMModalHeader, CRMModalBody, CRMModalFooter, CRMFormActions } from './CRMForm';
import '../../styles/crmFormWizard.css';

export function CRMFormStep({ children }) { return children; }

export function CRMFormStepper({ steps, activeStep, reachedStep, disabled, onNavigate, id }) {
  return <nav className="crm-wizard-nav" aria-label="Form steps"><ol>
    {steps.map((step, index) => <li key={step.key || index}>
      <button type="button" disabled={disabled || index > reachedStep} aria-current={index === activeStep ? 'step' : undefined}
        aria-controls={`${id}-panel-${index}`} className={index === activeStep ? 'is-active' : ''} onClick={() => onNavigate(index)}>
        <span className="crm-wizard-number" aria-hidden="true">{index < activeStep ? <Check size={15} /> : index + 1}</span>
        <span><strong>{step.title}</strong><small>{step.description}</small></span>
      </button>
    </li>)}
  </ol></nav>;
}

export function CRMFormReview({ groups }) {
  return <div className="crm-wizard-review">{groups.map(({ title, fields }) => <section key={title}>
    <h4>{title}</h4><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value ?? '').trim() || '—'}</dd></div>)}</dl>
  </section>)}</div>;
}

// Panels stay mounted: caller-owned values, refs, autocomplete and embedded drafts survive navigation.
// Validation is read-only; only the final submit invokes the original save callback.
export function CRMFormModal({ children, title, subtitle, icon, onClose, onSubmit, validateStep, busy = false,
  error, cancelAction, submitAction, className = '', ...props }) {
  const steps = Children.toArray(children);
  const id = useId();
  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0);
  const [stepError, setStepError] = useState('');
  const workspace = useRef(null), pendingFocus = useRef(null), mounted = useRef(false), submitting = useRef(false);
  const panels = () => [...workspace.current.querySelectorAll(':scope > .crm-wizard-body > .crm-wizard-panel')];
  const focusInvalid = (index, node) => {
    if (index === active) { node?.focus(); node?.reportValidity?.(); }
    else { pendingFocus.current = node; setActive(index); }
  };
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const panel = panels()[active];
    const node = pendingFocus.current;
    pendingFocus.current = null;
    if (node) { node.focus(); node.reportValidity?.(); }
    else { workspace.current?.querySelector('.crm-wizard-body')?.scrollTo(0, 0); panel?.querySelector('.crm-wizard-panel-heading')?.focus(); }
  }, [active]);
  const validate = (index) => {
    const panel = panels()[index];
    const invalid = [...panel.querySelectorAll('input,select,textarea')].find(node => node.willValidate && !node.validity.valid);
    if (invalid) { setStepError(invalid.validationMessage); focusInvalid(index, invalid); return false; }
    const issue = validateStep?.(index);
    if (issue) {
      setStepError(typeof issue === 'string' ? issue : issue.message);
      const field = [...panel.querySelectorAll('.skuas-form-field')].find(node => node.querySelector('label')?.textContent.trim() === issue.field);
      focusInvalid(index, field?.querySelector('input:not([type="checkbox"]),select,textarea') || panel.querySelector('.crm-wizard-panel-heading'));
      return false;
    }
    return true;
  };
  const navigate = (index) => {
    if (busy || submitting.current || index === active || index > reached) return;
    if (index > active && !validate(active)) return;
    setStepError(''); setActive(index);
  };
  const advance = () => {
    if (busy || submitting.current || !validate(active)) return;
    setStepError(''); setReached(previous => Math.max(previous, active + 1)); setActive(active + 1);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || submitting.current) return;
    if (active < steps.length - 1) { advance(); return; }
    for (let index = 0; index < steps.length; index += 1) if (!validate(index)) return;
    setStepError(''); submitting.current = true;
    try { await onSubmit(event); } finally { submitting.current = false; }
  };
  return <CRMModal {...props} as="form" noValidate className={`crm-form-wizard ${className}`} onSubmit={submit} aria-labelledby={`${id}-title`} aria-busy={busy}>
    <CRMModalHeader title={title} subtitle={subtitle} icon={icon} titleId={`${id}-title`} onClose={onClose} closeDisabled={busy} />
    <div className="crm-wizard-workspace" ref={workspace}>
      <CRMFormStepper steps={steps.map(step => step.props)} activeStep={active} reachedStep={reached} disabled={busy} onNavigate={navigate} id={id} />
      <CRMModalBody className="crm-wizard-body">{steps.map((step, index) => {
        const Icon = step.props.icon;
        return <section key={step.key || index} className="crm-wizard-panel" id={`${id}-panel-${index}`} hidden={index !== active} aria-labelledby={`${id}-heading-${index}`}>
          <div className="crm-wizard-panel-intro">{Icon ? <span className="crm-wizard-section-icon"><Icon size={23} aria-hidden="true" /></span> : null}
            <div><h3 className="crm-wizard-panel-heading" id={`${id}-heading-${index}`} tabIndex={-1}>{step.props.title}</h3><p>{step.props.description}</p></div>
          </div>{step.props.children}
        </section>;
      })}</CRMModalBody>
    </div>
    <CRMModalFooter>
      {stepError || error ? <div className="crm-wizard-error" role="alert">{stepError || error}</div> : null}
      <CRMFormActions>
        {cancelAction ? cloneElement(cancelAction, { disabled: busy || cancelAction.props.disabled }) : <button type="button" disabled={busy} onClick={onClose}>Cancel</button>}
        {active > 0 ? <button type="button" disabled={busy} onClick={() => navigate(active - 1)}><ArrowLeft size={16} aria-hidden="true" />Back</button> : null}
        {/* Distinct nodes prevent a clicked Next button becoming a submit button during the same browser event. */}
        {active < steps.length - 1 ? <button key="next" type="button" data-modal-primary="true" disabled={busy} onClick={advance}>Next<ArrowRight size={16} aria-hidden="true" /></button> : submitAction ? cloneElement(submitAction, { key: 'submit' }) : null}
      </CRMFormActions>
    </CRMModalFooter>
  </CRMModal>;
}
