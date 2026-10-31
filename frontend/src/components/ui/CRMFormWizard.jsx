import { Children, cloneElement, createContext, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { CRMModal, CRMModalHeader, CRMModalBody, CRMModalFooter, CRMFormActions } from './CRMForm';
import '../../styles/crmFormWizard.css';

export function CRMFormStep({ children }) { return children; }
// Portalled/custom controls can mark a user edit before updating caller-owned values.
export const CRMFormInteractionContext = createContext(() => {});

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
  error, notice, cancelAction, submitAction, className = '', trackSubmission = false, dirtyKey, inlineErrors = false, associateLabels = false, fieldsetContent = false, readOnly = false, ...props }) {
  const steps = Children.toArray(children);
  const id = useId();
  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0);
  const [stepError, setStepError] = useState('');
  const [pending, setPending] = useState(false);
  const locked = busy || pending;
  const initialDirtyKey = useRef(dirtyKey), touched = useRef(false), labelSequence = useRef(0);
  useEffect(() => { if (!touched.current) initialDirtyKey.current = dirtyKey; }, [dirtyKey]);
  const requestClose = (event, action = onClose) => {
    if (locked || submitting.current) return;
    if (dirtyKey !== undefined && touched.current && dirtyKey !== initialDirtyKey.current && !window.confirm('Discard unsaved changes?')) return;
    action?.(event);
  };
  const markInput = () => { touched.current = true; };
  const markAction = (event) => { if (event.target.closest('.crm-wizard-panel button')) touched.current = true; };

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
  useEffect(() => {
    if (!associateLabels) return;
    for (const control of workspace.current?.querySelectorAll('input,select,textarea') || []) {
      if (control.id || control.closest('label') || control.hasAttribute('aria-label') || control.hasAttribute('aria-labelledby')) continue;
      let node = control, label;
      while (node.parentElement && !node.classList.contains('crm-wizard-panel')) {
        if (node.previousElementSibling?.tagName === 'LABEL') { label = node.previousElementSibling; break; }
        const labels = [...node.parentElement.querySelectorAll('label')].filter(candidate => !candidate.querySelector('input,select,textarea'));
        const inputs = [...node.parentElement.querySelectorAll('input,select,textarea')].filter(candidate => !['checkbox', 'radio'].includes(candidate.type));
        if (labels.length === 1 && inputs.length === 1) { label = labels[0]; break; }
        node = node.parentElement;
      }
      if (label) { control.id = `${id}-control-${labelSequence.current++}`; label.htmlFor = control.id; }
    }
  });
  const validate = (index) => {
    const panel = panels()[index];
    const invalid = [...panel.querySelectorAll('input,select,textarea')].find(node => node.willValidate && !node.validity.valid);
    if (invalid) { setStepError(invalid.validationMessage); focusInvalid(index, invalid); return false; }
    const issue = validateStep?.(index);
    if (issue) {
      setStepError(typeof issue === 'string' ? issue : issue.message);
      const label = [...panel.querySelectorAll('label')].find(node => node.textContent.trim().replace(/\s*\*$/, '') === issue.field);
      const field = [...panel.querySelectorAll('.skuas-form-field')].find(node => node.querySelector('label')?.textContent.trim() === issue.field);
      const linked = issue.selector ? panel.querySelector(issue.selector) : label?.control || label?.querySelector('input,select,textarea');
      focusInvalid(index, linked || field?.querySelector('input:not([type="checkbox"]),select,textarea') || panel.querySelector('.crm-wizard-panel-heading'));
      return false;
    }
    return true;
  };
  const navigate = (index) => {
    if (locked || submitting.current || index === active || index > reached) return;
    if (index > active && !validate(active)) return;
    setStepError(''); setActive(index);
  };
  const advance = () => {
    if (locked || submitting.current || !validate(active)) return;
    setStepError(''); setReached(previous => Math.max(previous, active + 1)); setActive(active + 1);
  };
  const submit = async (event) => {
    event.preventDefault();
    if (locked || submitting.current) return;
    if (readOnly) return;
    if (active < steps.length - 1) { advance(); return; }
    for (let index = 0; index < steps.length; index += 1) if (!validate(index)) return;
    setStepError(''); submitting.current = true;
    if (trackSubmission) setPending(true);
    try { await onSubmit(event); } finally { submitting.current = false; if (trackSubmission) setPending(false); }
  };
  return <CRMModal {...props} as="form" noValidate className={`crm-form-wizard ${className}`} onSubmit={submit} aria-labelledby={`${id}-title`} aria-busy={locked} onInputCapture={markInput} onChangeCapture={markInput} onClickCapture={markAction}>
    <CRMModalHeader title={title} subtitle={subtitle} icon={icon} titleId={`${id}-title`} onClose={requestClose} closeDisabled={locked} />
    <CRMFormInteractionContext.Provider value={markInput}><div className="crm-wizard-workspace" ref={workspace}>
      <CRMFormStepper steps={steps.map(step => step.props)} activeStep={active} reachedStep={reached} disabled={locked} onNavigate={navigate} id={id} />
      <CRMModalBody className="crm-wizard-body">{steps.map((step, index) => {
        const Icon = step.props.icon;
        return <section key={step.key || index} className="crm-wizard-panel" id={`${id}-panel-${index}`} hidden={index !== active} aria-labelledby={`${id}-heading-${index}`}>
          <div className="crm-wizard-panel-intro">{Icon ? <span className="crm-wizard-section-icon"><Icon size={23} aria-hidden="true" /></span> : null}
            <div><h3 className="crm-wizard-panel-heading" id={`${id}-heading-${index}`} tabIndex={-1}>{step.props.title}</h3><p>{step.props.description}</p></div>
          </div>{inlineErrors && index === active && stepError ? <div className="crm-wizard-inline-error" role="alert">{stepError}</div> : null}{fieldsetContent ? <fieldset className="crm-wizard-content-fieldset" disabled={readOnly}>{step.props.children}</fieldset> : step.props.children}
        </section>;
      })}</CRMModalBody>
    </div></CRMFormInteractionContext.Provider>
    <CRMModalFooter>
      {(!inlineErrors && stepError) || error ? <div className="crm-wizard-error" role="alert">{(!inlineErrors && stepError) || error}</div> : notice ? <div className="crm-wizard-notice" role="status">{notice}</div> : null}
      <CRMFormActions>
        {cancelAction ? cloneElement(cancelAction, { disabled: locked || cancelAction.props.disabled, onClick: event => requestClose(event, cancelAction.props.onClick || onClose) }) : <button type="button" disabled={locked} onClick={requestClose}>Cancel</button>}
        {active > 0 ? <button type="button" disabled={locked} onClick={() => navigate(active - 1)}><ArrowLeft size={16} aria-hidden="true" />Back</button> : null}
        {/* Distinct nodes prevent a clicked Next button becoming a submit button during the same browser event. */}
        {active < steps.length - 1 ? <button key="next" type="button" data-modal-primary="true" disabled={locked} onClick={advance}>Next<ArrowRight size={16} aria-hidden="true" /></button> : submitAction ? cloneElement(submitAction, { key: 'submit', disabled: locked || submitAction.props.disabled, children: trackSubmission && pending && !busy ? 'Saving...' : submitAction.props.children }) : null}
      </CRMFormActions>
    </CRMModalFooter>
  </CRMModal>;
}
