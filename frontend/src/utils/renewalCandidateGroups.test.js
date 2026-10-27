import test from 'node:test';import assert from 'node:assert/strict';import{groupRenewalCandidates}from'./renewalCandidateGroups.js';
const fixture=[
 {key:'K1',invoiceId:'I1',invoiceNumber:'SAMPLE/001',serviceType:'General service',start:'2026-01-01',end:'2026-12-31',amount:100.25,invoiceVersion:'V1',reviewAllowed:true},
 {key:'K2',invoiceId:'I1',invoiceNumber:'SAMPLE/001',serviceType:'Other service',start:'2026-01-01',end:'2026-12-31',amount:200.75,invoiceVersion:'V1',reviewAllowed:true},
 {key:'K3',invoiceId:'I2',invoiceNumber:'SAMPLE/002',serviceType:'General service',start:'2027-01-01',end:'2027-12-31',amount:500,invoiceVersion:'V2',eligible:true}
];
test('one invoice group retains every service/period candidate and exact allocation/version/key',()=>{
 const snapshot=JSON.stringify(fixture),groups=groupRenewalCandidates(fixture);
 assert.equal(groups.length,2);assert.equal(groups[0].candidates.length,2);
 assert.equal(groups[0].candidates[0],fixture[0]);assert.equal(groups[0].candidates[1],fixture[1]);
 assert.deepEqual(groups[0].candidates.map(v=>[v.key,v.amount,v.invoiceVersion]),[['K1',100.25,'V1'],['K2',200.75,'V1']]);assert.equal(JSON.stringify(fixture),snapshot);
});
test('service search retains the whole invoice group rather than concealing other services',()=>{
 const groups=groupRenewalCandidates(fixture,{search:'other service'});assert.equal(groups.length,1);assert.equal(groups[0].candidates.length,2);
});
test('distinct canonical invoice IDs sharing a number stay distinct and labelled',()=>{
 const groups=groupRenewalCandidates([fixture[0],{...fixture[2],invoiceNumber:'SAMPLE/001'}]);
 assert.equal(groups.length,2);assert.equal(groups[0].recordSuffix,' · Record 1 of 2');assert.equal(groups[1].recordSuffix,' · Record 2 of 2');
});
test('only exact duplicate payload copies are removed, never separate periods or versions',()=>{
 const groups=groupRenewalCandidates([fixture[0],{...fixture[0]}, {...fixture[0],key:'K4',start:'2027-01-01'}, {...fixture[0],key:'K5',invoiceVersion:'V3'}]);assert.equal(groups.length,1);assert.equal(groups[0].candidates.length,3);
});
test('selected group remains available while searching, with empty/no-match states preserved',()=>{
 assert.equal(groupRenewalCandidates(fixture,{search:'not found'}).length,0);
 assert.equal(groupRenewalCandidates(fixture,{search:'not found',selectedInvoiceId:'I1'}).length,1);
 assert.equal(groupRenewalCandidates(fixture,{search:'not found',selectedKey:'K3'})[0].id,'I2');assert.deepEqual(groupRenewalCandidates([]),[]);
});
test('mixed periods/statuses are not mislabelled as a single active contract',()=>{
 const groups=groupRenewalCandidates([{...fixture[0],contractStatusLabel:'Expired Contract'},{...fixture[1],contractStatusLabel:'Active Contract'}]);assert.equal(groups[0].statusLabel,'Multiple service periods');assert.equal(groups[0].candidates[0].contractStatusLabel,'Expired Contract');
});
