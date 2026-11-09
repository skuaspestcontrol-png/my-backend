/* Synthetic fixtures and memory-only navigation. No browser storage or transport. */
(() => {
  const copy = value => JSON.parse(JSON.stringify(value));
  const content = {
    header: { reportDate: '2026-11-09', serviceDate: '2026-11-09', startTime: '09:00', endTime: '10:00', customerName: 'Synthetic Aster Facilities', siteName: 'Demo Warehouse A', siteAddress: '100 Synthetic QA Street, Demo City', contactPerson: 'Synthetic Site Contact', mobile: '', email: 'demo@example.invalid', serviceType: 'Synthetic inspection', companyType: 'GST' },
    summary: { visitPurpose: 'Routine synthetic inspection', serviceStatus: 'Completed', overallActivity: 'Low', mainFindings: 'Sample low-level activity near a demonstration entry point.', workCompleted: 'Demonstration inspection and monitoring completed.', outstandingIssues: 'Sample entry-point sealing action.', customerObservations: 'Synthetic observation for visual review.', remarks: 'All content is demonstration data.' },
    findings: [{ pestType: 'Ants — synthetic finding', species: 'Not identified', activityLevel: 'Low', area: 'Demo loading entrance', evidence: 'Illustrative monitoring observation only.', estimatedCount: '3', description: 'Sample activity; no real site inspected.', comparison: 'Demonstration baseline', remarks: 'Synthetic entry', photoIds: 'Sample illustration 1' }],
    treatments: [{ serviceType: 'Synthetic inspection', area: 'Demo entrance', method: 'Visual inspection', workPerformed: 'Demonstration inspection of sample monitoring points.', equipment: 'Synthetic inspection checklist', monitoringDevices: 'Demo point M01', startTime: '09:15', endTime: '09:40', remarks: 'No real product applied.', products: [{ name: 'Synthetic demonstration product', registration: 'DEMO ONLY', dilution: 'Not applied', quantity: '0', unit: 'Demo units' }] }],
    safety: { ppe: 'Sample gloves and protective clothing', precautions: 'Demonstration precautions only.', reentry: 'No real treatment performed.', foodWater: 'No real food or water involved.', labelReference: 'Synthetic label reference', incidents: 'None in this synthetic scenario.' },
    recommendations: [{ category: 'Entry Point Sealing', area: 'Demo loading entrance', observation: 'Illustrative gap at the sample doorway.', action: 'Seal the sample gap and inspect the demonstration monitor.', priority: 'Normal', responsibleParty: 'Synthetic facilities team', targetDate: '2026-11-16', completionStatus: 'Proposed' }],
    photos: [{ title: 'Before treatment', caption: 'Synthetic illustration — no real site or pest evidence.', asset: 'sample-site.svg' }, { title: 'After treatment', caption: 'Synthetic illustration — no real treatment performed.', asset: 'sample-site.svg' }],
    siteMaps: [{ title: 'Demo floor plan', caption: 'Synthetic diagram with example monitoring points.', asset: 'site-diagram.svg' }],
    acknowledgement: { technicianName: 'Synthetic Technician', technicianDesignation: 'Demo technician', customerName: 'Synthetic Representative', customerDesignation: 'Demo contact', customerResponse: 'Signed', reason: '', acknowledgement: 'Synthetic acknowledgement for visual review only. No actual service or customer consent is recorded.' },
    attachments: [{ title: 'Synthetic monitoring sheet', caption: 'Sample document card only; no uploaded file.' }],
    followup: { required: 'Yes', nextVisitDate: '2026-11-16', reason: 'Review the synthetic corrective action.', correctiveActions: 'Check sample entry-point sealing.', monitoring: 'Recheck demonstration point M01.', customerInstructions: 'Demonstration housekeeping guidance only.', internalNotes: 'Synthetic staff-only note; omitted from the static customer report.' }
  };
  function initialReports() {
    return [
      { id: 'DEMO-SR-001', status: 'Draft', customer: 'Synthetic Aster Facilities', site: 'Demo Warehouse A', date: '2026-11-09', content: copy(content) },
      { id: 'DEMO-SR-002', status: 'Submitted', customer: 'Synthetic Birch Office', site: 'Demo Office B', date: '2026-11-08', content: copy(content) },
      { id: 'DEMO-SR-003', status: 'Approved', customer: 'Synthetic Cedar Studios', site: 'Demo Studio C', date: '2026-11-07', content: copy(content) }
    ].map(report => { report.content.header.customerName = report.customer; report.content.header.siteName = report.site; report.content.header.serviceDate = report.date; return report; });
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function filter(reports, query, status) { const q = String(query).toLowerCase().trim(); return reports.filter(r => (status === 'All' || r.status === status) && [r.id, r.customer, r.site].join(' ').toLowerCase().includes(q)); }
  function newReport(reports) { return { id: `DEMO-SR-${String(reports.length + 1).padStart(3, '0')}`, status: 'Draft', customer: content.header.customerName, site: content.header.siteName, date: content.header.serviceDate, content: copy(content) }; }
  function customerReport(report) { const result = copy(report); delete result.content.followup.internalNotes; return result; }
  function simulateSubmit(report, acknowledged) { if (!acknowledged) throw Error('Confirm that this is synthetic preview data.'); if (report.status !== 'Draft') throw Error('Only a demo draft can be simulated.'); return { ...copy(report), status: 'Submitted' }; }
  globalThis.SKUAS_PREVIEW_MODEL = Object.freeze({ copy, escape, initialReports, filter, newReport, customerReport, simulateSubmit });
})();
