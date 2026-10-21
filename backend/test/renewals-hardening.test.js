const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const renewalDashboardSource = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/RenewalDashboard.jsx'), 'utf8');
const actionMenuSource = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/ui/ActionMenu.jsx'), 'utf8');

function routeBlock(method, route) {
  const start = source.indexOf(`app.${method}('${route}'`);
  assert.notEqual(start, -1, `${method.toUpperCase()} ${route} route not found`);
  const nextRoute = source.indexOf('\napp.', start + 1);
  return source.slice(start, nextRoute === -1 ? source.length : nextRoute);
}

test('renewal convert-contract uses one locked MySQL transaction before JSON shadow write', () => {
  const block = routeBlock('post', '/api/renewals/:id/convert-contract');

  assert.match(block, /await conn\.beginTransaction\(\)/);
  assert.match(block, /FOR UPDATE/);
  assert.match(block, /readLockedSettingsForNumbering\(conn\)/);
  assert.match(block, /syncInvoiceToMysqlOnConnection\(conn, newInvoice, \{ ensureSchema: false \}\)/);
  assert.match(block, /persistLockedSettingsForNumbering\(conn, lockedSettings, newInvoice\.invoiceNumber, newInvoice\.invoiceType\)/);
  assert.match(block, /UPDATE renewals[\s\S]+converted_contract_id[\s\S]+WHERE renewal_id = \? AND \(converted_contract_id IS NULL OR converted_contract_id = ''\)/);
  assert.match(block, /agreement_date/);
  assert.match(block, /status = CASE WHEN \? THEN 'Done' ELSE status END/);
  assert.match(block, /renewal_outcome[\s\S]+'WON'/);
  assert.match(block, /renewal_timing/);
  assert.match(block, /deriveRenewalTiming\(\{[\s\S]+renewal_outcome: 'WON'[\s\S]+outcome_decision_date: agreementDate[\s\S]+previous_contract_end: lockedRenewal\.previousContractEnd[\s\S]+\}\)/);
  assert.match(block, /calculateRenewalContractEndDate/);
  assert.match(block, /await conn\.commit\(\)/);
  assert.match(block, /await conn\.rollback\(\)/);
  assert.match(block, /buildRenewalInvoiceFinancials/);
  assert.match(source, /sourceItems\.length > 1[\s\S]+Revised pricing for multi-item renewals is not supported here/);
  assert.match(source, /renewalInvoiceTotalsFromItems/);

  const commitIndex = block.indexOf('await conn.commit()');
  const shadowIndex = block.indexOf('readJsonFile(invoicesFile');
  assert.ok(commitIndex > -1 && shadowIndex > commitIndex, 'JSON shadow write must happen only after commit');
});

test('renewal won/lost writes preserve the legacy status enum and use V3 outcome fields', () => {
  const convertBlock = routeBlock('post', '/api/renewals/:id/convert-contract');
  const markDoneBlock = routeBlock('post', '/api/renewals/:id/mark-done');
  const declineBlock = routeBlock('post', '/api/renewals/:id/decline');
  const markMatchingStart = source.indexOf('const markMatchingRenewalCompleteForInvoice = async');
  const markMatchingEnd = source.indexOf('\nconst findRenewalRow', markMatchingStart);
  assert.ok(markMatchingStart > -1 && markMatchingEnd > markMatchingStart, 'markMatchingRenewalCompleteForInvoice block not found');
  const markMatchingBlock = source.slice(markMatchingStart, markMatchingEnd);

  assert.match(markMatchingBlock, /invoice\.previousContractId/);
  assert.match(markMatchingBlock, /service\.link\(/);
  assert.match(markDoneBlock, /SET status = 'Done', renewal_status = 'RENEWED', renewal_outcome = 'WON'/);
  assert.match(convertBlock, /status = CASE WHEN \? THEN 'Done' ELSE status END/);
  assert.match(convertBlock, /renewal_outcome = CASE WHEN \? THEN 'WON' ELSE renewal_outcome END/);
  assert.match(convertBlock, /renewal_timing = CASE WHEN \? THEN \? ELSE renewal_timing END/);
  assert.match(declineBlock, /SET status = \?,[\s\S]+renewal_status = \?,[\s\S]+renewal_outcome = \?/);
  assert.match(declineBlock, /\[\s*'Declined',\s*'DECLINED',\s*'LOST'/);
  assert.doesNotMatch(convertBlock, /THEN 'Renewed'/);
  assert.doesNotMatch(markDoneBlock, /status = 'Renewed'/);
  assert.doesNotMatch(markMatchingBlock, /\['Renewed', 'RENEWED'/);
});

test('renewal readers preserve historical Renewed records and V3 tabs', () => {
  const publicRowStart = source.indexOf('const renewalPublicRow = (row = {}) =>');
  const publicRowEnd = source.indexOf('\nconst ensureRenewalTables', publicRowStart);
  assert.ok(publicRowStart > -1 && publicRowEnd > publicRowStart, 'renewalPublicRow block not found');
  const publicRowBlock = source.slice(publicRowStart, publicRowEnd);
  const visibleRowsStart = renewalDashboardSource.indexOf('const visibleRows = useMemo');
  const visibleRowsEnd = renewalDashboardSource.indexOf('\n\n  const totalPages', visibleRowsStart);
  assert.ok(visibleRowsStart > -1 && visibleRowsEnd > visibleRowsStart, 'visibleRows block not found');
  const visibleRowsBlock = renewalDashboardSource.slice(visibleRowsStart, visibleRowsEnd);

  assert.match(source, /if \(normalized === 'DONE' \|\| normalized === 'RENEWED'\) return 'RENEWED'/);
  assert.match(source, /if \(normalized === 'DECLINED' \|\| normalized === 'LOST'\) return 'DECLINED'/);
  assert.match(publicRowBlock, /status: outcome === 'WON' \? 'Renewed' : outcome === 'LOST' \? 'Declined'/);
  assert.match(visibleRowsBlock, /activeTab === 'Renewed'[\s\S]+row\.status === 'Renewed'/);
  assert.match(visibleRowsBlock, /activeTab === 'Declined'[\s\S]+row\.status === 'Declined'/);
});

test('renewal dashboard reporting remains outcome-based without double counting', () => {
  const summaryStart = source.indexOf('const summarizeRenewals = (rows = []) =>');
  const summaryEnd = source.indexOf('\nconst sourceRenewalCandidates', summaryStart);
  assert.ok(summaryStart > -1 && summaryEnd > summaryStart, 'summarizeRenewals block not found');
  const summaryBlock = source.slice(summaryStart, summaryEnd);

  assert.match(summaryBlock, /const outcomeOf = \(row\) => normalizeRenewalOutcome/);
  assert.match(summaryBlock, /const wonRows = contractRows\.filter\(\(row\) => outcomeOf\(row\) === 'WON'\)/);
  assert.match(summaryBlock, /const lostRows = contractRows\.filter\(\(row\) => outcomeOf\(row\) === 'LOST'\)/);
  assert.match(summaryBlock, /const pendingRows = contractRows\.filter\(\(row\) => outcomeOf\(row\) === 'PENDING'\)/);
  assert.match(summaryBlock, /wonRenewalRevenue: wonRows\.reduce/);
  assert.match(summaryBlock, /lostOpportunityValue: lostRows\.reduce/);
  assert.match(summaryBlock, /pendingOpportunityValue: pendingRows\.reduce/);
  assert.match(summaryBlock, /winRate: decidedCount > 0/);
});

test('renewal edit preserves legacy status compatibility and keeps won/lost in outcome actions', () => {
  const block = routeBlock('post', '/api/renewals/:id/edit');
  const statusListMatch = renewalDashboardSource.match(/const statuses = \[([^\]]+)\]/);
  assert.ok(statusListMatch, 'renewal filter status list not found');

  assert.match(source, /const renewalLegacyEditableStatuses/);
  assert.match(source, /const renewalLegacyStatusForEdit/);
  assert.match(block, /renewalLegacyStatusForEdit/);
  assert.match(block, /Use Mark as Won\/Lost actions for renewal outcome changes/);
  assert.doesNotMatch(statusListMatch[1], /Won/);
  assert.doesNotMatch(statusListMatch[1], /Lost/);
});

test('renewal summary returns filtered and global reporting buckets', () => {
  const block = routeBlock('get', '/api/renewals/summary');

  assert.match(block, /const allRows = await loadRenewalRows\(\)/);
  assert.match(block, /const filteredRows = applyRenewalFilters\(allRows, req\.query\)/);
  assert.match(block, /filtered/);
  assert.match(block, /global/);
  assert.match(source, /totalEligibleRenewalOpportunities/);
  assert.match(source, /monthWiseSummary/);
  assert.match(source, /durationWiseSummary/);
});

test('renewal lost outcome stores reason, decision date, and audit trail', () => {
  const block = routeBlock('post', '/api/renewals/:id/decline');

  assert.match(block, /renewal_outcome = \?/);
  assert.match(block, /'LOST'/);
  assert.match(block, /outcome_decision_date/);
  assert.match(block, /lost_reason/);
  assert.match(block, /lost_notes/);
  assert.match(block, /insertRenewalAuditLog/);
});

test('renewal won and lost actions stay available only for authorized eligible rows', () => {
  const canRenewStart = renewalDashboardSource.indexOf('const canRenewRow = (row) =>');
  const canRenewEnd = renewalDashboardSource.indexOf('\n  const canConvertOneTimeRow', canRenewStart);
  const rowMoreStart = renewalDashboardSource.indexOf('const rowMoreItems = (row) =>');
  const rowMoreEnd = renewalDashboardSource.indexOf('const renderRowActions = (row, mobile = false) =>', rowMoreStart);
  const rowActionsStart = renewalDashboardSource.indexOf('const renderRowActions = (row, mobile = false) =>');
  const rowActionsEnd = renewalDashboardSource.indexOf('\n\n  useEffect(() => {', rowActionsStart);
  assert.ok(canRenewStart > -1 && canRenewEnd > canRenewStart, 'canRenewRow block not found');
  assert.ok(rowMoreStart > -1 && rowMoreEnd > rowMoreStart, 'rowMoreItems block not found');
  assert.ok(rowActionsStart > -1 && rowActionsEnd > rowActionsStart, 'renderRowActions block not found');
  const canRenewBlock = renewalDashboardSource.slice(canRenewStart, canRenewEnd);
  const rowMoreBlock = renewalDashboardSource.slice(rowMoreStart, rowMoreEnd);
  const rowActionsBlock = renewalDashboardSource.slice(rowActionsStart, rowActionsEnd);

  assert.match(canRenewBlock, /canUseAssignedRenewal\(row\)/);
  assert.match(canRenewBlock, /row\?\.serviceRelationshipType === 'CONTRACT'/);
  assert.match(canRenewBlock, /row\?\.renewalEligible/);
  assert.match(canRenewBlock, /!isFinalRow\(row\)/);
  assert.match(rowActionsBlock, /canRenewRow\(row\)[\s\S]+title="Mark as Won"/);
  assert.match(rowActionsBlock, /onClick=\{\(\) => openModal\('convert', row\)\}/);
  assert.match(rowMoreBlock, /canUseAssignedRenewal\(row\)[\s\S]+!isFinalRow\(row\)[\s\S]+\(row\.serviceRelationshipType === 'CONTRACT' \|\| canWinLetterRow\(row\)\)[\s\S]+\{ label: 'Mark as Lost'/);
  assert.match(rowMoreBlock, /onClick: \(\) => openModal\('decline', row\)/);
  assert.match(rowActionsBlock, /canUseAssignedRenewal\(row\) && !isFinalRow\(row\) && \(row\.serviceRelationshipType === 'CONTRACT' \|\| canWinLetterRow\(row\)\)[\s\S]+title="Mark as Lost"/);
  assert.match(rowActionsBlock, /onClick=\{\(\) => openModal\('decline', row\)\}/);
});

test('renewal details view does not silently convert contracts or regenerate letters', () => {
  const viewStart = renewalDashboardSource.indexOf("{modal.type === 'view'");
  const viewEnd = renewalDashboardSource.indexOf("{modal.type === 'edit'", viewStart);
  assert.ok(viewStart > -1 && viewEnd > viewStart, 'view modal block not found');
  const viewBlock = renewalDashboardSource.slice(viewStart, viewEnd);

  assert.doesNotMatch(viewBlock, /convert-contract/);
  assert.doesNotMatch(viewBlock, /\/decline/);
  assert.doesNotMatch(viewBlock, /generate-letter/);
  assert.match(viewBlock, /openRenewalPdfPreview\(row\)/);
});

test('renewal decline does not create contracts or invoices', () => {
  const block = routeBlock('post', '/api/renewals/:id/decline');

  assert.doesNotMatch(block, /syncInvoiceToMysqlOnConnection/);
  assert.doesNotMatch(block, /createNextInvoiceNumber/);
  assert.doesNotMatch(block, /const newInvoice/);
  assert.doesNotMatch(block, /converted_contract_id = \?/);
});

test('renewal audit scan is read-only until an explicit audit action is submitted', () => {
  const scanBlock = routeBlock('get', '/api/renewals/audit');
  const actionBlock = routeBlock('post', '/api/renewals/audit/classify');

  assert.doesNotMatch(scanBlock, /\bUPDATE\b/i);
  assert.doesNotMatch(scanBlock, /\bINSERT\b/i);
  assert.doesNotMatch(scanBlock, /\bDELETE\b/i);
  assert.doesNotMatch(scanBlock, /syncRenewalToMysql/);
  assert.match(actionBlock, /UPDATE renewals/);
  assert.match(renewalDashboardSource, /Click Scan Records to run a read-only renewal classification check/);
});

test('renewal table keeps row actions accessible and menus outside overflow clipping', () => {
  assert.match(renewalDashboardSource, /const renewalTableContentStyle = \{/);
  assert.match(renewalDashboardSource, /const renewalActionCellStyle = \{[\s\S]+position: 'sticky'[\s\S]+right: 0[\s\S]+overflow: 'visible'/);
  assert.match(renewalDashboardSource, /const renewalHeadCellStyle = \(key, align = 'left'\) => \{[\s\S]+key === 'actions'[\s\S]+position: isActions \? 'sticky'/);
  assert.match(actionMenuSource, /createPortal\(/);
  assert.match(actionMenuSource, /document\.body/);
  assert.match(actionMenuSource, /position: 'fixed'/);
});

test('renewal letter preview and WhatsApp share do not silently regenerate PDFs', () => {
  const previewStart = renewalDashboardSource.indexOf('const openRenewalPdfPreview = async');
  const whatsappStart = renewalDashboardSource.indexOf('const openRenewalWhatsAppComposer = async');
  assert.notEqual(previewStart, -1, 'openRenewalPdfPreview function not found');
  assert.notEqual(whatsappStart, -1, 'openRenewalWhatsAppComposer function not found');
  const previewEnd = renewalDashboardSource.indexOf('\n  const shareRenewalLetterByEmail', previewStart);
  const whatsappEnd = renewalDashboardSource.indexOf('\n  useEffect', whatsappStart);
  const previewBlock = renewalDashboardSource.slice(previewStart, previewEnd);
  const whatsappBlock = renewalDashboardSource.slice(whatsappStart, whatsappEnd);

  assert.doesNotMatch(previewBlock, /generate-letter/);
  assert.doesNotMatch(whatsappBlock, /generate-letter/);
  assert.match(renewalDashboardSource, /Regenerate Letter/);
});

test('renewal letters use the current contract period before month filtering', () => {
  const block = routeBlock('get', '/api/renewals/letters');

  assert.match(block, /const currentRenewals = await loadRenewalRows\(\)/);
  assert.match(block, /currentRenewalById\.get\(renewalId\)/);
  assert.match(block, /const contractEnd = current\?\.previousContractEnd \|\| current\?\.renewalDueDate/);
  assert.match(block, /renewalDueDate: contractEnd/);
  assert.match(block, /conclude_date: contractEnd/);
  assert.ok(block.indexOf('currentRenewalById.get(renewalId)') < block.indexOf('applyRenewalFilters(normalized, req.query)'), 'current contract dates must be applied before letter filters');
});

test('sensitive renewal routes require explicit renewal authorization', () => {
  const expected = [
    ['post', '/api/renewals/audit/classify', 'requireRenewalAdminAccess'],
    ['post', '/api/renewals/sync', 'requireRenewalAdminAccess'],
    ['post', '/api/renewals/:id/assign', 'requireRenewalManagerAccess'],
    ['post', '/api/renewals/:id/edit', 'requireRenewalRecordAccess'],
    ['delete', '/api/renewals/:id', 'requireRenewalAdminAccess'],
    ['post', '/api/renewals/:id/followup', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/generate-letter', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/mark-done', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/decline', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/convert-contract', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals', 'requireRenewalManagerAccess'],
    ['put', '/api/renewals/:id', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/send-reminder', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/send-whatsapp', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/quotation', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/convert-invoice', 'requireRenewalRecordAccess'],
    ['post', '/api/renewals/:id/assign-technician', 'requireRenewalManagerAccess']
  ];

  for (const [method, route, guard] of expected) {
    assert.match(routeBlock(method, route), new RegExp(`${guard}\\(req, res`), `${method.toUpperCase()} ${route} missing ${guard}`);
  }
});
