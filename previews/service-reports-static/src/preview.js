(() => {
  'use strict';
  const M = globalThis.SKUAS_PREVIEW_MODEL, sections = globalThis.SKUAS_PREVIEW_SCHEMA.sections, esc = M.escape;
  const content = document.getElementById('content');
  let reports = M.initialReports(), view = 'list', selected = null, step = 0, query = '', status = 'All', acknowledged = false, noticeTimer;
  const badge = value => `<span class="status status-${value.toLowerCase()}"><i></i>${esc(value)} <small>sample</small></span>`;
  const button = (label, action, kind = '', extra = '') => `<button type="button" class="button ${kind}" data-action="${action}" ${extra}>${label}</button>`;
  function notice(text) { const box = document.getElementById('notice'); box.textContent = text; box.hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { box.hidden = true; }, 7000); }
  function field(definition, value, prefix = '') {
    const [key, label, type = 'text', options = ''] = definition, id = `${prefix}-${key}`;
    return `<div class="field ${type === 'textarea' ? 'wide' : ''}"><label for="${esc(id)}">${esc(label)}</label>${type === 'textarea' ? `<textarea id="${esc(id)}" readonly rows="3">${esc(value ?? '')}</textarea>` : type === 'select' ? `<select id="${esc(id)}" disabled>${options.split('|').map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input id="${esc(id)}" type="${['date','time','email','number'].includes(type) ? type : 'text'}" value="${esc(value ?? '')}" readonly>`}</div>`;
  }
  function evidence(section, report, compact = false) {
    const records = report.content[section.key] || [];
    return `<div class="evidence-grid">${records.map((r, i) => `<article class="evidence-card">${r.asset ? `<img src="./assets/${esc(r.asset)}" alt="${esc(r.caption)}">` : '<div class="document-symbol" aria-hidden="true">▤</div>'}<div><strong>${esc(r.title)}</strong><p>${esc(r.caption)}</p><span class="micro">SYNTHETIC SAMPLE ${i + 1}</span></div></article>`).join('')}</div>${compact ? '' : `<div class="sample-actions">${button('Add sample ' + (section.key === 'attachments' ? 'document' : 'illustration'), 'evidence', 'subtle', `data-key="${section.key}"`)}${records.length > 1 ? button('Remove last sample', 'remove-evidence', 'subtle', `data-key="${section.key}"`) : ''}<p>No camera, gallery, file selection or real uploads are enabled.</p></div>`}`;
  }
  function sectionBody(section, report, compact = false) {
    if (section.fileKind) return evidence(section, report, compact);
    const data = report.content[section.key];
    if (section.repeatable) return `${data.map((row, index) => `<article class="repeat-block"><div class="block-heading"><strong>${esc(section.title)} · ${index + 1}</strong><span class="micro">SAMPLE RECORD</span></div><div class="field-grid">${section.fields.map(f => field(f, row[f[0]], `${section.key}-${index}`)).join('')}</div>${section.productFields ? `<h3>Products & chemicals</h3>${row.products.map((product, i) => `<div class="product-grid">${section.productFields.map(f => field(f, product[f[0]], `product-${index}-${i}`)).join('')}</div>`).join('')}` : ''}</article>`).join('')}${section.safetyFields ? `<div class="repeat-block"><h3>Safety & precautions</h3><div class="field-grid">${section.safetyFields.map(f => field(f, report.content.safety[f[0]], 'safety')).join('')}</div></div>` : ''}${compact ? '' : button('Add sample record', 'repeat', 'subtle', `data-key="${section.key}"`)}`;
    return `<div class="field-grid">${section.fields.filter(f => !(compact && f[0] === 'internalNotes')).map(f => field(f, data[f[0]], section.key)).join('')}</div>${section.key === 'acknowledgement' ? `<div class="signature-grid">${['Technician','Customer'].map(name => `<article class="signature-card"><strong>${name} sample signature</strong><img src="./assets/signature.svg" alt="Synthetic signature, not a real person's signature"><span class="micro">No signature is captured or recorded.</span></article>`).join('')}</div>` : ''}`;
  }
  function list() {
    const filtered = M.filter(reports, query, status);
    return `<div class="page-heading"><div><p class="eyebrow">SERVICE QUALITY WORKSPACE</p><h1>Service Reports</h1><p>Review the flow from first finding to final sign-off.</p></div>${button('<span aria-hidden="true">＋</span> New demo report', 'new', 'primary')}</div>
      <div class="stat-grid">${[['All reports',reports.length,'◫'],['Drafts',reports.filter(r => r.status === 'Draft').length,'▤'],['Submitted',reports.filter(r => r.status === 'Submitted').length,'↗'],['Approved',reports.filter(r => r.status === 'Approved').length,'✓']].map(([label,count,icon]) => `<article class="stat"><span class="stat-icon" aria-hidden="true">${icon}</span><div><strong>${count}</strong><span>${label}</span></div><small>Synthetic samples</small></article>`).join('')}</div>
      <section class="panel"><div class="panel-toolbar"><div><h2>Your sample reports</h2><p>Explore reports without connecting to live services.</p></div><div class="filters"><label class="search"><span class="sr-only">Search sample reports</span><input id="search" type="search" placeholder="Search report, customer or site" value="${esc(query)}"></label><label><span class="sr-only">Filter sample status</span><select id="status-filter">${['All','Draft','Submitted','Approved'].map(v => `<option ${v === status ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div></div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Synthetic service reports table"><table><thead><tr><th>Report</th><th>Sample customer / site</th><th>Service date</th><th>Sample status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${filtered.map(r => `<tr><td><strong>${esc(r.id)}</strong><span class="table-sub">Synthetic inspection</span></td><td>${esc(r.customer)}<span class="table-sub">${esc(r.site)}</span></td><td>${esc(r.date)}</td><td>${badge(r.status)}</td><td>${button('View report →', 'details', 'text', `data-id="${r.id}"`)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No sample reports match. Try another search or status.</td></tr>'}</tbody></table></div><div class="table-footer">${filtered.length} synthetic reports shown <span>Preview session only</span></div></section>
      <div class="callout"><span class="callout-icon" aria-hidden="true">◇</span><div><strong>Ten sections. One clear service record.</strong><p>Explore findings, treatment details, recommendations, sample evidence and acknowledgement. Every record here is synthetic.</p></div>${button('Explore the wizard', 'new', 'subtle')}</div>`;
  }
  function wizard() {
    const section = sections[step], review = step === sections.length;
    return `<div class="page-heading"><div><p class="eyebrow">${esc(selected.id)} · DEMO DRAFT</p><h1>${review ? 'Review your demo report' : 'Create Service Report'}</h1><p>Fields contain fixed synthetic examples. No real information is collected.</p></div>${button('Save demo draft', 'save', 'subtle')}</div>
      <div class="wizard-layout"><nav class="step-nav" aria-label="Ten report sections">${sections.map((s,i) => `<button type="button" class="step ${step === i ? 'current' : ''}" data-action="step" data-index="${i}" ${step === i ? 'aria-current="step"' : ''}><span>${i + 1}</span><span>${esc(s.title)}</span>${i < step ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}<button type="button" class="step ${review ? 'current' : ''}" data-action="step" data-index="10"><span>✓</span><span>Review</span></button></nav>
      <section class="panel wizard-panel"><div class="wizard-top"><span class="eyebrow">${review ? 'FINAL REVIEW' : `SECTION ${step + 1} OF 10`}</span><span>${review ? 'Ready to explore' : Math.round((step + 1) / 10 * 100) + '% viewed'}</span></div><div class="progress" role="progressbar" aria-valuenow="${Math.min(step + 1,10)}" aria-valuemin="0" aria-valuemax="10" aria-label="Report sections viewed"><div class="progress-${Math.min(step + 1,10)}"></div></div>
      ${review ? `<div class="section-heading"><h2>All ten sections, together</h2><p>This static report is a visual example. Submission and approval are not performed.</p></div><div class="review-index">${sections.map((s,i) => button(`${i + 1}. ${esc(s.title)}`, 'step', 'subtle', `data-index="${i}"`)).join('')}</div><label class="acknowledgement"><input id="demo-ack" type="checkbox" ${acknowledged ? 'checked' : ''}>I understand this is synthetic preview data and no report will be sent.</label><p id="validation" class="validation" role="alert" hidden></p>` : `<div class="section-heading"><h2>${esc(section.title)}</h2><p>Sample values are read-only. Use the navigation and sample actions to explore.</p></div>${sectionBody(section, selected)}`}
      <div class="wizard-footer">${button(step ? '← Previous' : '← Reports', step ? 'previous' : 'list', 'subtle')}<span>${review ? 'Synthetic preview' : `Step ${step + 1} / 10`}</span>${review ? button('Simulate submission', 'submit', 'primary') : button(step === 9 ? 'Review demo report →' : 'Next section →', 'next', 'primary')}</div></section></div>`;
  }
  function details() {
    const report = M.customerReport(selected);
    return `<div class="page-heading"><div><p class="eyebrow">SYNTHETIC REPORT</p><h1>${esc(selected.id)}</h1><p>${esc(selected.customer)} · ${esc(selected.site)}</p></div><div class="heading-actions">${button('← All reports', 'list', 'subtle')}${selected.status === 'Draft' ? button('Resume demo draft', 'resume', 'primary') : ''}</div></div>
    <div class="details-grid"><section class="panel detail-summary"><div><p class="eyebrow">SAMPLE STATUS</p>${badge(selected.status)}</div><dl><div><dt>Service date</dt><dd>${esc(selected.date)}</dd></div><div><dt>Company identity</dt><dd>${esc(selected.content.header.companyType)} · synthetic sample</dd></div><div><dt>Evidence</dt><dd>Illustrations only</dd></div><div><dt>Sign-off</dt><dd>Synthetic signatures</dd></div></dl><div class="history"><h3>Sample history</h3><p><span class="timeline-dot"></span>Demo report prepared</p>${selected.status !== 'Draft' ? '<p><span class="timeline-dot"></span>Sample submitted state</p>' : ''}${selected.status === 'Approved' ? '<p><span class="timeline-dot"></span>Sample approved state · read-only</p>' : ''}</div><p class="fine-print">No service, submission or approval took place. This view does not generate or download a PDF.</p></section><div class="report-document"><div class="document-heading"><p class="eyebrow">STATIC CUSTOMER REPORT EXAMPLE</p><h2>Service Report</h2><p>SYNTHETIC · ${esc(selected.id)}</p></div>${sections.map((s,i) => `<section class="report-section"><h3><span>${String(i + 1).padStart(2,'0')}</span>${esc(s.title)}</h3>${sectionBody(s,report,true)}</section>`).join('')}<div class="document-end">End of synthetic report · No real customer information</div></div></div>`;
  }
  function render() { const focus = document.activeElement?.id === 'search', position = focus ? document.activeElement.selectionStart : null; content.innerHTML = view === 'list' ? list() : view === 'wizard' ? wizard() : details(); if (focus) { const input = document.getElementById('search'); input.focus(); if (typeof position === 'number') { try { input.setSelectionRange(position,position); } catch {} } } }
  function openWizard(report) { selected = report; view = 'wizard'; step = 0; acknowledged = false; render(); window.scrollTo(0,0); }
  content.addEventListener('click', event => {
    const target = event.target.closest('button[data-action]'); if (!target) return;
    const action = target.dataset.action;
    if (action === 'new') { const report = M.newReport(reports); reports.push(report); openWizard(report); return; }
    if (action === 'list') { view = 'list'; render(); window.scrollTo(0,0); return; }
    if (action === 'details') { selected = reports.find(r => r.id === target.dataset.id); view = 'details'; }
    if (action === 'resume') { openWizard(selected); return; }
    if (action === 'step') step = Number(target.dataset.index);
    if (action === 'next') step = Math.min(step + 1,10);
    if (action === 'previous') step = Math.max(0,step - 1);
    if (action === 'save') { notice('Demo draft kept in this page session only. Nothing was sent or stored on a server.'); return; }
    if (action === 'repeat') { const rows = selected.content[target.dataset.key]; rows.push(M.copy(rows[0])); notice('Another synthetic sample added.'); }
    if (action === 'evidence') { const rows = selected.content[target.dataset.key]; rows.push(M.copy(rows[0])); notice('Synthetic sample added. No file was selected or uploaded.'); }
    if (action === 'remove-evidence') selected.content[target.dataset.key].pop();
    if (action === 'submit') {
      try { selected = M.simulateSubmit(selected, acknowledged); reports = reports.map(r => r.id === selected.id ? selected : r); view = 'details'; notice('Simulation only: no report was submitted to any service.'); }
      catch (error) { const validation = document.getElementById('validation'); validation.textContent = error.message; validation.hidden = false; return; }
    }
    render(); if (['next','previous','step','details','submit'].includes(action)) window.scrollTo(0,0);
  });
  content.addEventListener('input', event => { if (event.target.id === 'search') { query = event.target.value; render(); } });
  content.addEventListener('change', event => { if (event.target.id === 'status-filter') { status = event.target.value; render(); } if (event.target.id === 'demo-ack') acknowledged = event.target.checked; });
  document.getElementById('theme-toggle').addEventListener('click', event => { const dark = document.documentElement.dataset.theme !== 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light'; event.currentTarget.textContent = dark ? 'Light theme' : 'Dark theme'; });
  document.getElementById('reset').addEventListener('click', () => { reports = M.initialReports(); view = 'list'; query = ''; status = 'All'; selected = null; acknowledged = false; render(); notice('Synthetic samples reset. Nothing was saved outside this page.'); });
  render();
})();
